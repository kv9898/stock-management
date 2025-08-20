use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub total_sellable_value: f32,
    pub expiring_soon_value: f32,
    pub expired_value: f32,
    pub net_loan_value: f32,
}

#[tauri::command]
pub async fn get_dashboard_summary() -> Result<Config, String> {
    // Dummy implementation, replace with actual logic to compute values
    Ok(Config {
        total_sellable_value: 271658.94,
        expiring_soon_value: 751254.98,
        expired_value: 15124.31,
        net_loan_value: -5214.36,
    })
}
