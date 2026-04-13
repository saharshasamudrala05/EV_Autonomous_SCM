import pandas as pd
from sqlalchemy import create_engine, text
import math

engine = create_engine('postgresql://postgres:saharsha@localhost:5432/nexus_scm')

def seed_inventory():
    print(">>> NEXUS-SCM | Executing Causal Inventory Seeding (TITAN V4)...")
    
    try:
        # Pre-fetch data outside the transaction to keep it short
        with engine.connect() as conn:
            print("[1/4] Fetching Intelligence Fabric Statistics...")
            fabric_df = pd.read_sql("SELECT region_name, target_demand, battery_lead_signal FROM public.v4_titan_intelligence_fabric", conn)
            
            print("[2/4] Mapping Network Topology...")
            nodes_df = pd.read_sql("SELECT node_id, node_type, name FROM public.network_nodes", conn)
            
            print("[3/4] Locating SKU Anchors...")
            sku_res = conn.execute(text("SELECT id FROM public.products LIMIT 1")).fetchone()
            if not sku_res:
                print("ERROR: No products found. Seed products first.")
                return
            sku_id = sku_res[0]

        # Process logic
        state_demand = fabric_df.groupby('region_name')['target_demand'].mean().to_dict()
        avg_battery_signal = fabric_df['battery_lead_signal'].mean()
        state_rto_counts = {}
        for _, row in nodes_df[nodes_df['node_type'] == 'DEMAND_HUB'].iterrows():
            if " - " in row['name']:
                state = row['name'].split(" - ")[1].strip()
                state_rto_counts[state] = state_rto_counts.get(state, 0) + 1

        inventory_records = []
        for _, row in nodes_df.iterrows():
            node_id, node_type, name = row['node_id'], row['node_type'], row['name']
            qoh = 0
            if node_type == 'DEMAND_HUB' and " - " in name:
                state = name.split(" - ")[1].strip()
                avg_demand = state_demand.get(state, 500)
                rto_count = state_rto_counts.get(state, 1)
                qoh = math.ceil((avg_demand / rto_count) * 1.5)
            elif node_type == 'SUPPLY_GATEWAY':
                qoh = math.ceil(avg_battery_signal * 10)
            
            if qoh > 0:
                inventory_records.append({
                    "product_id": sku_id,
                    "facility_id": node_id,
                    "quantity_on_hand": qoh,
                    "quantity_on_order": math.ceil(qoh * 0.2),
                    "quantity_reserved": 0,
                    "reorder_point": math.ceil(qoh * 0.8),
                    "economic_order_qty": math.ceil(qoh * 1.2),
                    "safety_stock": math.ceil(qoh * 0.4)
                })

        if inventory_records:
            print("[4/4] Executing ATOMIC Colonization...")
            inv_df = pd.DataFrame(inventory_records)
            # Use engine.begin() for automatic transaction management
            with engine.begin() as conn:
                conn.execute(text("TRUNCATE TABLE public.inventory RESTART IDENTITY CASCADE"))
                inv_df.to_sql('inventory', con=conn, if_exists='append', index=False)
            print(f"[OK] Causal Seeding Complete: {len(inventory_records)} nodes synchronized.")
        else:
            print("ERROR: No inventory records generated.")

    except Exception as e:
        print(f"FAILED: {str(e)}")
    finally:
        print(">>> Operations concluded.")

if __name__ == "__main__":
    seed_inventory()
