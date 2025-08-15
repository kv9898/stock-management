// src-tauri/src/db.rs
use anyhow::{anyhow, Result};
use libsql_client::Config;
use std::collections::HashMap;
use std::fs;

pub async fn get_db_config() -> Result<Config> {
    let file_content = fs::read_to_string("tokens.json")?;
    let parsed: HashMap<String, String> = serde_json::from_str(&file_content)?;

    let db_url = parsed.get("URL").ok_or_else(|| anyhow!("Missing db_url"))?;
    let auth_token = parsed
        .get("token")
        .ok_or_else(|| anyhow!("Missing auth_token"))?;

    let config = Config::new(db_url.as_str())?.with_auth_token(auth_token);
    Ok(config)
}
