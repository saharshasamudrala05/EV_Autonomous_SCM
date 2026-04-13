from sqlalchemy import create_engine, text
import pandas as pd

# TITAN V4 STATE-CENTER H3 LOOKUP (RES 6)
# Anchors derived from historical EV penetration centroids
STATE_H3_ANCHORS = {
    "Maharashtra": "86608b1b7ffffff",
    "Punjab": "863d146b7ffffff",
    "Karnataka": "8660144afffffff",
    "Tamil Nadu": "86618d487ffffff",
    "Uttar Pradesh": "864101b27ffffff",
    "Gujarat": "8660deb2fffffff",
    "West Bengal": "8660ad5a7ffffff",
    "Rajasthan": "863d09227ffffff",
    "Andhra Pradesh": "866184287ffffff",
    "Telangana": "86618b10fffffff",
    "Delhi": "863d6ad17ffffff",
    "Haryana": "863d6a2f7ffffff",
    "Kerala": "866191c07ffffff",
    "Bihar": "86412198fffffff",
    "Madhya Pradesh": "8660a129fffffff",
    "Odisha": "8661a5b8fffffff"
}

# NATIONAL DEFAULT (Central India / Nagpur area)
NATIONAL_CENTER = "86608b1b7ffffff" 

engine = create_engine('postgresql://postgres:saharsha@localhost:5432/nexus_scm')

def execute_spatial_recovery():
    print(">>> NEXUS-SCM | Executing Spatial Recovery (State-Center Anchor)...")
    
    with engine.begin() as conn:
        # 1. Fetch nodes missing H3 indexes
        print("[1/3] Parsing Orphaned Spatial Records...")
        nodes = pd.read_sql("SELECT node_id, name FROM public.network_nodes WHERE loc_h3_index IS NULL", conn)
        
        if nodes.empty:
            print("OK: No nodes require spatial recovery.")
            return

        updates = []
        for _, row in nodes.iterrows():
            node_id = row['node_id']
            name = row['name']
            
            # TASK 2: Parse State Name from Delimiter
            state = "National"
            if " - " in name:
                state = name.split(" - ")[1].strip()
            
            # Apply Anchor
            h3_idx = STATE_H3_ANCHORS.get(state, NATIONAL_CENTER)
            updates.append({"id": int(node_id), "h3": h3_idx})

        # 2. Batch Update
        print(f"[2/3] Applying {len(updates)} State-Center Anchors...")
        for up in updates:
            conn.execute(
                text("UPDATE public.network_nodes SET loc_h3_index = :h3 WHERE node_id = :id"),
                up
            )
        
        print("[3/3] Spatial Data Fabric Synchronized.")
    
    print(f"SUCCESS: {len(updates)} nodes anchored to state-level centroids.")

if __name__ == "__main__":
    execute_spatial_recovery()
