import sqlite3
import sys
import os

try:
    db_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'radius.db')
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    print("--- NAS Table ---")
    c.execute("SELECT * FROM nas")
    for row in c.fetchall():
        print(row)

    print("\n--- RADCHECK Table for falisa ---")
    c.execute("SELECT * FROM radcheck WHERE username='falisa'")
    for row in c.fetchall():
        print(row)

    conn.close()
except Exception as e:
    print(f"Error: {e}")
