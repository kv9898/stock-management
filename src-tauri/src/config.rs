use anyhow::{anyhow, Result};
use serde::Serialize;
use std::sync::{OnceLock, RwLock, RwLockReadGuard};
use tauri::path::BaseDirectory;
use tauri::{App, Manager};
use tauri_plugin_fs::FsExt;
use url::Url;

#[derive(Clone, Serialize)]
pub struct Config {
    pub url: String,
    pub token: String,
    pub alert_period: u16,
}

// Global, thread-safe, read-only once set
pub static CONFIG: OnceLock<RwLock<Config>> = OnceLock::new();

fn normalize_url(s: &str) -> Result<String> {
    let with_scheme = if s.contains("://") {
        s.to_owned()
    } else {
        format!("libsql://{s}")
    };
    let url = Url::parse(&with_scheme).map_err(|e| anyhow!("Invalid URL: {with_scheme} ({e})"))?;
    Ok(url.into())
}

pub fn read_config(app: &App) -> Result<()> {
    // Resolve bundled resource path
    let path = app
        .path()
        .resolve("resources/config.json", BaseDirectory::Resource)
        .map_err(|e| anyhow!(e.to_string()))?;

    let content = app.handle().fs().read_to_string(path)?;
    let parsed: serde_json::Value = serde_json::from_str(&content)?;

    let url = parsed
        .get("URL")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("Missing URL"))?
        .to_string();
    let url = normalize_url(&url)?;

    let token = parsed
        .get("token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("Missing token"))?
        .to_string();
    let alert_period = parsed
        .get("alert_period")
        .ok_or_else(|| anyhow!("Missing alert_period"))?
        .as_u64()
        .ok_or_else(|| anyhow!("alert_period must be a positive integer"))?
        as u16;

    let cfg = RwLock::new(Config {
        url,
        token,
        alert_period,
    });

    CONFIG
        .set(cfg)
        .map_err(|_| anyhow!("Config already read"))?;
    Ok(())
}

// Internal function to avoid cloning the lock guard unnecessarily
pub fn config() -> Result<RwLockReadGuard<'static, Config>> {
    let lock = CONFIG
        .get()
        .ok_or_else(|| anyhow!("Config not initialized"))?;
    lock.read().map_err(|_| anyhow!("config lock poisoned"))
}

#[tauri::command]
pub fn get_config() -> Result<Config, String> {
    let cfg = config().map_err(|e| e.to_string())?; // reuse internal helper
    Ok(cfg.clone()) // needs Config: Clone + Serialize
}

// #[tauri::command]
// pub fn write_config(handle: tauri::AppHandle, config: Config) -> Result<()> {
//     CONFIG.set()
// }
