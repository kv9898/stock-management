from libsql_client import create_client
import os
import sys
import json
import polars as pl
from pathlib import Path

APP_IDENTIFIER = "com.dianyi.stock-manager"  # your tauri identifier
APP_NAME = "stock-manager"  # your productName
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
        "config.json not found in AppConfig dirs: "
        + ", ".join(str(d / CONFIG_FILE) for d in tauri_app_config_dirs())
    )


# Load database URL and tokens from JSON
db_url, auth_token = load_db_creds()

if db_url.startswith("libsql://"):
    db_url = db_url.replace("libsql://", "https://")

# Connect to the Turso database
client = create_client(url=db_url, auth_token=auth_token)

# good habit: turn on FK enforcement for THIS connection (safe; no data change)
await client.execute("PRAGMA foreign_keys = ON;")

# fetch products
async def fetch_as_polars():
    # Fetch all products
    rs_prod = await client.execute("SELECT * FROM Product;")
    df_products = pl.DataFrame(
        rs_prod.rows,
        schema=["name", "price", "picture", "type"]
    )

    # Fetch all stock
    rs_stock = await client.execute("SELECT * FROM Stock;")
    df_stock = pl.DataFrame(
        rs_stock.rows,
        schema=["id", "name", "expiry", "quantity"]
    )

    return df_products, df_stock
df_products, df_stock = await fetch_as_polars()

# remove test data
df_stock = df_stock.filter(pl.col("name") != "test")

df_stock_agg = (
    df_stock
    .group_by("name")
    .agg([
        pl.col("quantity").sum().alias("total_qty"),
    ])
    .sort("name")
)

# merge with price
df_with_value = (
    df_stock_agg
    .join(df_products.select(["name", "price"]), on="name", how="left")
    .with_columns(
        (pl.col("total_qty") * pl.col("price")).alias("total_value")
    )
    .sort("name")
)

grand_total = df_with_value["total_value"].sum()
print("库存总价值:", grand_total)
