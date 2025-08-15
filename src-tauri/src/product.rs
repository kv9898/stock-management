use anyhow::Result;
use base64::{engine::general_purpose, Engine as _};
use libsql_client::Client;
use serde::{Deserialize, Serialize};
use tokio::task;

use crate::db::get_db_config;

#[derive(Debug, Serialize, Deserialize)]
pub struct Product {
    pub name: String,
    pub shelf_life_days: Option<i64>,
    pub picture: Option<String>,
}

#[tauri::command]
pub async fn get_all_products() -> Result<Vec<Product>, String> {
    task::spawn_blocking(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let config = get_db_config().await.map_err(|e| e.to_string())?;
            let client = Client::from_config(config)
                .await
                .map_err(|e| e.to_string())?;

            let rows = client
                .execute("SELECT name, shelf_life_days FROM Product")
                .await
                .map_err(|e| e.to_string())?;

            let mut products = vec![];
            for row in rows.rows {
                let name = row
                    .try_column::<&str>("name")
                    .map_err(|e| e.to_string())?
                    .to_string();
                let shelf_life_days: Option<i64> = match row.try_column::<i64>("shelf_life_days") {
                    Ok(val) => Some(val),
                    Err(e) => {
                        let msg = e.to_string();
                        if msg.to_lowercase().contains("null") {
                            None
                        } else {
                            return Err(msg); // wrong type / other error
                        }
                    }
                };
                products.push(Product {
                    name,
                    shelf_life_days,
                    picture: None, // Picture is not fetched here, set to None
                });
            }

            Ok(products)
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_product(name: String, shelf_life_days: Option<i64>) -> Result<Product, String> {
    task::spawn_blocking(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let config = get_db_config().await.map_err(|e| e.to_string())?;
            let client = Client::from_config(config)
                .await
                .map_err(|e| e.to_string())?;

            // Escape name to avoid SQL injection
            let escaped_name = name.replace('\'', "''");

            let query = format!(
                "SELECT name, shelf_life_days, picture FROM Product WHERE name = '{}'",
                escaped_name
            );

            let result = client.execute(query).await.map_err(|e| e.to_string())?;

            let row = result
                .rows
                .get(0)
                .ok_or_else(|| format!("未找到产品：{}", name))?;

            let actual_name = row
                .try_column::<&str>("name")
                .map_err(|e| e.to_string())?
                .to_string();

            let actual_shelf_life_days: Option<i64> = match row.try_column::<i64>("shelf_life_days")
            {
                Ok(val) => Some(val),
                Err(e) => {
                    let msg = e.to_string();
                    if msg.to_lowercase().contains("null") {
                        None
                    } else {
                        return Err(msg);
                    }
                }
            };

            let picture = row
                .try_column::<&[u8]>("picture")
                .ok()
                .map(|bytes| general_purpose::STANDARD.encode(bytes));

            // validation
            if let Some(expected_days) = shelf_life_days {
                if Some(expected_days) != actual_shelf_life_days {
                    return Err(format!(
                        "有效期不匹配：传入为 {}，但数据库为 {}。",
                        expected_days,
                        actual_shelf_life_days
                            .map(|n| n.to_string())
                            .unwrap_or_else(|| "缺失".into())
                    ));
                }
            }

            Ok(Product {
                name: actual_name,
                shelf_life_days: actual_shelf_life_days,
                picture,
            })
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_product(name: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async move {
            let config = get_db_config().await.map_err(|e| e.to_string())?;
            let client = Client::from_config(config)
                .await
                .map_err(|e| e.to_string())?;

            // Check usage in Stock
            let stock_used = client
                .execute(format!(
                    "SELECT COUNT(*) as count FROM Stock WHERE name = '{}'",
                    name.replace('\'', "''") // escape single quotes
                ))
                .await
                .map_err(|e| e.to_string())?;

            // Check usage in TransactionItem
            let transaction_used = client
                .execute(format!(
                    "SELECT COUNT(*) as count FROM TransactionItem WHERE product_name = '{}'",
                    name.replace('\'', "''") // escape single quotes
                ))
                .await
                .map_err(|e| e.to_string())?;

            // Extract counts
            let stock_count: i64 = stock_used
                .rows
                .get(0)
                .and_then(|r| r.try_column::<i64>("count").ok())
                .unwrap_or(0);
            let txn_count: i64 = transaction_used
                .rows
                .get(0)
                .and_then(|r| r.try_column::<i64>("count").ok())
                .unwrap_or(0);

            // Check usage status
            if stock_count > 0 || txn_count > 0 {
                let mut reasons = vec![];

                if stock_count > 0 {
                    reasons.push("库存");
                }
                if txn_count > 0 {
                    reasons.push("交易记录");
                }

                let msg = format!(
                    "无法删除产品 “{}”：该产品已被使用于{}。",
                    name,
                    reasons.join("和")
                );
                return Err(msg.into());
            }

            // Safe to delete
            client
                .execute(format!(
                    "DELETE FROM Product WHERE name = '{}'",
                    name.replace('\'', "''")
                ))
                .await
                .map_err(|e| e.to_string())?;

            Ok(())
        })
    })
    .await
    .map_err(|e| e.to_string())?
}
