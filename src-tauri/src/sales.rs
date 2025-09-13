use crate::db::{get_db_config, ignore_empty_baton_commit, sql_quote, to_sql_null_or_string};
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

#[derive(Debug, Deserialize, Serialize)]
pub struct SalesItem {
    pub id: String,
    pub product_name: String,
    pub quantity: i64,
    pub expiry: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct SalesSummary {
    pub header: SalesHeader,
    pub top_products: Vec<String>,
    pub total_value: i64,
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
                    "INSERT INTO SalesItem (id, sale_id, product_name, quantity, expiry) VALUES ('{}', '{}', '{}', {}, '{}')",
                    sql_quote(&Uuid::new_v4().to_string()),
                    sql_quote(&sale_id),
                    sql_quote(&change.name),
                    change.qty,
                    sql_quote(&change.expiry_date)
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
pub async fn update_sale(header: SalesHeader, items: Vec<SalesItem>) -> Result<(), String> {
    task::spawn_blocking(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async move {
            let config = get_db_config().await.map_err(|e| e.to_string())?;
            let client = Client::from_config(config)
                .await
                .map_err(|e| e.to_string())?;

            // Enable foreign keys
            client
                .execute("PRAGMA foreign_keys = ON;")
                .await
                .map_err(|e| e.to_string())?;

            // Begin transaction
            let tx = client.transaction().await.map_err(|e| e.to_string())?;

            let sale_id_q = sql_quote(&header.id);
            let date_q = sql_quote(&header.date);
            let note_sql = to_sql_null_or_string(&header.note);

            // 0. Verify all products exist
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

            // 1. Update sale header
            let update_header_sql = format!(
                "UPDATE SalesHeader SET date = '{}', note = {} WHERE id = '{}';",
                date_q, note_sql, sale_id_q
            );
            tx.execute(update_header_sql)
                .await
                .map_err(|e| e.to_string())?;

            // 2. Delete existing sale items
            let delete_items_sql =
                format!("DELETE FROM SalesItem WHERE sale_id = '{}';", sale_id_q);
            tx.execute(delete_items_sql)
                .await
                .map_err(|e| e.to_string())?;

            // 3. Insert new sale items
            for it in &items {
                let it_id_q = sql_quote(&it.id);
                let name_q = sql_quote(&it.product_name);
                let expiry_q = sql_quote(&it.expiry);
                let sql_item = format!(
                    "INSERT INTO SalesItem (id, sale_id, product_name, quantity, expiry)
                     VALUES ('{}', '{}', '{}', {}, '{}');",
                    it_id_q, sale_id_q, name_q, it.quantity, expiry_q
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
pub async fn get_sales_history() -> Result<Vec<SalesSummary>, String> {
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

            let mut sales_summary: Vec<SalesSummary> = Vec::new();

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

                // Fetch items for this sale, join with Product to get price
                let items_sql = format!(
                    r#"
                    SELECT i.product_name, SUM(i.quantity) as quantity, p.price
                    FROM SalesItem i
                    JOIN Product p ON i.product_name = p.name
                    WHERE i.sale_id = '{}'
                    GROUP BY i.product_name, p.price
                    ORDER BY quantity DESC
                    "#,
                    id
                );
                let items_result = client.execute(items_sql).await.map_err(|e| e.to_string())?;

                // Calculate total value and top 3 products
                let mut total_value = 0i64;
                let mut products: Vec<(String, i64)> = Vec::new();

                for item_row in items_result.rows {
                    let product_name = item_row
                        .try_column::<&str>("product_name")
                        .map_err(|_| "Failed to get product_name".to_string())?
                        .to_string();
                    let quantity = item_row
                        .try_column::<i64>("quantity")
                        .map_err(|_| "Failed to get quantity".to_string())?;
                    let price = item_row
                        .try_column::<i64>("price")
                        .map_err(|_| "Failed to get price".to_string())?;

                    total_value += quantity * price;
                    products.push((product_name, quantity));
                }

                // take top 3;
                let top_products: Vec<String> = products
                    .iter()
                    .take(3)
                    .map(|(name, _)| name.clone())
                    .collect();

                sales_summary.push(SalesSummary {
                    header: SalesHeader { id, date, note },
                    top_products,
                    total_value,
                });
            }

            Ok(sales_summary)
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_sales_items(sale_id: String) -> Result<Vec<SalesItem>, String> {
    task::spawn_blocking(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async move {
            let config = get_db_config().await.map_err(|e| e.to_string())?;
            let client = Client::from_config(config)
                .await
                .map_err(|e| e.to_string())?;

            // Query to get all items for a specific sale
            let sql = format!(
                r#"
                SELECT id, product_name, quantity, expiry
                FROM SalesItem
                WHERE sale_id = '{}'
                ORDER BY product_name
                "#,
                sql_quote(&sale_id)
            );

            let result = client.execute(sql).await.map_err(|e| e.to_string())?;

            let mut sales_items = Vec::new();

            for row in result.rows {
                let id = row
                    .try_column::<&str>("id")
                    .map_err(|_| "Failed to get id from sales item".to_string())?
                    .to_string();

                let product_name = row
                    .try_column::<&str>("product_name")
                    .map_err(|_| "Failed to get product_name from sales item".to_string())?
                    .to_string();

                let quantity = row
                    .try_column::<i64>("quantity")
                    .map_err(|_| "Failed to get quantity from sales item".to_string())?;

                let expiry = row
                    .try_column::<&str>("expiry")
                    .map_err(|_| "Failed to get expiry from sales item".to_string())?
                    .to_string();

                sales_items.push(SalesItem {
                    id,
                    product_name,
                    quantity,
                    expiry,
                });
            }

            Ok(sales_items)
        })
    })
    .await
    .map_err(|e| e.to_string())?
}
