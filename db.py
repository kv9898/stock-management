from libsql_client import create_client
import os
import sys
import json
from pathlib import Path

APP_IDENTIFIER = "com.dianyi.stock-manager"  # your tauri identifier
APP_NAME = "stock-manager"                   # your productName
CONFIG_FILE = "config.json"

def tauri_app_config_dirs() -> list[Path]:
    home = Path.home()
    if sys.platform.startswith("win"):
        base = Path(os.environ.get("APPDATA", home / "AppData" / "Roaming"))
        return [base / APP_IDENTIFIER, base / APP_NAME]
    elif sys.platform == "darwin":
        base = home / "Library" / "Application Support"
        return [base / APP_IDENTIFIER, base / APP_NAME]
    else:  # Linux / BSD
        base = Path(os.environ.get("XDG_CONFIG_HOME", home / ".config"))
        return [base / APP_IDENTIFIER, base / APP_NAME]

def load_db_creds() -> tuple[str, str]:
    # Look for config.json in the likely AppConfig locations
    for d in tauri_app_config_dirs():
        p = d / CONFIG_FILE
        if p.exists():
            with p.open("r", encoding="utf-8") as f:
                data = json.load(f)
            db_url = data.get("url")
            auth_token = data.get("token")
            if not db_url or not auth_token:
                raise ValueError(f"Config missing url/token in {p}")
            return db_url, auth_token

    raise FileNotFoundError(
        "config.json not found in AppConfig dirs: " +
        ", ".join(str(d / CONFIG_FILE) for d in tauri_app_config_dirs())
    )

# Load database URL and tokens from JSON
db_url, auth_token = load_db_creds()

if db_url.startswith("libsql://"):
    db_url = db_url.replace("libsql://", "https://")

# Connect to the Turso database
client = create_client(url=db_url, auth_token=auth_token)

# Turn on FK enforcement for THIS connection (safe; no data change)
await client.execute("PRAGMA foreign_keys = ON;")

# create the Product table
create_table_sql = """
CREATE TABLE IF NOT EXISTS Product (
    name TEXT PRIMARY KEY NOT NULL,
    price INTEGER,
    picture BLOB,
    type TEXT
);
"""
await client.execute(create_table_sql)

# Create the Stock table if it doesn't exist
stock_sql = """
CREATE TABLE IF NOT EXISTS Stock (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  expiry TEXT NOT NULL,
  quantity INTEGER DEFAULT 0,
  FOREIGN KEY (name) REFERENCES Product(name)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);
"""
await client.execute(stock_sql)

  ## make sure that the pair (name, expiry) is unique in this table.
await client.execute("CREATE UNIQUE INDEX IF NOT EXISTS stock_name_expiry_uq ON Stock(name, expiry);")

# Borrowing / Lending

## Header table
create_loan_header = """
CREATE TABLE IF NOT EXISTS LoanHeader (
  id           TEXT PRIMARY KEY NOT NULL,                               -- e.g. UUID
  date         TEXT NOT NULL,                                           -- YYYY-MM-DD
  direction    TEXT NOT NULL CHECK(direction IN
                   ('loan_in','loan_out','return_in','return_out')),
  counterparty TEXT NOT NULL,                                           -- person/company
  note         TEXT                                                     -- optional
);
"""
await client.execute(create_loan_header)

## Item table
create_loan_item = """
CREATE TABLE IF NOT EXISTS LoanItem (
  id            TEXT PRIMARY KEY NOT NULL,                              -- e.g. UUID
  loan_id       TEXT NOT NULL,
  product_name  TEXT NOT NULL,
  quantity      INTEGER NOT NULL CHECK(quantity > 0),

  FOREIGN KEY (loan_id)      REFERENCES LoanHeader(id) ON DELETE CASCADE,
  FOREIGN KEY (product_name) REFERENCES Product(name)
);
"""
await client.execute(create_loan_item)

## Helpful indexes to speed up queries
stmts = [
    "CREATE INDEX IF NOT EXISTS idx_loanheader_date         ON LoanHeader(date)",
    "CREATE INDEX IF NOT EXISTS idx_loanheader_counterparty ON LoanHeader(counterparty)",
    "CREATE INDEX IF NOT EXISTS idx_loanheader_direction    ON LoanHeader(direction)",
    "CREATE INDEX IF NOT EXISTS idx_loanitem_loan_id        ON LoanItem(loan_id)",
    "CREATE INDEX IF NOT EXISTS idx_loanitem_product_name   ON LoanItem(product_name)",
]
await client.batch(stmts)

