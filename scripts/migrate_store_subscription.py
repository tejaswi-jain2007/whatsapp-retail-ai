import sqlite3
from datetime import datetime, timezone, timedelta

def migrate():
    con = sqlite3.connect('retail_platform.db')
    cur = con.cursor()
    cur.execute("PRAGMA table_info(stores)")
    existing_cols = {row[1] for row in cur.fetchall()}

    columns_to_add = [
        ("subscription_status", "VARCHAR(50) DEFAULT 'trial'"),
        ("trial_starts_at", "DATETIME"),
        ("trial_ends_at", "DATETIME"),
        ("subscription_plan", "VARCHAR(50) DEFAULT 'monthly_299'"),
        ("subscription_price", "NUMERIC(10, 2) DEFAULT 299.00"),
        ("subscription_valid_until", "DATETIME"),
    ]

    for col_name, col_type in columns_to_add:
        if col_name not in existing_cols:
            print(f"Adding column {col_name}...")
            cur.execute(f"ALTER TABLE stores ADD COLUMN {col_name} {col_type}")

    # Set default 14-day trial for existing store
    now = datetime.now(timezone.utc)
    trial_end = now + timedelta(days=14)
    cur.execute("""
        UPDATE stores 
        SET subscription_status = 'trial',
            trial_starts_at = ?,
            trial_ends_at = ?,
            subscription_plan = 'monthly_299',
            subscription_price = 299.00
        WHERE trial_starts_at IS NULL
    """, (now.isoformat(), trial_end.isoformat()))

    con.commit()
    print("Migration successful. Store details:")
    for row in cur.execute("SELECT id, store_name, status, subscription_status, trial_starts_at, trial_ends_at FROM stores").fetchall():
        print(row)
    con.close()

if __name__ == '__main__':
    migrate()
