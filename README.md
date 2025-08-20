# Stock Management System

A modern desktop application built with Tauri, React, and TypeScript for managing inventory, tracking stock values, and monitoring product expiry dates.

## 🚀 Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Rust + Tauri
- **Database**: Turso (LibSQL) - Serverless SQLite
- **Styling**: CSS Modules
- **Icons**: Lucide React

## 📋 Features

- **Inventory Management**: Track stock quantities, expiry dates, and product details
- **Value Dashboard**: Real-time financial overview with categorized stock values
- **Expiry Monitoring**: Automatic alerts for expiring and expired products
- **Product Catalog**: Manage product information and pricing
- **Loan Tracking**: Track borrow/return transactions (net loan value)
- **Responsive UI**: Clean, modern interface with real-time updates

## 🛠️ Configuration

### Database Setup (Turso)

The application uses **Turso** (LibSQL) as its database backend. To set up:

1. **Create a Turso database**:
   Go to [https://app.turso.tech/](https://app.turso.tech/) and create a new database, which is Free!

   Note the database URL and token provided after creation, as you'll need them for configuration.

2. **Configure app settings**:
   Open the stock manager app. Upon first launch, you'll be prompted to enter your Turso database URL and token. This will be saved in local storage (AppConfig) for future use.

3. **Create data tables**:
   Run the `db.py` script in an interactive console (because `async` is used). This script will read the database URL and token from storage and use them to create the necessary tables in the database. Main dependency used here is the `libsql_client` package.

   You may also use other libsql clients and run the SQL commands from `db.py` manually if you prefer.
