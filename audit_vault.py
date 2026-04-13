import psycopg2
conn = psycopg2.connect("postgresql://postgres:saharsha@localhost:5432/nexus_scm")
cur = conn.cursor()
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
tables = [row[0] for row in cur.fetchall()]
print(f"Tables found: {tables}")
cur.close()
conn.close()
