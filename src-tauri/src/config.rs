use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::sync::{OnceLock, RwLock, RwLockReadGuard};
use tauri::path::BaseDirectory;
use tauri::{App, AppHandle, Manager};
use tauri_plugin_fs::FsExt;
use url::Url;

#[derive(Debug, Clone, Serialize, Deserialize)]
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

/// Return appConfig path to config.json
fn config_path(app: &AppHandle) -> Result<PathBuf> {
    app.path()
        .resolve("config.json", BaseDirectory::AppConfig)
        .map_err(|e| anyhow!(e.to_string()))
}

pub fn init_config(app: &App) -> Result<()> {
    let path = config_path(&app.handle())?;

    let cfg: Config = if path.exists() {
        let content = app.handle().fs().read_to_string(&path)?;
        serde_json::from_str(&content)?
    } else {
        Config {
            url: "".into(),
            token: "".into(),
            alert_period: ALERT_PERIOD_DEFAULT,
        }
    };

    CONFIG
        .set(RwLock::new(cfg))
        .map_err(|_| anyhow!("Config already set"))?;
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

#[tauri::command]
pub fn write_config(_handle: AppHandle, config: Config) -> Result<(), String> {
    // Just stringify the config and return it as an error
    Err(format!("Not implemented. Received config: {:?}", config))
}
