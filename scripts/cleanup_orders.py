import sqlite3

con = sqlite3.connect('retail_platform.db')
cur = con.cursor()
# Delete the accidental '1' order
cur.execute("DELETE FROM orders WHERE order_number = 'ORD-261119-6720'")
# Confirm the actual 1 litre tel order
cur.execute("UPDATE orders SET status = 'CONFIRMED' WHERE order_number = 'ORD-261119-1753'")
con.commit()
print('Cleaned up. Current active orders:', cur.execute('SELECT id, order_number, status, original_message FROM orders ORDER BY created_at DESC LIMIT 5').fetchall())
con.close()
