
import sys
import os
from sqlalchemy import func, text
from datetime import datetime, timezone

import sys
import os
from sqlalchemy import func, text
from datetime import datetime, timezone

try:
    from backend.core.database import SessionLocal
    from backend.api.routes_dashboard import get_dashboard_kpis
    
    db = SessionLocal()
    print(">>> CERTIFICATION: Commencing Digital Twin Health Check...")
    kpis = get_dashboard_kpis(db)
    print(">>> STATUS: 200 OK")
    print(f">>> METRICS: {kpis}")
    db.close()
    sys.exit(0)
except Exception as e:
    import traceback
    print(">>> STATUS: 500 FAIL")
    traceback.print_exc()
    sys.exit(1)
