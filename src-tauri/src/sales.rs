use crate::db::sql_quote;
use crate::stock::StockChange;
use libsql_client::Client;
use uuid::Uuid;

pub async fn add_sale(changes: &Vec<StockChange>, note: Option<String>) -> Result<(), String> {
    // task::spawn_blocking(move || {
    //     let rt = tokio::runtime::Runtime::new().unwrap();
    //     rt.block_on(async move {
    let config = crate::db::get_db_config()
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

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
    //     })
    // })
    // .await
    // .map_err(|e| e.to_string())?;
}
