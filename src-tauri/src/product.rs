use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

use crate::db::get_db_client;

#[derive(Debug, Serialize, Deserialize)]
pub struct Product {
    pub name: String,
    pub expiry_days: i64,
}

pub async fn get_all_products() -> Result<Vec<Product>> {
    let client = get_db_client().await?;

    let rows = client
        .execute("SELECT name, expiry_days, picture FROM Product")
        .await?;

    let mut products = vec![];
    for row in rows.rows {
        let name = row.try_column::<&str>("name")?.to_string();
        let expiry_days = row.try_column::<i64>("expiry_days")?;

        products.push(Product { name, expiry_days });
    }

    Ok(products)
}
