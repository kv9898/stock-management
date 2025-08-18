use anyhow::{anyhow, Result};
use once_cell::sync::OnceCell;
use std::collections::HashMap;
use tauri::path::BaseDirectory;
use tauri::{App, Manager};
use tauri_plugin_fs::FsExt;

pub struct Config {
    pub url: String,
    pub token: String,
    // pub alert_period: u16,
}

// Global, thread-safe, read-only once set
pub static CONFIG: OnceCell<Config> = OnceCell::new();

pub fn read_config(app: &App) -> Result<()> {
    // Resolve bundled resource path
    let path = app
        .path()
        .resolve("resources/config.json", BaseDirectory::Resource)
        .map_err(|e| anyhow!(e.to_string()))?;

    let content = app.handle().fs().read_to_string(path)?;
    let parsed: HashMap<String, String> = serde_json::from_str(&content)?;
    let url = parsed
        .get("URL")
        .ok_or_else(|| anyhow!("Missing URL"))?
        .to_string();
    let token = parsed
        .get("token")
        .ok_or_else(|| anyhow!("Missing token"))?
        .to_string();

    CONFIG
        .set(Config { url, token })
        .map_err(|_| anyhow!("Config already read"))?;
    Ok(())
}
