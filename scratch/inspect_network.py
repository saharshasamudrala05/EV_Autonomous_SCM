import pandas as pd
from sqlalchemy import create_engine

engine = create_engine('postgresql://postgres:saharsha@localhost:5432/nexus_scm')

with engine.connect() as conn:
    print("--- Network Nodes Schema ---")
    try:
        schema = pd.read_sql("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'network_nodes'
        """, conn)
        print(schema)
        
        print("\n--- Network Nodes Sample ---")
        sample = pd.read_sql("SELECT * FROM public.network_nodes LIMIT 5", conn)
        print(sample)
    except Exception as e:
        print("Error reading network_nodes:", e)
