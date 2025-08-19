use crate::db::{get_db_config, sql_quote};
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
    // basic validation
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
            let db_cfg = get_db_config().await.map_err(|e| e.to_string())?;
            let client = Client::from_config(db_cfg)
                .await
                .map_err(|e| e.to_string())?;

            // Always good to ensure FKs on this connection
            client
                .execute("PRAGMA foreign_keys = ON;")
                .await
                .map_err(|e| e.to_string())?;

            // Start TX
            client
                .execute("BEGIN IMMEDIATE;")
                .await
                .map_err(|e| e.to_string())?;

            // Insert header
            let note_sql = match &header.note {
                Some(s) => format!("'{}'", sql_quote(s)),
                None => "NULL".to_string(),
            };
            let sql_header = format!(
                "INSERT INTO LoanHeader (id, date, direction, counterparty, note)
                 VALUES ('{}','{}','{}','{}', {});",
                sql_quote(&header.id),
                sql_quote(&header.date),
                sql_quote(&header.direction),
                sql_quote(&header.counterparty),
                note_sql
            );
            if let Err(e) = client.execute(sql_header).await {
                let _ = client.execute("ROLLBACK;").await;
                return Err(e.to_string());
            }

            // Insert items
            for it in &items {
                let sql_item = format!(
                    "INSERT INTO LoanItem (id, loan_id, product_name, quantity, expiry)
                     VALUES ('{}','{}','{}', {}, '{}');",
                    sql_quote(&it.id),
                    sql_quote(&header.id),
                    sql_quote(&it.product_name),
                    it.quantity,
                    sql_quote(&it.expiry),
                );
                if let Err(e) = client.execute(sql_item).await {
                    let _ = client.execute("ROLLBACK;").await;
                    return Err(e.to_string());
                }
            }

            // Optionally adjust Stock
            if adjust_stock.unwrap_or(true) {
                for it in &items {
                    let delta = dir_delta(&header.direction, it.quantity)?;

                    // Prevent negative stock
                    if delta < 0 {
                        let sel = format!(
                            "SELECT quantity FROM Stock WHERE name='{}' AND expiry='{}';",
                            sql_quote(&it.product_name),
                            sql_quote(&it.expiry)
                        );
                        let res = client.execute(sel).await.map_err(|e| e.to_string())?;
                        let current: i64 = res
                            .rows
                            .get(0)
                            .and_then(|row| row.try_column::<i64>("quantity").ok())
                            .unwrap_or(0);
                        if current + delta < 0 {
                            let _ = client.execute("ROLLBACK;").await;
                            return Err(format!(
                                "库存不足：{}（到期 {}）当前 {}，欲减少 {}",
                                it.product_name, it.expiry, current, -delta
                            ));
                        }
                    }

                    // Upsert with delta (id is a random blob when inserting new row)
                    let upsert = format!(
                        "INSERT INTO Stock (id, name, expiry, quantity)
                         VALUES (lower(hex(randomblob(16))), '{name}', '{expiry}', {delta})
                         ON CONFLICT(name, expiry)
                         DO UPDATE SET quantity = quantity + {delta};",
                        name = sql_quote(&it.product_name),
                        expiry = sql_quote(&it.expiry),
                        delta = delta
                    );
                    if let Err(e) = client.execute(upsert).await {
                        let _ = client.execute("ROLLBACK;").await;
                        return Err(e.to_string());
                    }
                }
            }

            // Commit TX
            if let Err(e) = client.execute("COMMIT;").await {
                let _ = client.execute("ROLLBACK;").await;
                return Err(e.to_string());
            }
            Ok(())
        })
    })
    .await
    .map_err(|e| e.to_string())?
}
