use libsql_client::Client;
use serde::{Deserialize, Serialize};
use tokio::task;
use uuid::Uuid;

use crate::db::{ignore_empty_baton_commit, sql_quote};
use crate::sales::add_sale;

#[derive(Debug, Serialize, Deserialize)]
pub struct StockChange {
    pub name: String,
    pub expiry_date: String,
    pub qty: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StockLot {
    pub expiry_date: String,
    pub qty: i64,
}

#[tauri::command]
pub async fn get_in_stock_products() -> Result<Vec<String>, String> {
    task::spawn_blocking(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async move {
            let config = crate::db::get_db_config()
                .await
                .map_err(|e| e.to_string())?;
            let client = Client::from_config(config)
                .await
                .map_err(|e| e.to_string())?;

            let sql =
                "SELECT DISTINCT name FROM Stock WHERE quantity > 0 ORDER BY name COLLATE NOCASE";
            let rows = client.execute(sql).await.map_err(|e| e.to_string())?.rows;

            let mut out = Vec::new();
            for r in rows {
                let name: String = r
                    .try_column::<&str>("name")
                    .map_err(|e| e.to_string())?
                    .to_string();
                if !name.is_empty() {
                    out.push(name);
                }
            }
            Ok(out)
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_stock_lots(name: String) -> Result<Vec<StockLot>, String> {
    task::spawn_blocking(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async move {
            // DB client
            let config = crate::db::get_db_config()
                .await
                .map_err(|e| e.to_string())?;
            let client = Client::from_config(config)
                .await
                .map_err(|e| e.to_string())?;

            let sql = format!(
                "SELECT expiry, quantity
                 FROM Stock
                 WHERE name = '{}' AND quantity > 0
                 ORDER BY expiry",
                sql_quote(&name)
            );

            let rows = client.execute(sql).await.map_err(|e| e.to_string())?.rows;

            let mut out = Vec::new();
            for r in rows {
                let expiry: String = r
                    .try_column::<&str>("expiry")
                    .map_err(|e| e.to_string())?
                    .to_string();
                let qty: i64 = r.try_column::<i64>("quantity").map_err(|e| e.to_string())?;

                out.push(StockLot {
                    expiry_date: expiry,
                    qty,
                });
            }

            Ok(out)
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn add_stock(changes: Vec<StockChange>) -> Result<(), String> {
    task::spawn_blocking(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async move {
            // get DB client
            let config = crate::db::get_db_config()
                .await
                .map_err(|e| e.to_string())?;
            let client = Client::from_config(config)
                .await
                .map_err(|e| e.to_string())?;
            for c in changes {
                if c.qty <= 0 {
                    return Err(format!("数量必须为正数：{} - {}", c.name, c.qty));
                }

                let id = Uuid::new_v4().to_string();
                let name = sql_quote(&c.name);
                let expiry = sql_quote(&c.expiry_date);

                let sql = format!(
                    "INSERT INTO Stock (id, name, expiry, quantity)
                     VALUES ('{}','{}','{}',{})
                     ON CONFLICT(name, expiry)
                     DO UPDATE SET quantity = Stock.quantity + excluded.quantity;",
                    sql_quote(&id),
                    name,
                    expiry,
                    c.qty
                );

                let res = client.execute(sql).await.map_err(|e| e.to_string())?;
                if res.rows_affected == 0 {
                    return Err("插入/更新失败：未影响任何行。".into());
                }
            }
            Ok(())
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn remove_stock(changes: Vec<StockChange>, mark_as_sale: bool) -> Result<(), String> {
    let changes = task::spawn_blocking(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async move {
            // 1) Connect
            let config = crate::db::get_db_config()
                .await
                .map_err(|e| e.to_string())?;
            let client = Client::from_config(config)
                .await
                .map_err(|e| e.to_string())?;

            // 2) Begin transaction (recommended pattern)
            let tx = client.transaction().await.map_err(|e| e.to_string())?;

            // 3) Validate & apply each change
            for c in &changes {
                if c.qty <= 0 {
                    // No need to explicitly rollback; not committing will abort the tx.
                    return Err(format!("数量必须为正数：{} - {}", c.name, c.qty));
                }

                let name = sql_quote(&c.name);
                let expiry = sql_quote(&c.expiry_date);

                // Check available
                let check_sql = format!(
                    "SELECT quantity AS quantity
                     FROM Stock
                     WHERE name = '{}' AND expiry = '{}'",
                    name, expiry
                );
                let rows = tx.execute(check_sql).await.map_err(|e| e.to_string())?.rows;

                let mut avail: i64 = 0;
                if let Some(row) = rows.into_iter().next() {
                    avail = row
                        .try_column::<i64>("quantity")
                        .map_err(|e| e.to_string())?;
                }

                if avail <= 0 {
                    return Err(format!("无库存：{} - {}", c.name, c.expiry_date));
                }
                if c.qty > avail {
                    return Err(format!(
                        "数量超出库存：{} {}（可用 {}）",
                        c.name, c.expiry_date, avail
                    ));
                }

                // Apply decrement
                let upd_sql = format!(
                    "UPDATE Stock
                     SET quantity = quantity - {}
                     WHERE name = '{}' AND expiry = '{}'",
                    c.qty, name, expiry
                );
                let upd_res = tx.execute(upd_sql).await.map_err(|e| e.to_string())?;
                if upd_res.rows_affected == 0 {
                    return Err("更新失败：未影响任何行。".into());
                }

                // Optional cleanup of zero/negative rows
                let del_sql = format!(
                    "DELETE FROM Stock
                     WHERE name = '{}' AND expiry = '{}' AND quantity <= 0",
                    name, expiry
                );
                tx.execute(del_sql).await.map_err(|e| e.to_string())?;
            }

            // 4) Commit, note we need to handle potential empty baton error message gracefully
            let commit_res = tx.commit().await;
            ignore_empty_baton_commit(commit_res)?;
            Ok(changes)
        })
    })
    .await
    .map_err(|e| e.to_string())??;

    if mark_as_sale {
        return add_sale(changes, None).await;
    } else {
        Ok(())
    }
}

#[tauri::command]
pub async fn edit_stock(name: String, expiry_date: String, quantity: i64) -> Result<(), String> {
    task::spawn_blocking(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async move {
            if quantity < 0 {
                return Err("数量不能为负数。".into());
            }

            let config = crate::db::get_db_config()
                .await
                .map_err(|e| e.to_string())?;
            let client = Client::from_config(config)
                .await
                .map_err(|e| e.to_string())?;

            // Enforce FKs per-connection (so invalid product names can't be inserted)
            client
                .execute("PRAGMA foreign_keys = ON;")
                .await
                .map_err(|e| e.to_string())?;

            let tx = client.transaction().await.map_err(|e| e.to_string())?;

            let name_q = sql_quote(&name);
            let expiry_q = sql_quote(&expiry_date);

            if quantity == 0 {
                // Remove the lot entirely when set to 0
                let del_sql = format!(
                    "DELETE FROM Stock WHERE name='{}' AND expiry='{}';",
                    name_q, expiry_q
                );
                tx.execute(del_sql).await.map_err(|e| e.to_string())?;
            } else {
                // Upsert to the exact quantity (requires UNIQUE(name,expiry) index you already have)
                let id = sql_quote(&Uuid::new_v4().to_string());
                let upsert_sql = format!(
                    "INSERT INTO Stock (id, name, expiry, quantity)
                     VALUES ('{}','{}','{}',{})
                     ON CONFLICT(name, expiry)
                     DO UPDATE SET quantity = excluded.quantity;",
                    id, name_q, expiry_q, quantity
                );
                let res = tx.execute(upsert_sql).await.map_err(|e| e.to_string())?;
                if res.rows_affected == 0 {
                    return Err("设置失败：未影响任何行。".into());
                }
            }

            let commit_res = tx.commit().await;
            ignore_empty_baton_commit(commit_res)?;
            Ok(())
        })
    })
    .await
    .map_err(|e| e.to_string())?
}
