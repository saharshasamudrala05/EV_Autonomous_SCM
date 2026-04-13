import pandas as pd
from sqlalchemy import create_engine

engine = create_engine('postgresql://postgres:saharsha@localhost:5432/nexus_scm')

with engine.connect() as conn:
    print("--- Vahan Sample ---")
    try:
        vahan_sample = pd.read_sql("SELECT * FROM vahan4dashboard.vahan_vehicle_registrations_by_fuel_type LIMIT 5", conn)
        print(vahan_sample)
    except Exception as e:
        print("Error reading vahan4dashboard:", e)
        
    print("\n--- Imports Sample ---")
    try:
        imports_sample = pd.read_sql("SELECT * FROM imports.imports_from_asian_countries LIMIT 5", conn)
        print(imports_sample)
    except Exception as e:
        print("Error reading imports:", e)
