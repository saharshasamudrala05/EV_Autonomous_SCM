"""
NEXUS-SCM | Final Demo Seed Script - AI SCORE ALIGNED
Injects high-fidelity scenarios with percentage-based scores.
"""
import psycopg2
import json
from datetime import datetime

# Database Connection Registry
DSN = "postgresql://postgres:saharsha@localhost:5432/nexus_scm"

H3_NAMES = {
    "8861845a21fffff": "Bangalore Logistics Precinct",
    "8a61845a27fffff": "Delhi-NCR Supply Zone",
    "8a60145a2937fff": "Mumbai-Thane Industrial Hub"
}

def seed_demo_decisions():
    data = [
        {
            "id": 8801,
            "decision_type": "GENERATE_PO", 
            "title": f"[SCM_ANOMALY] {H3_NAMES['8861845a21fffff']} Inventory Critical",
            "trigger_reason": "Regional Inventory below Resilience Threshold (1.8 days). Z-Score anomaly 3.4 detected.",
            "input_data_summary": "Stock: 45 units, Forecast: 210 units/day, Lead_Time: 4 days",
            "ai_confidence_score": 94.2, # Scaled to percentage for UI
            "action_taken": "Trigger Autonomous Purchase Order for 1200 units of LFP_BATTERY_MOD",
            "action_parameters": json.dumps({"sku": "LFP_BATTERY_MOD", "quantity": 1200, "priority": "CRITICAL"}),
            "estimated_impact": "Prevents 85% stock-out risk in Bangalore Cluster.",
            "estimated_cost_saving_usd": 4500.0,
            "status": "PENDING",
            "executed_at": None,
            "was_overridden_by_human": False,
            "override_reason": None,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "related_supplier_id": None,
            "related_product_id": None,
            "related_facility_id": None,
            "related_alert_id": None
        },
        {
            "id": 8802,
            "decision_type": "REROUTE_SHIPMENT", 
            "title": f"[SCM_RESILIENCE] {H3_NAMES['8a61845a27fffff']} Bullwhip Alert",
            "trigger_reason": "Bullwhip ratio 2.1 detected. Downstream demand signal (Vahan) mismatching inbound shipments.",
            "input_data_summary": "Vahan_Velocity: +12% week-on-week, Inbound: Lagging by 48hrs",
            "ai_confidence_score": 88.5, # Scaled to percentage for UI
            "action_taken": "Rebalance 500 units from Delhi-NCR Hub to Chandigarh Secondary Hub.",
            "action_parameters": json.dumps({"source": "Delhi", "target": "Chandigarh", "quantity": 500}),
            "estimated_impact": "Reduces inter-facility buffer depletion by 22%.",
            "estimated_cost_saving_usd": 1200.0,
            "status": "PENDING", 
            "executed_at": None,
            "was_overridden_by_human": False,
            "override_reason": None,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "related_supplier_id": None,
            "related_product_id": None,
            "related_facility_id": None,
            "related_alert_id": None
        }
    ]

    print(">>> NEXUS-SCM | Executing Score-Aligned Ingress for Agentic Hub...")
    
    conn = psycopg2.connect(DSN)
    cur = conn.cursor()
    
    try:
        # Clear specific demo range
        cur.execute("DELETE FROM public.autonomous_decisions WHERE id >= 8800")
        
        for d in data:
            cols = list(d.keys())
            vals = [d[c] for c in cols]
            placeholders = ", ".join(["%s"] * len(cols))
            col_str = ", ".join(cols)
            query = f"INSERT INTO public.autonomous_decisions ({col_str}) VALUES ({placeholders})"
            cur.execute(query, vals)
            print(f"[OK] High-Integrity Demo Injected: {d['title']}")
            
        conn.commit()
        print("[OK] Transaction complete. Demo cards are now visible in the Agentic Hub.")
    except Exception as e:
        print(f"[X] Ingress failed: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    seed_demo_decisions()
