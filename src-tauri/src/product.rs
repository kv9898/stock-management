use anyhow::Result;
use libsql_client::Client;
use serde::{Deserialize, Serialize};
use tokio::task;

use crate::db::get_db_config;

#[derive(Debug, Serialize, Deserialize)]
pub struct Product {
    pub name: String,
    pub shelf_life_days: i64,
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
                let shelf_life_days = row
                    .try_column::<i64>("shelf_life_days")
                    .map_err(|e| e.to_string())?;
                products.push(Product {
                    name,
                    shelf_life_days,
                });
            }

            Ok(products)
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_product(name: String) -> Result<(), String> {
    let config = get_db_config().await.map_err(|e| e.to_string())?;
    let client = Client::from_config(config)
        .await
        .map_err(|e| e.to_string())?;

    // Check usage
    let stock_used = client
        .execute(format!(
            "SELECT COUNT(*) as count FROM Stock WHERE product_name = '{}'",
            name.replace('\'', "''") // escape single quotes
        ))
        .await
        .map_err(|e| e.to_string())?;
    let transaction_used = client
        .execute(format!(
            "SELECT COUNT(*) as count FROM TransactionItem WHERE product_name = '{}'",
            name.replace('\'', "''") // escape single quotes
        ))
        .await
        .map_err(|e| e.to_string())?;

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

    if stock_count > 0 || txn_count > 0 {
        return Err("Product is used in stock or transactions.".into());
    }

    // Safe to delete
    client
        .execute("DELETE FROM Product WHERE name = ?", &[&name])
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
