import os
import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.dialects.postgresql import insert

# --Configuration--
DB_USER = 'postgres'
DB_PASSWORD = 'saharsha'
DB_HOST = 'localhost'
DB_PORT = '5432'
DB_NAME = 'nexus_scm'
BASE_DIRECTORY = r'C:\Users\Admin\OneDrive\Documents\AI_SCM_Project\datasets'

connection_string = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(connection_string)

# -- THIS IS THE SPEED BOOSTER --
def psql_insert_copy(table, conn, keys, data_iter):
    """
    Execute SQL statement inserting data.
    This is much faster than the default 'row-by-row' method.
    """
    from urllib.parse import urlparse
    import csv
    from io import StringIO

    # gets a DBAPI connection can use with copy_from
    dbapi_conn = conn.connection
    with dbapi_conn.cursor() as cur:
        s_buf = StringIO()
        writer = csv.writer(s_buf)
        writer.writerows(data_iter)
        s_buf.seek(0)

        columns = ', '.join([f'"{k}"' for k in keys])
        if table.schema:
            table_name = f'"{table.schema}"."{table.name}"'
        else:
            table_name = f'"{table.name}"'

        sql = f'COPY {table_name} ({columns}) FROM STDIN WITH CSV'
        cur.copy_expert(sql=sql, file=s_buf)


def ingest_data(root_dir):
    for root, dirs, files in os.walk(root_dir):
        folder_name = os.path.basename(root)
        schema_name = 'public' if (root == root_dir or not folder_name) else folder_name.lower().replace(' ', '_').replace('-', '_')

        with engine.connect() as conn:
            conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema_name}"))
            conn.commit()

        for file in files:
            if file.endswith(('.csv', '.xlsx', '.xls')):
                file_path = os.path.join(root, file)
                table_name = os.path.splitext(file)[0].replace(' ', '_').replace('-', '_').lower()
                
                print(f"\n[STARTING] {file} -> {schema_name}.{table_name}")

                try:
                    if file.endswith('.csv'):
                        chunk_size = 5000  # Smaller chunks for better stability
                        first_chunk = True
                        chunk_count = 0
                        
                        # Use low_memory=False to handle mixed types in large datasets
                        for chunk in pd.read_csv(file_path, chunksize=chunk_size, low_memory=False):
                            mode = 'replace' if first_chunk else 'append'
                            
                            # Removed method='multi' for better compatibility on initial run
                            chunk.to_sql(table_name, engine, schema=schema_name, 
                                         index=False, if_exists=mode, method=psql_insert_copy)
                            
                            first_chunk = False
                            chunk_count += 1
                            print(f"   ... Processed chunk {chunk_count} ({chunk_count * chunk_size} rows approx.)")
                        
                        print(f"[FINISHED] {file}")

                    else:
                        df = pd.read_excel(file_path)
                        df.to_sql(table_name, engine, schema=schema_name, index=False, if_exists='replace')
                        print(f"[FINISHED] {file} ({len(df)} rows)")

                except Exception as e:
                    print(f"[ERROR] Failed to process {file}: {e}")

if __name__ == "__main__":
    print("Ingestion Engine Started...")
    ingest_data(BASE_DIRECTORY)