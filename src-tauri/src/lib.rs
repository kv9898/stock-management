mod db;
mod product;

use db::init_db_tokens;
use product::{add_product, delete_product, get_all_products, get_product, update_product};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            init_db_tokens(app)?;
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_all_products,
            get_product,
            delete_product,
            add_product,
            update_product
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
