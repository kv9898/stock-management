use crate::db::{get_db_config, ignore_empty_baton_commit, sql_quote, to_sql_null_or_string};
use libsql_client::Client;
use serde::Deserialize;
use tokio::task;

#[derive(Debug, Deserialize)]
pub struct LoanHeaderIn {
    pub id: String,        // UUID from frontend
    pub date: String,      // "YYYY-MM-DD"
    pub direction: String, // "loan_in" | "loan_out" | "return_in" | "return_out"
    pub counterparty: String,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LoanItemIn {
    pub id: String, // UUID from frontend
    pub product_name: String,
    pub quantity: i64,  // > 0
    pub expiry: String, // "YYYY-MM-DD"
}

#[inline]
fn dir_delta(direction: &str, qty: i64) -> Result<i64, String> {
    match direction {
        "loan_in" | "return_in" => Ok(qty),    // stock increases
        "loan_out" | "return_out" => Ok(-qty), // stock decreases
        other => Err(format!("未知方向：{}", other)),
    }
}

#[tauri::command]
pub async fn create_loan(
    header: LoanHeaderIn,
    items: Vec<LoanItemIn>,
    adjust_stock: Option<bool>,
) -> Result<(), String> {
    if items.is_empty() {
        return Err("至少需要一条明细项".into());
    }
    for it in &items {
        if it.quantity <= 0 {
            return Err(format!(
                "数量必须为正数：{} ({})",
                it.product_name, it.quantity
            ));
        }
    }

    task::spawn_blocking(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async move {
            // 1) connect
            let config = get_db_config().await.map_err(|e| e.to_string())?;
            let client = Client::from_config(config)
                .await
                .map_err(|e| e.to_string())?;

            // IMPORTANT: enable FKs
            client
                .execute("PRAGMA foreign_keys = ON;")
                .await
                .map_err(|e| e.to_string())?;

            // 2) begin tx
            let tx = client.transaction().await.map_err(|e| e.to_string())?;

            // normalize / quote
            let hdr_id_q = sql_quote(&header.id);
            let date_q = sql_quote(&header.date);
            let dir_q = sql_quote(&header.direction);
            let cp_q = sql_quote(&header.counterparty);
            let note_sql = to_sql_null_or_string(&header.note);

            // 3) checks inside the tx

            // 3a) direction is valid
            if !matches!(
                header.direction.as_str(),
                "loan_in" | "loan_out" | "return_in" | "return_out"
            ) {
                return Err(format!("非法方向：{}", header.direction));
            }

            // 3b) verify all products exist (clear error before FK)
            for it in &items {
                let p_q = sql_quote(&it.product_name);
                let exists = tx
                    .execute(format!(
                        "SELECT 1 FROM Product WHERE name='{}' LIMIT 1;",
                        p_q
                    ))
                    .await
                    .map_err(|e| e.to_string())?;
                if exists.rows.is_empty() {
                    return Err(format!("产品不存在：{}", it.product_name));
                }
            }

            // 3c) if decreasing stock, ensure not going negative for (name, expiry)
            let will_adjust = adjust_stock.unwrap_or(true);
            if will_adjust {
                for it in &items {
                    let delta = dir_delta(&header.direction, it.quantity)?;
                    if delta < 0 {
                        let name_q = sql_quote(&it.product_name);
                        let expiry_q = sql_quote(&it.expiry);
                        let rs = tx
                            .execute(format!(
                                "SELECT quantity FROM Stock WHERE name='{}' AND expiry='{}';",
                                name_q, expiry_q
                            ))
                            .await
                            .map_err(|e| e.to_string())?;
                        let current: i64 = rs
                            .rows
                            .get(0)
                            .and_then(|row| row.try_column::<i64>("quantity").ok())
                            .unwrap_or(0);
                        if current + delta < 0 {
                            return Err(format!(
                                "库存不足：{}（到期 {}）当前 {}，欲减少 {}",
                                it.product_name, it.expiry, current, -delta
                            ));
                        }
                    }
                }
            }

            // 4) perform inserts

            // 4a) header
            let sql_header = format!(
                "INSERT INTO LoanHeader (id, date, direction, counterparty, note)
                 VALUES ('{}','{}','{}','{}', {});",
                hdr_id_q, date_q, dir_q, cp_q, note_sql
            );
            tx.execute(sql_header).await.map_err(|e| e.to_string())?;

            // 4b) items
            for it in &items {
                let it_id_q = sql_quote(&it.id);
                let name_q = sql_quote(&it.product_name);
                let expiry_q = sql_quote(&it.expiry);
                let sql_item = format!(
                    "INSERT INTO LoanItem (id, loan_id, product_name, quantity, expiry)
                     VALUES ('{}','{}','{}', {}, '{}');",
                    it_id_q, hdr_id_q, name_q, it.quantity, expiry_q
                );
                tx.execute(sql_item).await.map_err(|e| e.to_string())?;
            }

            // 4c) adjust Stock if requested (UPSERT on (name, expiry))
            if will_adjust {
                for it in &items {
                    let delta = dir_delta(&header.direction, it.quantity)?;
                    let name_q = sql_quote(&it.product_name);
                    let expiry_q = sql_quote(&it.expiry);
                    let upsert = format!(
                        "INSERT INTO Stock (id, name, expiry, quantity)
                         VALUES (lower(hex(randomblob(16))), '{name}', '{expiry}', {delta})
                         ON CONFLICT(name, expiry)
                         DO UPDATE SET quantity = quantity + {delta};",
                        name = name_q,
                        expiry = expiry_q,
                        delta = delta
                    );
                    tx.execute(upsert).await.map_err(|e| e.to_string())?;
                }
            }

            // 5) commit using your helper
            let res = tx.commit().await;
            ignore_empty_baton_commit(res)?;
            Ok(())
        })
    })
    .await
    .map_err(|e| e.to_string())?
}
