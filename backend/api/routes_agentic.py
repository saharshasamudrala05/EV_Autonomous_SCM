from typing import List, Dict, Any, Optional as Opt
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

from pydantic import BaseModel
import re
import time
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class ChatRequest(BaseModel):
    message: str

def generate_simulated_forecast(base_forecast: List[Dict[str, Any]], delta_percent: float):
    """Computes a percentage-based delta simulation over the Titan V4 prediction baseline."""
    simulated = []
    multiplier = 1 + (delta_percent / 100.0)
    
    for entry in base_forecast:
        val = entry.get('ensemble') or 0
        p90 = entry.get('upper95') or 0
        sim_val = round(val * multiplier, 2)
        
        simulated.append({
            "date": entry['date'],
            "original_value": val,
            "simulated_value": sim_val,
            "risk_flag": sim_val > p90
        })
    return simulated

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


@router.post("/chat")
async def process_chat_command(req: ChatRequest, db: Session = Depends(get_db)):
    """Parses NLP inputs and triggers What-If simulation logic."""
    start_time = time.time()
    msg = req.message.lower()
    
    # 1. Regex Delta Extraction
    delta = 0
    match = re.search(r'(\d+)\s*%', msg)
    if match:
        delta = float(match.group(1))
        if 'decrease' in msg or 'reduction' in msg:
            delta = -delta

    # 2. Get Baseline Forecast
    summary = get_forecast_summary(db=db)
    base_forecast = summary['forecast']
    
    simulated = generate_simulated_forecast(base_forecast, delta)
    
    return {
        "status": "Simulation Complete",
        "delta_detected": f"{delta}%",
        "actual_forecast": base_forecast,
        "simulated_forecast": simulated,
        "meta": {
            "alert": "SIMULATION_ACTIVE" if delta != 0 else None,
            "severity": "NORMAL",
            "process_time": f"{time.time() - start_time:.4f}s",
            "message": "Neural Engine Sync Complete"
        }
    }

@router.get("/forecast")
@router.get("/forecast/{region}")
def get_forecast_summary(region: Opt[str] = None, db: Session = Depends(get_db)):
    start_time = time.time()
    try:
        with engine.connect() as conn:
            if region:
                q = text("SELECT * FROM public.v4_titan_intelligence_fabric WHERE region_name = :region ORDER BY date_key")
                df = pd.read_sql(q, conn, params={"region": region})
            else:
                q = text("SELECT * FROM public.v4_titan_intelligence_fabric ORDER BY region_name, date_key")
                df = pd.read_sql(q, conn)

        if df.empty:
            raise HTTPException(status_code=404, detail="No data found.")

        # Z-Score logic
        df = df.fillna(0)
        grp = df.groupby('region_name')['target_demand']
        df['demand_z_score'] = grp.transform(lambda x: (x - x.mean()) / (x.std() + 1e-9)).fillna(0)
        
        latest = df.sort_values('date_key').groupby('region_name').tail(1)
        # Sort by Volume for "Market Leaderboard" effect in HUD
        latest = latest.sort_values('target_demand', ascending=False)
        records = latest.to_dict(orient="records")

        fe = DemandForecastEngine(country="India")
        is_national = not region or region == "ALL"
        region_id = "National" if is_national else region
        history = df.to_dict(orient="records")
        
        # --- THE FIX: Neural Lazy Loading ---
        if fe.load_model(region_id):
            # Fast-path: Model exists in registry
            if is_national:
                # OPTIMIZATION: If National model is loaded, use it DIRECTLY.
                # This bypasses the 133s ensemble summation for sub-200ms response.
                predictions = fe.predict(horizon_years=2)
                analytics = fe.get_analytics()
                msg = "Titan V4 Vault Snapshot (High Frequency)"
            else:
                predictions = fe.predict(horizon_years=2)
                analytics = fe.get_analytics()
                msg = f"Regional Hub Snapshot: {region}"
        else:
            # Slow-path: Model missing, train in background for next request
            logger.warning(f"Accuracy Gap: Model missing for {region_id}. Serving baseline.")
            if is_national:
                # Use history to provide a quick trend if shards missing
                analytics = fe.train(history) # Initial seed only
                fe.save_model(region_id)
                predictions = fe.predict(horizon_years=2)
                msg = "Initial Neural Seed (Training...)"
            else:
                analytics = fe.train(history)
                fe.save_model(region_id)
                predictions = fe.predict(horizon_years=2)
                msg = f"Dynamic Learning Active: {region}"

        return {
            "source": "v4_titan_intelligence_fabric",
            "region": region or "ALL",
            "records": records,
            "forecast": predictions,
            "analytics": analytics,
            "meta": {
                "alert": "SNAPSHOT_MODE" if "Snapshot" in msg else None,
                "severity": "NORMAL",
                "process_time": f"{time.time() - start_time:.4f}s",
                "message": msg
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

