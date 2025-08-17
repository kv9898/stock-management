use crate::db::{get_db_config, sql_quote};
use libsql_client::Client;
use serde::{Deserialize, Serialize};
use tokio::task;

#[derive(Debug, Serialize, Deserialize)]
pub struct StockSummary {
    pub name: String,
    pub total_quantity: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExpiryBucket {
    pub expiry: String, // YYYY-MM-DD (from your schema)
    pub quantity: i64,
}

#[tauri::command]
pub async fn get_stock_overview() -> Result<Vec<StockSummary>, String> {
    task::spawn_blocking(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async move {
            let config = get_db_config().await.map_err(|e| e.to_string())?;
            let client = Client::from_config(config)
                .await
                .map_err(|e| e.to_string())?;

            // Show all products, including those with 0 stock
            let sql = r#"
                SELECT
                    p.name,
                    SUM(s.quantity) AS total_quantity
                FROM Product p
                JOIN Stock s ON s.name = p.name
                GROUP BY p.name
                HAVING SUM(COALESCE(s.quantity, 0)) > 0
                ORDER BY p.name COLLATE NOCASE;
            "#;

            let res = client.execute(sql).await.map_err(|e| e.to_string())?;
            let mut out = Vec::new();
            for row in res.rows {
                let name: String = row
                    .try_column::<&str>("name")
                    .map_err(|e| e.to_string())?
                    .to_string();
                let total_quantity: i64 = row.try_column::<i64>("total_quantity").unwrap_or(0);
                out.push(StockSummary {
                    name,
                    total_quantity,
                });
            }
            Ok(out)
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_stock_histogram(name: String) -> Result<Vec<ExpiryBucket>, String> {
    task::spawn_blocking(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async move {
            let config = get_db_config().await.map_err(|e| e.to_string())?;
            let client = Client::from_config(config)
                .await
                .map_err(|e| e.to_string())?;

            let name_q = sql_quote(&name);
            let sql = format!(
                "SELECT expiry, SUM(quantity) AS quantity
                 FROM Stock
                 WHERE name = '{}'
                 GROUP BY expiry
                 ORDER BY expiry;",
                name_q
            );

            let res = client.execute(sql).await.map_err(|e| e.to_string())?;
            let mut out = Vec::new();
            for row in res.rows {
                let expiry: String = row
                    .try_column::<&str>("expiry")
                    .map_err(|e| e.to_string())?
                    .to_string();
                let quantity: i64 = row.try_column::<i64>("quantity").unwrap_or(0);
                out.push(ExpiryBucket { expiry, quantity });
            }
            Ok(out)
        })
    })
    .await
    .map_err(|e| e.to_string())?
}
