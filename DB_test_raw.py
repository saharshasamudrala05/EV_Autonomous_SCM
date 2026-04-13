from sqlalchemy import create_engine, text

# Replace with your actual password
engine = create_engine('postgresql://postgres:saharsha@localhost:5432/nexus_scm')

with engine.connect() as conn:
    # 1. What database am I actually in?
    db_name = conn.execute(text("SELECT current_database()")).scalar()
    # 2. What user am I?
    user_name = conn.execute(text("SELECT current_user")).scalar()
    # 3. List every table visible to this connection
    result = conn.execute(text("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'"))
    tables = [row[0] for row in result]
    
    print(f"DEBUG INFO:")
    print(f"Connected to Database: {db_name}")
    print(f"Connected as User: {user_name}")
    print(f"Tables visible: {tables}")