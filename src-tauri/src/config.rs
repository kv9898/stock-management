use anyhow::{anyhow, Result};
use once_cell::sync::OnceCell;
use tauri::path::BaseDirectory;
use tauri::{App, Manager};
use tauri_plugin_fs::FsExt;
use url::Url;

pub struct Config {
    pub url: String,
    pub token: String,
    pub alert_period: u16,
}

// Global, thread-safe, read-only once set
pub static CONFIG: OnceCell<Config> = OnceCell::new();

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

    CONFIG
        .set(Config {
            url,
            token,
            alert_period,
        })
        .map_err(|_| anyhow!("Config already read"))?;
    Ok(())
}
