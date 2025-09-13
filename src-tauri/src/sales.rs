use crate::db::{get_db_config, ignore_empty_baton_commit, sql_quote};
use crate::stock::StockChange;
use libsql_client::Client;
use serde::{Deserialize, Serialize};
use tokio::task;
use uuid::Uuid;

#[derive(Debug, Deserialize, Serialize)]
pub struct SalesHeader {
    pub id: String,   // UUID from frontend
    pub date: String, // "YYYY-MM-DD"
    pub note: Option<String>,
}

pub async fn add_sale(changes: Vec<StockChange>, note: Option<String>) -> Result<(), String> {
    task::spawn_blocking(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async move {
            let config = get_db_config()
                .await
                .map_err(|e| e.to_string())?;
            let client = Client::from_config(config)
                .await
                .map_err(|e| e.to_string())?;

            // begin transaction
            let tx = client.transaction().await.map_err(|e| e.to_string())?;

            let sale_id = Uuid::new_v4().to_string();
            let note = note.unwrap_or_default();
            let date = chrono::Local::now().format("%Y-%m-%d").to_string();

            let header_sql = format!(
                "INSERT INTO SalesHeader (id, date, note) VALUES ('{}', '{}', '{}')",
                sql_quote(&sale_id),
                sql_quote(&date),
                sql_quote(&note)
            );
            tx.execute(header_sql).await.map_err(|e| e.to_string())?;

            for change in changes {
                let item_sql = format!(
                    "INSERT INTO SalesItem (id, sale_id, product_name, quantity) VALUES ('{}', '{}', '{}', {})",
                    sql_quote(&Uuid::new_v4().to_string()),
                    sql_quote(&sale_id),
                    sql_quote(&change.name),
                    change.qty
                );
                tx.execute(item_sql).await.map_err(|e| e.to_string())?;
            }

            // commit using the helper
            let res = tx.commit().await;
            ignore_empty_baton_commit(res)?;
            Ok(())
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_sale(sale_id: String) -> Result<(), String> {
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

            let sale_id_q = sql_quote(&sale_id);

            // 1. First delete the sale items (child records)
            let delete_items_sql =
                format!("DELETE FROM SalesItem WHERE sale_id = '{}';", sale_id_q);
            tx.execute(delete_items_sql)
                .await
                .map_err(|e| e.to_string())?;

            // 2. Then delete the sale header (parent record)
            let delete_header_sql = format!("DELETE FROM SalesHeader WHERE id = '{}';", sale_id_q);
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
pub async fn get_sales_history() -> Result<Vec<SalesHeader>, String> {
    task::spawn_blocking(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async move {
            let config = get_db_config().await.map_err(|e| e.to_string())?;
            let client = Client::from_config(config)
                .await
                .map_err(|e| e.to_string())?;

            // Query to get all sales headers ordered by date (newest first)
            let sql = r#"
                SELECT id, date, note
                FROM SalesHeader
                ORDER BY date DESC, id DESC
            "#;

            let result = client.execute(sql).await.map_err(|e| e.to_string())?;

            let mut sales_headers = Vec::new();

            for row in result.rows {
                let id = row
                    .try_column::<&str>("id")
                    .map_err(|_| "Failed to get id from sales header".to_string())?
                    .to_string();

                let date = row
                    .try_column::<&str>("date")
                    .map_err(|_| "Failed to get date from sales header".to_string())?
                    .to_string();

                let note = row.try_column::<&str>("note").ok().map(|s| s.to_string());

                sales_headers.push(SalesHeader { id, date, note });
            }

            Ok(sales_headers)
        })
    })
    .await
    .map_err(|e| e.to_string())?
}
