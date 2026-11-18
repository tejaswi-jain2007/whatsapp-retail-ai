import sqlite3

con = sqlite3.connect('retail_platform.db')
cur = con.cursor()
cur.execute("DELETE FROM orders WHERE grand_total = 0")
con.commit()
print('Remaining top 5 orders:')
for r in cur.execute('SELECT order_number, status, grand_total, original_message, created_at FROM orders ORDER BY created_at DESC LIMIT 5').fetchall():
    print(r)
con.close()
