use libsql_client::Client;
use serde::{Deserialize, Serialize};
use tokio::task;
use uuid::Uuid;

use crate::db::sql_quote;

#[derive(Debug, Serialize, Deserialize)]
pub struct Product {
    pub name: String,
    pub expiry_date: String,
    pub qty: i64,
}

#[tauri::command]
pub async fn add_stock(products: Vec<Product>) -> Result<(), String> {
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

            // Start a transaction so the whole batch is atomic
            client.execute("BEGIN").await.map_err(|e| e.to_string())?;

            // If anything fails, make a best-effort rollback
            let res = async {
                for p in products {
                    if p.qty <= 0 {
                        return Err(format!("数量必须为正数：{} - {}", p.name, p.qty));
                    }

                    let name = sql_quote(&p.name);
                    let expiry = sql_quote(&p.expiry_date);

                    // Try to UPDATE an existing row
                    let update_sql = format!(
                        "UPDATE Stock SET quantity = quantity + {} WHERE name = '{}' AND expiry = '{}';",
                        p.qty, name, expiry
                    );
                    let upd = client.execute(update_sql).await.map_err(|e| e.to_string())?;

                    if upd.rows_affected == 0 {
                        // No such row -> INSERT a new one
                        let id = Uuid::new_v4().to_string();
                        let insert_sql = format!(
                            "INSERT INTO Stock (id, name, expiry, quantity) VALUES ('{}', '{}', '{}', {});",
                            sql_quote(&id), name, expiry, p.qty
                        );
                        let ins = client.execute(insert_sql).await.map_err(|e| e.to_string())?;
                        if ins.rows_affected == 0 {
                            return Err("插入失败：未影响任何行。".into());
                        }
                    }
                }
                Ok::<(), String>(())
            }.await;

            match res {
                Ok(()) => {
                    client.execute("COMMIT").await.map_err(|e| e.to_string())?;
                    Ok(())
                }
                Err(e) => {
                    let _ = client.execute("ROLLBACK").await;
                    Err(e)
                }
            }
        })
    })
    .await
    .map_err(|e| e.to_string())?
}
