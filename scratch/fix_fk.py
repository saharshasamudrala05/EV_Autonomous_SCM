from sqlalchemy import create_engine, text

engine = create_engine('postgresql://postgres:saharsha@localhost:5432/nexus_scm')

print(">>> NEXUS-SCM | Synchronizing Foreign Key Constraints...")

with engine.begin() as conn:
    try:
        # 1. Drop the legacy FK constraint
        print("[1/2] Dropping legacy inventory_facility_id_fkey...")
        conn.execute(text("ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS inventory_facility_id_fkey"))
        
        # 2. Add the new Titan V4 FK constraint
        print("[2/2] Establishing Titan V4 network_nodes linkage...")
        conn.execute(text("""
            ALTER TABLE public.inventory 
            ADD CONSTRAINT inventory_facility_id_fkey 
            FOREIGN KEY (facility_id) REFERENCES public.network_nodes(node_id)
            ON DELETE CASCADE
        """))
        
        print("[OK] Foreign Key synchronization successful.")
    except Exception as e:
        print(f"FAILED: {e}")
