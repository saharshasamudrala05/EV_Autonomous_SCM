import pandas as pd
from sqlalchemy import create_engine

engine = create_engine('postgresql://postgres:saharsha@localhost:5432/nexus_scm')
with engine.connect() as conn:
    schemas = pd.read_sql("SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema')", conn)
    with open('dump_schema2.txt', 'w', encoding='utf-8') as f:
        for schema in schemas['schema_name']:
            tables = pd.read_sql(f"SELECT table_name FROM information_schema.tables WHERE table_schema = '{schema}'", conn)
            f.write(f"\n--- Schema: {schema} ---\n")
            for table in tables['table_name']:
                columns = pd.read_sql(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = '{schema}' AND table_name = '{table}'", conn)
                f.write(f"Table: {table}\n")
                f.write(columns.to_string(index=False) + "\n")
