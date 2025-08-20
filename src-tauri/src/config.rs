use crate::db::verify_credentials;
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::fs::{create_dir_all, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::{OnceLock, RwLock, RwLockReadGuard, RwLockWriteGuard};
use tauri::path::BaseDirectory;
use tauri::Emitter;
use tauri::{App, AppHandle, Manager};
use tauri_plugin_fs::FsExt;
use url::Url;

// Default configs
pub static ALERT_PERIOD_DEFAULT: u16 = 180;

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

pub fn wire_verify_on_startup(app: &App) {
    let handle = app.handle().clone();

    if let Some(lock) = CONFIG.get() {
        // take a read lock to access fields
        let (url, token) = match lock.read() {
            Ok(cfg) => (cfg.url.clone(), cfg.token.clone()),
            Err(_) => {
                let _ = handle.emit("config:invalid", "Config lock poisoned");
                return;
            }
        };

        tauri::async_runtime::spawn(async move {
            if let Err(err_msg) = verify_credentials(url, token).await {
                let _ = handle.emit("config:invalid", err_msg);
            }
        });
    } else {
        // No config yet -> ask UI to open Settings
        let _ = app.emit("config:invalid", "Missing config".to_string());
    }
}

// Internal function to avoid cloning the lock guard unnecessarily
pub fn config() -> Result<RwLockReadGuard<'static, Config>> {
    let lock = CONFIG
        .get()
        .ok_or_else(|| anyhow!("Config not initialized"))?;
    lock.read().map_err(|_| anyhow!("config lock poisoned"))
}

/// Get a writable guard
pub fn config_mut() -> Result<RwLockWriteGuard<'static, Config>> {
    CONFIG
        .get()
        .ok_or_else(|| anyhow!("Config not initialized"))?
        .write()
        .map_err(|_| anyhow!("Config lock poisoned"))
}

#[tauri::command]
pub fn get_config() -> Result<Config, String> {
    let cfg = config().map_err(|e| e.to_string())?; // reuse internal helper
    Ok(cfg.clone()) // needs Config: Clone + Serialize
}

#[tauri::command]
pub fn write_config(handle: AppHandle, new_cfg: Config) -> Result<(), String> {
    // validate url before saving
    if let Err(e) = normalize_url(&new_cfg.url) {
        return Err(format!("Invalid URL: {e}"));
    }

    // TODO: add DB connection test here
    // if verify_db_connection(&new_cfg).is_err() { return Err("DB connection failed".into()); }

    // update in-memory
    {
        let mut cfg = config_mut().map_err(|e| e.to_string())?;
        *cfg = new_cfg.clone();
    }

    // persist to disk using plugin-fs
    let path = config_path(&handle).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(&new_cfg).map_err(|e| e.to_string())?;

    // make sure the directory exists
    if let Some(parent) = path.parent() {
        if let Err(e) = create_dir_all(parent) {
            return Err(format!(
                "Failed to create config dir {}: {e}",
                parent.display()
            ));
        }
    } else {
        return Err("Resolved config path has no parent directory".into());
    }

    // open with write+create+truncate
    // let mut opts = OpenOptions::new();
    // opts.write(true).create(true);

    // let mut file = handle
    //     .fs()
    //     .open(path.clone(), opts)
    //     .map_err(|e| format!("Failed to open config file: {e}"))?;

    let mut file = OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .open(&path)
        .map_err(|e| format!("Failed to open config file: {e}"))?;

    file.write_all(json.as_bytes())
        .map_err(|e| format!("Failed to write config: {e}"))?;

    Ok(())
}

#[tauri::command]
pub async fn get_alert_period() -> Result<u16, String> {
    let cfg = config().map_err(|e| e.to_string())?; // reuse internal helper
    Ok(cfg.alert_period)
}
