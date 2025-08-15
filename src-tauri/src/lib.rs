mod db;
mod product;

use product::{delete_product, get_all_products, get_product};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            delete_product,
            get_all_products,
            get_product
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
