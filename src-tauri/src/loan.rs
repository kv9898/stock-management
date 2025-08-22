use crate::db::{get_db_config, ignore_empty_baton_commit, sql_quote, to_sql_null_or_string};
use libsql_client::Client;
use serde::{Deserialize, Serialize};
use tokio::task;

#[derive(Debug, Deserialize, Serialize)]
pub struct LoanHeader {
    pub id: String,        // UUID from frontend
    pub date: String,      // "YYYY-MM-DD"
    pub direction: String, // "loan_in" | "loan_out" | "return_in" | "return_out"
    pub counterparty: String,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct LoanItem {
    pub id: String, // UUID from frontend
    pub product_name: String,
    pub quantity: i64,          // > 0
    pub expiry: Option<String>, // "YYYY-MM-DD"
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
    header: LoanHeader,
    items: Vec<LoanItem>,
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
                        let expiry = it
                            .expiry
                            .as_ref()
                            .ok_or_else(|| format!("必须提供到期日：{}", it.product_name))?;
                        let expiry_q = sql_quote(expiry);
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
                                it.product_name, expiry, current, -delta
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
                let sql_item = format!(
                    "INSERT INTO LoanItem (id, loan_id, product_name, quantity)
                     VALUES ('{}','{}','{}', {});",
                    it_id_q, hdr_id_q, name_q, it.quantity
                );
                tx.execute(sql_item).await.map_err(|e| e.to_string())?;
            }

            // 4c) adjust Stock if requested (UPSERT on (name, expiry))
            if will_adjust {
                for it in &items {
                    let delta = dir_delta(&header.direction, it.quantity)?;
                    let name_q = sql_quote(&it.product_name);
                    let expiry = it
                        .expiry
                        .as_ref()
                        .ok_or_else(|| format!("必须提供到期日：{}", it.product_name))?;
                    let expiry_q = sql_quote(expiry);
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

#[tauri::command]
pub async fn delete_loan(loan_id: String) -> Result<(), String> {
    task::spawn_blocking(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async move {
            let config = get_db_config().await.map_err(|e| e.to_string())?;
            let client = Client::from_config(config)
                .await
                .map_err(|e| e.to_string())?;

            // IMPORTANT: enable FKs to ensure proper cascade behavior
            client
                .execute("PRAGMA foreign_keys = ON;")
                .await
                .map_err(|e| e.to_string())?;

            // Begin transaction
            let tx = client.transaction().await.map_err(|e| e.to_string())?;

            let loan_id_q = sql_quote(&loan_id);

            // 1. First delete the loan items (child records)
            let delete_items_sql = format!("DELETE FROM LoanItem WHERE loan_id = '{}';", loan_id_q);
            tx.execute(delete_items_sql)
                .await
                .map_err(|e| e.to_string())?;

            // 2. Then delete the loan header (parent record)
            let delete_header_sql = format!("DELETE FROM LoanHeader WHERE id = '{}';", loan_id_q);
            tx.execute(delete_header_sql)
                .await
                .map_err(|e| e.to_string())?;

            // Commit the transaction
            let res = tx.commit().await;
            ignore_empty_baton_commit(res)?;

            Ok(())
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn update_loan(header: LoanHeader, items: Vec<LoanItem>) -> Result<(), String> {
    task::spawn_blocking(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async move {
            let config = get_db_config().await.map_err(|e| e.to_string())?;
            let client = Client::from_config(config)
                .await
                .map_err(|e| e.to_string())?;

            // IMPORTANT: enable FKs
            client
                .execute("PRAGMA foreign_keys = ON;")
                .await
                .map_err(|e| e.to_string())?;

            // Begin transaction
            let tx = client.transaction().await.map_err(|e| e.to_string())?;

            let loan_id_q = sql_quote(&header.id);
            let date_q = sql_quote(&header.date);
            let dir_q = sql_quote(&header.direction);
            let cp_q = sql_quote(&header.counterparty);
            let note_sql = to_sql_null_or_string(&header.note);

            // 1. Verify direction is valid
            if !matches!(
                header.direction.as_str(),
                "loan_in" | "loan_out" | "return_in" | "return_out"
            ) {
                return Err(format!("非法方向：{}", header.direction));
            }

            // 2. Verify all products exist
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

            // 3. Update loan header
            let update_header_sql = format!(
                "UPDATE LoanHeader 
                 SET date = '{}', direction = '{}', counterparty = '{}', note = {}
                 WHERE id = '{}';",
                date_q, dir_q, cp_q, note_sql, loan_id_q
            );
            tx.execute(update_header_sql)
                .await
                .map_err(|e| e.to_string())?;

            // 4. Delete existing loan items
            let delete_items_sql = format!("DELETE FROM LoanItem WHERE loan_id = '{}';", loan_id_q);
            tx.execute(delete_items_sql)
                .await
                .map_err(|e| e.to_string())?;

            // 5. Insert new loan items
            for it in &items {
                let it_id_q = sql_quote(&it.id);
                let name_q = sql_quote(&it.product_name);
                let sql_item = format!(
                    "INSERT INTO LoanItem (id, loan_id, product_name, quantity)
                     VALUES ('{}','{}','{}', {});",
                    it_id_q, loan_id_q, name_q, it.quantity
                );
                tx.execute(sql_item).await.map_err(|e| e.to_string())?;
            }

            // Commit the transaction
            let res = tx.commit().await;
            ignore_empty_baton_commit(res)?;

            Ok(())
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_loan_history() -> Result<Vec<LoanHeader>, String> {
    task::spawn_blocking(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async move {
            let config = get_db_config().await.map_err(|e| e.to_string())?;
            let client = Client::from_config(config)
                .await
                .map_err(|e| e.to_string())?;

            // Query to get all loan headers ordered by date (newest first)
            let sql = r#"
                SELECT id, date, direction, counterparty, note
                FROM LoanHeader
                ORDER BY date DESC, id DESC
            "#;

            let result = client.execute(sql).await.map_err(|e| e.to_string())?;

            let mut loan_headers = Vec::new();

            for row in result.rows {
                let id = row
                    .try_column::<&str>("id")
                    .map_err(|_| "Failed to get id from loan header".to_string())?
                    .to_string();

                let date = row
                    .try_column::<&str>("date")
                    .map_err(|_| "Failed to get date from loan header".to_string())?
                    .to_string();

                let direction = row
                    .try_column::<&str>("direction")
                    .map_err(|_| "Failed to get direction from loan header".to_string())?
                    .to_string();

                let counterparty = row
                    .try_column::<&str>("counterparty")
                    .map_err(|_| "Failed to get counterparty from loan header".to_string())?
                    .to_string();

                let note = row.try_column::<&str>("note").ok().map(|s| s.to_string());

                loan_headers.push(LoanHeader {
                    id,
                    date,
                    direction,
                    counterparty,
                    note,
                });
            }

            Ok(loan_headers)
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_loan_items(loan_id: String) -> Result<Vec<LoanItem>, String> {
    task::spawn_blocking(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async move {
            let config = get_db_config().await.map_err(|e| e.to_string())?;
            let client = Client::from_config(config)
                .await
                .map_err(|e| e.to_string())?;

            // Query to get all items for a specific loan
            let sql = format!(
                r#"
                SELECT id, product_name, quantity
                FROM LoanItem
                WHERE loan_id = '{}'
                ORDER BY product_name
                "#,
                sql_quote(&loan_id)
            );

            let result = client.execute(sql).await.map_err(|e| e.to_string())?;

            let mut loan_items = Vec::new();

            for row in result.rows {
                let id = row
                    .try_column::<&str>("id")
                    .map_err(|_| "Failed to get id from loan item".to_string())?
                    .to_string();

                let product_name = row
                    .try_column::<&str>("product_name")
                    .map_err(|_| "Failed to get product_name from loan item".to_string())?
                    .to_string();

                let quantity = row
                    .try_column::<i64>("quantity")
                    .map_err(|_| "Failed to get quantity from loan item".to_string())?;

                loan_items.push(LoanItem {
                    id,
                    product_name,
                    quantity,
                    expiry: None,
                });
            }

            Ok(loan_items)
        })
    })
    .await
    .map_err(|e| e.to_string())?
}
