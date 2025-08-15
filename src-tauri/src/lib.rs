mod db;
mod product;

#[tauri::command]
async fn get_all_products() -> Result<Vec<product::Product>, String> {
    product::get_all_products().await.map_err(|e| e.to_string())
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, get_all_products])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
