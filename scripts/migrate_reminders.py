import sqlite3

def run():
    con = sqlite3.connect('retail_platform.db')
    cur = con.cursor()

    # 1. Update store phone
    cur.execute("UPDATE stores SET phone = '+919479550330' WHERE id = 's0000001-0000-0000-0000-000000000001'")
    print("Updated store phone.")

    # 2. Add columns to orders if not exist
    cols = [c[1] for c in cur.execute("PRAGMA table_info(orders)").fetchall()]
    if "pickup_reminders_count" not in cols:
        cur.execute("ALTER TABLE orders ADD COLUMN pickup_reminders_count INTEGER DEFAULT 0")
        print("Added pickup_reminders_count column.")
    if "last_reminder_at" not in cols:
        cur.execute("ALTER TABLE orders ADD COLUMN last_reminder_at DATETIME")
        print("Added last_reminder_at column.")

    con.commit()
    print("Current stores:", cur.execute("SELECT id, store_name, phone FROM stores").fetchall())
    print("Current columns in orders:", [c[1] for c in cur.execute("PRAGMA table_info(orders)").fetchall()])
    con.close()

if __name__ == '__main__':
    run()
