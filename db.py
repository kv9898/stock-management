from libsql_client import create_client
import json

# Load database URL and tokens from JSON
with open("src-tauri/resources/tokens.json", "r") as f:
    db_url, auth_token = json.load(f).values()

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

# # Transactions

# ## Header table
# create_transaction_header = """
# CREATE TABLE IF NOT EXISTS TransactionHeader (
#   id TEXT PRIMARY KEY NOT NULL,
#   date TEXT NOT NULL,
#   type TEXT CHECK(type IN ('buy', 'sell')) NOT NULL,
#   total_amount INTEGER
# );
# """
# await client.execute(create_transaction_header)

# ## Detail table
# create_transaction_detail = """
# CREATE TABLE TransactionItem (
#   id TEXT PRIMARY KEY NOT NULL,
#   transaction_id TEXT NOT NULL,
#   product_name TEXT NOT NULL,
#   quantity INTEGER NOT NULL,

#   FOREIGN KEY (transaction_id) REFERENCES TransactionHeader(id),
#   FOREIGN KEY (product_name) REFERENCES Product(name)
# );
# """
# await client.execute(create_transaction_detail)
