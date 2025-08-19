// src-tauri/src/db.rs
use crate::config::config;
use anyhow::Result;
use base64::{engine::general_purpose, Engine as _};
use libsql_client::{Client, Config};
use std::fmt::Display;

pub async fn get_db_config() -> Result<Config> {
    let conf = config()?;

    let client_config = Config::new(conf.url.as_str())?.with_auth_token(&conf.token);
    Ok(client_config)
}

pub async fn verify_db_connection(url: String, token: String) -> Result<()> {
    let conf = Config::new(url.as_str())?.with_auth_token(&token);
    let client = Client::from_config(conf).await?;

    client.execute("SELECT 1").await?;
    Ok(())
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

/// libsql sometimes returns this *exact* message even when the server committed.
pub const EMPTY_BATON_MSG: &str = "Stream closed: server returned empty baton";

/// If `res` is `Err` with the exact empty-baton message, log and return Ok(()),
/// otherwise propagate the error as String.
pub fn ignore_empty_baton_commit<E: Display>(res: Result<(), E>) -> Result<(), String> {
    match res {
        Ok(()) => Ok(()),
        Err(e) => {
            let msg = e.to_string();
            if msg == EMPTY_BATON_MSG {
                eprintln!("[DB][commit_ignore] ignored: {}", msg);
                Ok(())
            } else {
                Err(msg)
            }
        }
    }
}
