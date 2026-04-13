import pandas as pd
from sqlalchemy import create_engine

engine = create_engine('postgresql://postgres:saharsha@localhost:5432/nexus_scm')
try:
    with engine.connect() as conn:
        count = pd.read_sql("SELECT COUNT(*) FROM public.inventory", conn).iloc[0,0]
        print(f"COLONIZATION STATUS: {count} records")
except Exception as e:
    print(f"STATUS: FAILED ({e})")
