import psycopg2
conn = psycopg2.connect("postgresql://postgres:saharsha@localhost:5432/nexus_scm")
cur = conn.cursor()
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'v4_titan_intelligence_fabric'")
for row in cur.fetchall():
    print(row[0])
cur.close()
conn.close()
