use anyhow::Result;
use base64::{engine::general_purpose, Engine as _};
use libsql_client::Client;
use serde::{Deserialize, Serialize};
use tokio::task;

use crate::db::{
    get_db_config, ignore_empty_baton_commit, sql_quote, to_sql_null_or_blob_hex,
    to_sql_null_or_int, to_sql_null_or_string,
};

#[derive(Debug, Serialize, Deserialize)]
pub struct Product {
    pub name: String,
    pub price: Option<i64>,
    pub picture: Option<String>,
    pub r#type: Option<String>,
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

            // Only fetch a tiny boolean-like flag for the picture
            let rows = client
                .execute(
                    "SELECT
                   name,
                   price,
                   type,
                   CASE
                     WHEN picture IS NULL OR length(picture) = 0 THEN 0
                     ELSE 1
                   END AS has_picture
                 FROM Product",
                )
                .await
                .map_err(|e| e.to_string())?;

            let mut products = vec![];
            for row in rows.rows {
                let name = row
                    .try_column::<&str>("name")
                    .map_err(|e| e.to_string())?
                    .to_string();

                let price: Option<i64> = match row.try_column::<i64>("price") {
                    Ok(v) => Some(v),
                    Err(e) => {
                        let msg = e.to_string();
                        if msg.to_lowercase().contains("null") {
                            None
                        } else {
                            return Err(msg);
                        }
                    }
                };

                let r#type = row.try_column::<&str>("type").ok().map(|s| s.to_string());

                // 0/1 flag -> Some("Yes") / None (so your existing TS type still works)
                let has_picture: i64 = row.try_column::<i64>("has_picture").unwrap_or(0);
                let picture = if has_picture != 0 {
                    Some("Yes".to_string())
                } else {
                    None
                };

                products.push(Product {
                    name,
                    price,
                    picture, // <- "Yes" or null
                    r#type,
                });
            }

            Ok(products)
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_product(name: String, price: Option<i64>) -> Result<Product, String> {
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
                "SELECT name, price, picture, type FROM Product WHERE name = '{}'",
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

            let actual_price: Option<i64> = match row.try_column::<i64>("price") {
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

            let r#type = row.try_column::<&str>("type").ok().map(|s| s.to_string());

            let picture = row
                .try_column::<&[u8]>("picture")
                .ok()
                .map(|bytes| general_purpose::STANDARD.encode(bytes));

            // validation
            if let Some(expected_days) = price {
                if Some(expected_days) != actual_price {
                    return Err(format!(
                        "有效期不匹配：传入为 {}，但数据库为 {}。",
                        expected_days,
                        actual_price
                            .map(|n| n.to_string())
                            .unwrap_or_else(|| "缺失".into())
                    ));
                }
            }

            Ok(Product {
                name: actual_name,
                price: actual_price,
                picture,
                r#type,
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
            // let transaction_used = client
            //     .execute(format!(
            //         "SELECT COUNT(*) as count FROM TransactionItem WHERE product_name = '{}'",
            //         name.replace('\'', "''") // escape single quotes
            //     ))
            //     .await
            //     .map_err(|e| e.to_string())?;

            // Extract counts
            let stock_count: i64 = stock_used
                .rows
                .get(0)
                .and_then(|r| r.try_column::<i64>("count").ok())
                .unwrap_or(0);
            let txn_count: i64 = 0; // Uncomment when TransactionItem is implemented
                                    // transaction_used
                                    // .rows
                                    // .get(0)
                                    // .and_then(|r| r.try_column::<i64>("count").ok())
                                    // .unwrap_or(0);

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

#[tauri::command]
pub async fn add_product(product: Product) -> Result<(), String> {
    task::spawn_blocking(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let config = crate::db::get_db_config()
                .await
                .map_err(|e| e.to_string())?;
            let client = Client::from_config(config)
                .await
                .map_err(|e| e.to_string())?;

            let name = sql_quote(&product.name);
            let price = to_sql_null_or_int(product.price);
            let picture_sql = to_sql_null_or_blob_hex(&product.picture)?;
            let type_sql = to_sql_null_or_string(&product.r#type);

            // Fail if exists (unique name)
            let insert_sql = format!(
                "INSERT INTO Product (name, price, picture, type) VALUES ('{}', {}, {}, {});",
                name, price, picture_sql, type_sql
            );

            let res = client
                .execute(insert_sql)
                .await
                .map_err(|e| e.to_string())?;

            // If your driver exposes rows_affected, you can check it:
            if res.rows_affected == 0 {
                return Err("插入失败：未影响任何行。".into());
            }

            Ok(())
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn update_product(product: Product, old_name: Option<String>) -> Result<(), String> {
    use crate::db::{
        get_db_config, sql_quote, to_sql_null_or_blob_hex, to_sql_null_or_int,
        to_sql_null_or_string,
    };
    use libsql_client::Client;
    use tokio::task;

    task::spawn_blocking(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async move {
            // 1) connect
            let config = get_db_config().await.map_err(|e| e.to_string())?;
            let client = Client::from_config(config)
                .await
                .map_err(|e| e.to_string())?;

            // IMPORTANT: enable FKs so ON UPDATE CASCADE fires
            client
                .execute("PRAGMA foreign_keys = ON;")
                .await
                .map_err(|e| e.to_string())?;

            // 2) begin tx
            let tx = client.transaction().await.map_err(|e| e.to_string())?;

            // normalize inputs
            let old = old_name.unwrap_or_else(|| product.name.clone());
            let old_q = sql_quote(&old);
            let new_q = sql_quote(&product.name);

            let price_sql = to_sql_null_or_int(product.price);
            let picture_sql = to_sql_null_or_blob_hex(&product.picture)?;
            let type_sql = to_sql_null_or_string(&product.r#type);

            // 3) checks inside the tx
            // ensure the original row exists
            let exists = tx
                .execute(format!(
                    "SELECT 1 FROM Product WHERE name='{}' LIMIT 1;",
                    old_q
                ))
                .await
                .map_err(|e| e.to_string())?;
            if exists.rows.is_empty() {
                // not committing aborts the tx
                return Err(format!("产品不存在：{}", old));
            }

            // if renaming, ensure target name not taken
            let is_renaming = new_q != old_q;
            if is_renaming {
                let dup = tx
                    .execute(format!(
                        "SELECT 1 FROM Product WHERE name='{}' LIMIT 1;",
                        new_q
                    ))
                    .await
                    .map_err(|e| e.to_string())?;
                if !dup.rows.is_empty() {
                    return Err(format!("产品名已存在：{}", product.name));
                }
            }

            // 4) perform update (rename triggers FK cascade to Stock.name)
            let sql = if is_renaming {
                format!(
                    "UPDATE Product
                       SET name='{}', price={}, picture={}, type={}
                     WHERE name='{}';",
                    new_q, price_sql, picture_sql, type_sql, old_q
                )
            } else {
                format!(
                    "UPDATE Product
                       SET price={}, picture={}, type={}
                     WHERE name='{}';",
                    price_sql, picture_sql, type_sql, old_q
                )
            };

            let res = tx.execute(sql).await.map_err(|e| e.to_string())?;
            if res.rows_affected == 0 {
                return Err("更新失败：未影响任何行。".into());
            }

            // 5) commit (use your helper if you have it)
            // If you have `ignore_empty_baton_commit`, use it like your example:
            // let commit_res = tx.commit().await;
            // ignore_empty_baton_commit(commit_res)?;
            let commit_res = tx.commit().await;
            ignore_empty_baton_commit(commit_res)?;
            Ok(())
        })
    })
    .await
    .map_err(|e| e.to_string())?
}
