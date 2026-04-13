
import sys
import os
from sqlalchemy import text

# Ensure project root is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

try:
    from backend.core.database import SessionLocal
    db = SessionLocal()
    print(">>> CERTIFICATION: Hunting Zombie Transactions...")
    
    # Identify zombies
    q_find = text("""
        SELECT pid, state, query 
        FROM pg_stat_activity 
        WHERE state = 'idle in transaction' 
        AND datname = 'nexus_scm';
    """)
    zombies = db.execute(q_find).fetchall()
    
    if not zombies:
        print(">>> STATUS: No zombies found. DB is clean.")
    else:
        print(f">>> Found {len(zombies)} zombies. Terminating...")
        for z in zombies:
            pid = z[0]
            print(f"   Terminating PID {pid}...")
            db.execute(text(f"SELECT pg_terminate_backend({pid});"))
        db.commit()
        print(">>> STATUS: 200 OK (Purged all zombies)")
    
    db.close()
    sys.exit(0)
except Exception as e:
    import traceback
    print(">>> STATUS: FAIL")
    traceback.print_exc()
    sys.exit(1)
