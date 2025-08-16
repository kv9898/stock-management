use libsql_client::Client;
use serde::{Deserialize, Serialize};
use tokio::task;
use uuid::Uuid;

use crate::db::sql_quote;

#[derive(Debug, Serialize, Deserialize)]
pub struct StockChange {
    pub name: String,
    pub expiry_date: String,
    pub qty: i64,
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
