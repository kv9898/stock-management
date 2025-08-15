use anyhow::Result;
use libsql_client::Client;
use serde::{Deserialize, Serialize};

use crate::db::get_db_config;

#[derive(Debug, Serialize, Deserialize)]
pub struct Product {
    pub name: String,
    pub expiry_days: i64,
}

#[tauri::command]
pub async fn get_all_products() -> Result<Vec<Product>, String> {
    let config = get_db_config().await.map_err(|e| e.to_string())?;
    let client = Client::from_config(config)
        .await
        .map_err(|e| e.to_string())?;

    let rows = client
        .execute("SELECT name, expiry_days, picture FROM Product")
        .await
        .map_err(|e| e.to_string())?;

    let mut products = vec![];
    for row in rows.rows {
        let name = row
            .try_column::<&str>("name")
            .map_err(|e| e.to_string())?
            .to_string();
        let expiry_days = row
            .try_column::<i64>("expiry_days")
            .map_err(|e| e.to_string())?;

        products.push(Product { name, expiry_days });
    }

    Ok(products)
}
