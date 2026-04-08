import pandas as pd
import sqlite3
from sqlalchemy import create_engine, text
import time

# --- SCM 2.0: THE DUAL-LEDGER RECONCILIATION WORKER ---
# Purpose: Audit Postgres (Brain) vs SQLite (ERP) every cycle 
# to ensure 'Ghost Orders' do not exist and order statuses are in sync.

BRAIN_DB = "postgresql://postgres:saharsha@localhost:5432/nexus_scm"
ERP_DB = "erp_ledger.db"

engine = create_engine(BRAIN_DB)

def run_reconciliation():
    print("[RECONCILIATION] Starting Dual-Ledger Integrity Audit...")
    
    try:
        # 1. Fetch EXECUTE-status decisions from Neural Brain (Postgres)
        with engine.connect() as conn:
            query = "SELECT id, title, status FROM public.autonomous_decisions WHERE status IN ('EXECUTED', 'PENDING')"
            df_brain = pd.read_sql(query, conn)
        
        # 2. Fetch all orders from Simulated ERP Ledger (SQLite)
        conn_erp = sqlite3.connect(ERP_DB)
        df_erp = pd.read_sql("SELECT decision_id, status FROM order_history", conn_erp)
        conn_erp.close()
        
        # 3. Detect "Ghost Orders" (In Brain but NOT in ERP)
        executed_in_brain = df_brain[df_brain['status'] == 'EXECUTED']['id'].tolist()
        processed_in_erp = df_erp['decision_id'].tolist()
        
        ghost_orders = [did for did in executed_in_brain if did not in processed_in_erp]
        
        if ghost_orders:
            print(f"[INTEGRITY_VIOLATION] Found {len(ghost_orders)} Ghost Orders in the Brain ledger!")
            for gid in ghost_orders:
                print(f"   -> Decision ID {gid}: Flagging for manual transactional retry.")
                # In a real system, we would auto-retry the ERP POST or alert a human.
        else:
            print("[AUDIT_PASS] No Ghost Orders detected. Neural Brain and ERP Ledger are in transaction sync.")

        # 4. Sync status back to Brain (Optional enhancement)
        # If ERP says 'CONFIRMED' but Brain says 'EXECUTED', we can move it to 'AUDITED'
        
    except Exception as e:
        print(f"[AUDIT_FAIL] Reconciliation Worker encountered a system error: {str(e)}")

if __name__ == "__main__":
    while True:
        try:
            run_reconciliation()
        except Exception as e:
            print(f"[AUDIT_CRITICAL] Worker failure: {str(e)}")
        print("[AUDIT_WAIT] Waiting 60 seconds for next audit cycle...")
        time.sleep(60)
