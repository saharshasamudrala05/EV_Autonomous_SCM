from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
import pandas as pd
from backend.core.database import get_db, engine as db_engine
from typing import List, Dict, Any
import time

router = APIRouter(prefix="/analytics", tags=["Analysis"])

@router.get("/demographics")
def get_demographic_patterns(region: str = "All", db: Session = Depends(get_db)):
    """
    Heuristic Mapper: Correlates industrial signals and penetration rates 
    to project consumer age/income segments.
    """
    start_time = time.time()
    try:
        with db_engine.connect() as conn:
            if region == "All":
                q = text("SELECT * FROM public.v4_titan_intelligence_fabric ORDER BY date_key DESC LIMIT 50")
                df = pd.read_sql(q, conn)
            else:
                q = text("SELECT * FROM public.v4_titan_intelligence_fabric WHERE region_name = :r ORDER BY date_key DESC LIMIT 1")
                df = pd.read_sql(q, conn, params={"r": region})

        if df.empty:
            return []

        latest = df.iloc[0]
        penetration = latest.get('ev_penetration_rate', 0)
        industrial = latest.get('reg_industrial', 0)

        # HEURISTIC LOGIC
        # High industrial = Enterprise interest
        # High penetration = Youth (18-30) interest
        youth_val = 70 + (penetration * 20)
        enterprise_val = min(90, industrial / 10)
        
        segments = [
            {"group": "18-25", "value": round(youth_val, 0)},
            {"group": "26-35", "value": round(youth_val * 0.8, 0)},
            {"group": "36-50", "value": 45},
            {"group": "Enterprise", "value": round(enterprise_val, 0)}
        ]

        return {
            "region": region,
            "segments": segments,
            "meta": {
                "alert": None,
                "severity": "NORMAL",
                "process_time": f"{time.time() - start_time:.4f}s",
                "message": "Demographic Heuristics Calculated"
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
