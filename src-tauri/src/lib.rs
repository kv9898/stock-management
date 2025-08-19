mod config;
mod db;
mod loan;
mod product;
mod stock;
mod summary;

use config::{get_alert_period, get_config, init_config, wire_verify_on_startup, write_config};
use db::verify_credentials;
use product::{add_product, delete_product, get_all_products, get_product, update_product};
use stock::{add_stock, edit_stock, get_in_stock_products, get_stock_lots, remove_stock};
use summary::{get_stock_histogram, get_stock_overview};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            init_config(app)?;
            wire_verify_on_startup(app);
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_all_products,
            get_product,
            delete_product,
            add_product,
            update_product,
            add_stock,
            remove_stock,
            edit_stock,
            get_in_stock_products,
            get_stock_lots,
            get_stock_overview,
            get_stock_histogram,
            get_config,
            write_config,
            get_alert_period,
            verify_credentials,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
