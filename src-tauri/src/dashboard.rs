use crate::config::get_alert_period;
use crate::db::get_db_config;
use libsql_client::Client;
use serde::{Deserialize, Serialize};
use tokio::task;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub total_sellable_value: f64,
    pub expiring_soon_value: f64,
    pub expired_value: f64,
    pub net_loan_value: f64,
}

#[tauri::command]
pub async fn get_dashboard_summary() -> Result<Config, String> {
    task::spawn_blocking(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async move {
            let alert_period = get_alert_period().await?;
            let config = get_db_config().await.map_err(|e| e.to_string())?;
            let client = Client::from_config(config)
                .await
                .map_err(|e| e.to_string())?;

            // Calculate total values by expiry status
            let sql = format!(
                r#"
                SELECT
                (SUM(
                    CASE
                    WHEN s.expiry IS NULL OR DATE(s.expiry) >= DATE('now')
                    THEN COALESCE(s.quantity, 0) * COALESCE((SELECT price FROM Product WHERE name = s.name), 0)
                    ELSE 0
                    END
                ) * 1.0) AS total_sellable_value,

                (SUM(
                    CASE
                    WHEN s.expiry IS NOT NULL
                    AND DATE(s.expiry) >= DATE('now')
                    AND DATE(s.expiry) < DATE('now', '+{} day')
                    THEN COALESCE(s.quantity, 0) * COALESCE((SELECT price FROM Product WHERE name = s.name), 0)
                    ELSE 0
                    END
                ) * 1.0) AS expiring_soon_value,

                (SUM(
                    CASE
                    WHEN s.expiry IS NOT NULL
                    AND DATE(s.expiry) < DATE('now')
                    THEN COALESCE(s.quantity, 0) * COALESCE((SELECT price FROM Product WHERE name = s.name), 0)
                    ELSE 0
                    END
                ) * 1.0) AS expired_value
                FROM Stock s
                WHERE s.quantity > 0
                "#,
                alert_period
            );

            let result = client.execute(sql).await.map_err(|e| e.to_string())?;

            let row = result.rows.get(0).ok_or("No data found")?;

            let total_sellable_value: f64 = row.try_column::<f64>("total_sellable_value").unwrap_or(0.0);
            println!("Total Sellable Value: {}", total_sellable_value);

            let expiring_soon_value: f64 =
                row.try_column::<f64>("expiring_soon_value").unwrap_or(0.0);
            println!("Expiring Soon Value: {}", expiring_soon_value);

            let expired_value: f64 = row.try_column::<f64>("expired_value").unwrap_or(0.0);
            println!("Expired Value: {}", expired_value);

            Ok(Config {
                total_sellable_value,
                expiring_soon_value,
                expired_value,
                net_loan_value: -5142.35, // TODO: Calculate actual net loan value
            })
        })
    })
    .await
    .map_err(|e| e.to_string())?
}
