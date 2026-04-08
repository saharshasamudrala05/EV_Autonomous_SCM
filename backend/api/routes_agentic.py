from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from backend.core.database import get_db, engine
import numpy as np
import subprocess
import httpx
import os
import json
from backend.config import settings

router = APIRouter()

# --- SCM 2.0 CONFIGURATION ---
SHADOW_MODE = False
ERP_URL = "http://localhost:8001/api/erp/purchase-order"
engine = create_engine(settings.DATABASE_URL)

@router.get("/health")
def agentic_health():
    return {
        "status": "SOVEREIGN_CORE_ONLINE", 
        "version": "v4.2_Unified",
        "shadow_mode_active": SHADOW_MODE
    }

@router.get("/decisions")
def get_decisions():
    try:
        query = "SELECT * FROM public.autonomous_decisions ORDER BY created_at DESC LIMIT 50"
        df = pd.read_sql(query, engine)
        df = df.replace({np.nan: None})
        return df.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/decisions/approve/{decision_id}")
async def approve_decision(decision_id: int):
    """Orchestrates the 'Act' phase of the OODA loop."""
    try:
        with engine.connect() as conn:
            result = conn.execute(
                text("SELECT * FROM public.autonomous_decisions WHERE id = :id"),
                {"id": decision_id}
            ).fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail="Decision ID not found.")

            decision_data = dict(result._mapping)

        node = decision_data['title'].split(' ')[-4] # Extracting H3 state key
        params = decision_data['action_parameters']
        qty = 0

        try:
            parsed_params = json.loads(params)
            qty = parsed_params.get('quantity') or parsed_params.get('order_quantity') or 0
        except (json.JSONDecodeError, TypeError):
            try:
                qty = int(params.split(' ')[0])
            except:
                qty = 0

        erp_payload = {
            "decision_id": decision_id,
            "sku_id": "LFP_BATTERY_MOD",
            "quantity": int(qty),
            "delivery_node": node,
            "reasoning_summary": decision_data['trigger_reason'],
            "ai_confidence": decision_data['ai_confidence_score']
        }

        if SHADOW_MODE:
            print(f"🕵️ [SHADOW] Decision {decision_id} logged.")
            erp_status = "SHADOW_SUCCESS"
        else:
            async with httpx.AsyncClient() as client:
                erp_response = await client.post(ERP_URL, json=erp_payload, timeout=5.0)
                if erp_response.status_code != 200:
                    raise HTTPException(status_code=502, detail=f"ERP_REJECTED: {erp_response.text}")
                erp_status = "SAP_SUCCESS"

        with engine.begin() as conn:
            conn.execute(
                text("UPDATE public.autonomous_decisions SET status = 'EXECUTED', executed_at = NOW() WHERE id = :id"),
                {"id": decision_id}
            )

        return {"status": "SUCCESS", "erp_status": erp_status}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sense")
async def trigger_agentic_brain(background_tasks: BackgroundTasks):
    """Triggers the Agentic Brain Reasoning Loop asynchronously."""
    # We navigate to parent dir from backend/ to run agentic_brain.py
    brain_script = os.path.join(os.getcwd(), "..", "agentic_brain.py")
    background_tasks.add_task(subprocess.run, ["python", brain_script])
    return {"status": "SUCCESS", "message": "Neural sensing cycle initiated in background."}

H3_REGIONS = {
    "8861845a21fffff": "Bangalore Logistics Precinct",
    "8a61845a27fffff": "Delhi-NCR Supply Zone",
    "8a60145a2937fff": "Mumbai-Thane Industrial Hub",
    "8860145a23fffff": "Pune Auto-Cluster",
    "8830e1d039fffff": "Chennai Port Hub",
    "8830e1d041fffff": "Hyderabad Strategic Node"
}

from backend.ml.demand_forecast.engine import DemandForecastEngine
from typing import Optional as Opt

@router.get("/forecast")
@router.get("/forecast/{region}")
def get_forecast_summary(region: Opt[str] = None, db: Session = Depends(get_db)):
    """
    Titan V4: Anchored on public.v4_titan_intelligence_fabric.
    Returns: regional telemetry records (with maker vols + causal signals),
             Bass Diffusion analytics KPIs, and p10/p50/p90 ensemble forecast.
    Z-Scores computed from target_demand variance for Neuro-Core Anomaly Scanner.
    """
    try:
        with engine.connect() as conn:
            if region:
                q = text("""
                    SELECT * FROM public.v4_titan_intelligence_fabric
                    WHERE region_name = :region
                    ORDER BY date_key
                """)
                df = pd.read_sql(q, conn, params={"region": region})
            else:
                q = text("""
                    SELECT * FROM public.v4_titan_intelligence_fabric
                    ORDER BY region_name, date_key
                """)
                df = pd.read_sql(q, conn)

        if df.empty:
            raise HTTPException(
                status_code=404,
                detail="No data found in v4_titan_intelligence_fabric"
            )

        df['date_key'] = pd.to_datetime(df['date_key'])

        # --- Z-Score from target_demand variance (Neuro-Core Anomaly Scanner) ---
        if 'target_demand' in df.columns:
            grp = df.groupby('region_name')['target_demand']
            df['demand_z_score'] = grp.transform(
                lambda x: (x - x.mean()) / (x.std() + 1e-9)
            ).fillna(0)

        # --- Latest per-region records (for the UI table) ---
        latest = df.sort_values('date_key').groupby('region_name').tail(1)
        records = latest.replace({np.nan: None}).to_dict(orient="records")

        # --- Titan V4 Engine: Train + Predict ---
        analytics = {
            "accuracy": 96.1, "mae": 3.24, "elasticity": 1.12, "sensitivity": 1.0,
            "p": 12.0, "q": 82.0, "m": 100.0
        }
        predictions = []

        fe = DemandForecastEngine(country="India")
        history = df.to_dict(orient="records")
        analytics = fe.train(history)
        predictions = fe.predict(horizon_years=2)

        return {
            "source": "v4_titan_intelligence_fabric",
            "region": region or "ALL",
            "records": records,
            "forecast": predictions,
            "analytics": analytics
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"[SCM_ERR] Titan V4 Forecast Bridge Failure: {e}")
        raise HTTPException(status_code=500, detail=str(e))

