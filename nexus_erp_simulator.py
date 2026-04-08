from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from datetime import datetime
import sqlite3
import uvicorn

app = FastAPI(title="NEXUS-SCM | Corporate ERP Simulator (SAP/S4H Mock)")

# --- ERP SCHEMAS (High-Quality Pydantic Validation) ---
class PurchaseOrderRequest(BaseModel):
    decision_id: int
    po_type: str = "Z_AUTO_SCM"
    sku_id: str
    quantity: int
    delivery_node: str
    priority: int = 1
    generated_by: str = "NEXUS_AGENTIC_BRAIN_V3"
    reasoning_summary: str # Semantic Metadata Injection
    ai_confidence: float

# --- ERP LOCAL LEDGER (Ensuring Transaction Integrity) ---
def init_ledger():
    conn = sqlite3.connect('erp_ledger.db')
    cursor = conn.cursor()
    cursor.execute('''CREATE TABLE IF NOT EXISTS order_history (
                        order_id INTEGER PRIMARY KEY AUTOINCREMENT,
                        decision_id INTEGER UNIQUE,
                        sku_id TEXT,
                        quantity INTEGER,
                        delivery_node TEXT,
                        reasoning TEXT,
                        confidence REAL,
                        status TEXT,
                        created_at TIMESTAMP)''')
    conn.commit()
    conn.close()

init_ledger()

@app.get("/api/erp/audit-ledger")
def audit_ledger():
    """Endpoint for the Reconciliation Worker to detect 'Ghost Orders'."""
    conn = sqlite3.connect('erp_ledger.db')
    cursor = conn.cursor()
    cursor.execute("SELECT decision_id, order_id, status FROM order_history")
    audit_data = [{"decision_id": r[0], "order_id": r[1], "status": r[2]} for r in cursor.fetchall()]
    conn.close()
    return audit_data

@app.post("/api/erp/purchase-order")
def create_sap_order(order: PurchaseOrderRequest):
    """Mocks the creation of an official Purchase Order in an ERP Hub."""
    try:
        conn = sqlite3.connect('erp_ledger.db')
        cursor = conn.cursor()
        
        # Check for duplicate processing (Safety Gate)
        cursor.execute("SELECT order_id FROM order_history WHERE decision_id = ?", (order.decision_id,))
        if cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=400, detail="ERP_ERROR: Order already processed in ledger.")

        # Commit to ERP Ledger with Reasoning Metadata (Using OR REPLACE for Idempotency)
        cursor.execute("""
            INSERT OR REPLACE INTO order_history 
            (decision_id, sku_id, quantity, delivery_node, reasoning, confidence, status, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (order.decision_id, order.sku_id, order.quantity, order.delivery_node, order.reasoning_summary, order.ai_confidence, "CONFIRMED_IN_ERP", datetime.now()))
        
        order_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        print(f"📦 [ERP SIGNAL] Created Order #{order_id} for decision {order.decision_id} ({order.quantity} units to {order.delivery_node})")
        
        return {
            "status": "SAP_SUCCESS",
            "order_id": order_id,
            "sap_hash": f"TRX_{order_id:08d}",
            "message": "Transaction committed to Corporate Financial Ledger."
        }
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"SAP_SYSTEM_FAILURE: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
