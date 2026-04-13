"""
NEXUS-SCM | Database Enum Registry Audit
Checks for exact molecular labels for decisiontype and decisionstatus.
"""
import psycopg2

DSN = "postgresql://postgres:saharsha@localhost:5432/nexus_scm"

def check_enums():
    conn = psycopg2.connect(DSN)
    cur = conn.cursor()
    
    types = ['decisiontype', 'decisionstatus']
    for t in types:
        print(f"\n>>> Checking ENUM labels for: {t}")
        cur.execute(f"""
            SELECT e.enumlabel 
            FROM pg_enum e 
            JOIN pg_type t ON e.enumtypid = t.oid 
            WHERE t.typname = '{t}'
        """)
        for row in cur.fetchall():
            print(f"- {row[0]}")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    check_enums()
