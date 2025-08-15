// src-tauri/src/db.rs
use anyhow::{anyhow, Result};
use base64::{engine::general_purpose, Engine as _};
use libsql_client::Config;
use once_cell::sync::OnceCell;
use std::collections::HashMap;
use std::fs;
use tauri::path::BaseDirectory;
use tauri::{App, Manager};

// Global, thread-safe, read-only once set
pub static DB_TOKENS: OnceCell<(String, String)> = OnceCell::new();

pub fn init_db_tokens(app: &App) -> Result<()> {
    // Resolve bundled resource path
    let path = app
        .path()
        .resolve("resources/tokens.json", BaseDirectory::Resource)
        .map_err(|e| anyhow!(e.to_string()))?;

    let content = fs::read_to_string(&path)?;
    let parsed: HashMap<String, String> = serde_json::from_str(&content)?;
    let url = parsed
        .get("URL")
        .ok_or_else(|| anyhow!("Missing URL"))?
        .to_string();
    let token = parsed
        .get("token")
        .ok_or_else(|| anyhow!("Missing token"))?
        .to_string();

    DB_TOKENS
        .set((url, token))
        .map_err(|_| anyhow!("DB tokens already set"))?;
    Ok(())
}

pub async fn get_db_config() -> Result<Config> {
    let (url, token) = DB_TOKENS
        .get()
        .ok_or_else(|| anyhow!("DB tokens not initialized"))?;

    let config = Config::new(url.as_str())?.with_auth_token(token);
    Ok(config)
}

pub fn sql_quote(s: &str) -> String {
    s.replace('\'', "''")
}

pub fn to_sql_null_or_int(v: Option<i64>) -> String {
    match v {
        Some(n) => n.to_string(),
        None => "NULL".to_string(),
    }
}

pub fn to_sql_null_or_blob_hex(base64_opt: &Option<String>) -> Result<String, String> {
    match base64_opt {
        None => Ok("NULL".to_string()),
        Some(b64) => {
            if b64.is_empty() {
                return Ok("NULL".to_string());
            }
            let bytes = general_purpose::STANDARD
                .decode(b64)
                .map_err(|e| format!("无效的图片（Base64 解码失败）：{}", e))?;
            // Hex → X'...'
            let mut hex = String::with_capacity(bytes.len() * 2);
            for b in &bytes {
                use std::fmt::Write;
                write!(&mut hex, "{:02x}", b).unwrap();
            }
            Ok(format!("X'{}'", hex))
        }
    }
}

pub fn to_sql_null_or_string(v: &Option<String>) -> String {
    match v.as_deref() {
        None => "NULL".to_string(),
        Some(s) if s.trim().is_empty() => "NULL".to_string(),
        Some(s) => format!("'{}'", sql_quote(s)),
    }
}
