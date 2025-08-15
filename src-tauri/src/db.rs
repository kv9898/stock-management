// src-tauri/src/db.rs
use libsql_client::{Client, Config};
use std::collections::HashMap;
use std::fs;

pub async fn get_db_client() -> Result<Client, String> {
    let file_content = fs::read_to_string("tokens.json").map_err(|e| e.to_string())?;
    let parsed: HashMap<String, String> =
        serde_json::from_str(&file_content).map_err(|e| e.to_string())?;

    let db_url = parsed.get("URL").ok_or("Missing db_url")?;
    let auth_token = parsed.get("token").ok_or("Missing auth_token")?;

    let config = Config::new(db_url.as_str())
        .map_err(|e| e.to_string())?
        .with_auth_token(auth_token);
    return Client::from_config(config).await.map_err(|e| e.to_string());
}
