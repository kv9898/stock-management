// src-tauri/src/db.rs
use anyhow::{anyhow, Result};
use base64::{engine::general_purpose, Engine as _};
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
