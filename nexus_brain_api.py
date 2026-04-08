from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from sqlalchemy import create_engine, text
import uvicorn
import numpy as np
import subprocess
import httpx
import os

app = FastAPI(title="NEXUS-SCM Agentic Brain API")

# --- SCM 2.0 CONFIGURATION ---
SHADOW_MODE = False # LIVE Financial Execution Enabled
ERP_URL = "http://localhost:8001/api/erp/purchase-order"

# Enable CORS for the local React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = "postgresql://postgres:saharsha@localhost:5432/nexus_scm"
engine = create_engine(DATABASE_URL)

@app.get("/api/health")
def health():
    return {
        "status": "SOVEREIGN_CORE_ONLINE", 
        "version": "v4.0_Titan_Causal",
        "shadow_mode_active": SHADOW_MODE
    }

@app.get("/api/decisions")
def get_decisions():
    try:
        query = "SELECT * FROM public.autonomous_decisions ORDER BY created_at DESC LIMIT 50"
        df = pd.read_sql(query, engine)
        df = df.replace({np.nan: None})
        return df.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/decisions/approve/{decision_id}")
async def approve_decision(decision_id: int):
    """
    Orchestrates the 'Act' phase of the OODA loop.
    Fetches reasoning from local Postgres and pushes to External ERP.
    """
    try:
        # 1. Fetch the full decision context from Postgres (Semantic Extraction)
        with engine.connect() as conn:
            result = conn.execute(
                text("SELECT * FROM public.autonomous_decisions WHERE id = :id"),
                {"id": decision_id}
            ).fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail="Decision ID not found in Local Brain Ledger.")

            decision_data = dict(result._mapping)

        # 2. Extract SKU and Node from the title or parameters 
        node = decision_data['title'].split(' ')[-4] # Extracting H3 state key
        
        # --- PATCH: Robust Payload Extraction (Handles JSON & String Formats) ---
        import json
        params = decision_data['action_parameters']
        qty = 0

        try:
            # Attempt to parse as JSON (Format 2.0)
            parsed_params = json.loads(params)
            qty = parsed_params.get('quantity') or parsed_params.get('order_quantity') or 0
        except (json.JSONDecodeError, TypeError):
            # Fallback to string splitting (Format 1.0)
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

        # 4. Shadow Execution Logic (Dry Run vs Live)
        if SHADOW_MODE:
            print(f"🕵️ [SHADOW_MODE] Logged Payload for Decision {decision_id}: {erp_payload}")
            execution_msg = "Shadow Execution Recorded (DRY_RUN)."
            erp_status = "SHADOW_SUCCESS"
        else:
            async with httpx.AsyncClient() as client:
                erp_response = await client.post(ERP_URL, json=erp_payload, timeout=10.0)
                if erp_response.status_code != 200:
                    raise HTTPException(status_code=502, detail=f"ERP_SYSTEM_REJECTED: {erp_response.text}")
                execution_msg = "Live Transaction Committed to SAP Hub."
                erp_status = "SAP_SUCCESS"

        # 5. Atomic Status Update in Postgres (Closing the Loop)
        with engine.begin() as conn:
            conn.execute(
                text("UPDATE public.autonomous_decisions SET status = 'EXECUTED', executed_at = NOW() WHERE id = :id"),
                {"id": decision_id}
            )

        return {
            "status": "SUCCESS", 
            "execution_mode": "SHADOW" if SHADOW_MODE else "LIVE",
            "erp_status": erp_status,
            "message": execution_msg
        }
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

from fastapi import BackgroundTasks

@app.post("/api/sense")
async def trigger_agentic_brain(background_tasks: BackgroundTasks):
    """Triggers the Agentic Brain Reasoning Loop asynchronously."""
    try:
        # Non-blocking trigger via FastAPI BackgroundTasks
        background_tasks.add_task(subprocess.run, ["python", "agentic_brain.py"])
        return {"status": "SUCCESS", "message": "Neural sensing cycle initiated in background."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Brain failure trigger: {str(e)}")

from typing import Optional
from backend.ml.demand_forecast.engine import DemandForecastEngine

@app.get("/api/forecast")
@app.get("/api/forecast/{region}")
def get_forecast_summary(region: Optional[str] = None):
    """
    Titan V4: Query v4_titan_intelligence_fabric by region.
    Train DemandForecastEngine, return ensemble + p10/p50/p90 distribution + analytics.
    """
    try:
        with engine.connect() as conn:
            if region:
                query = text("""
                    SELECT * FROM public.v4_titan_intelligence_fabric
                    WHERE region_name = :region
                    ORDER BY date_key
                """)
                df = pd.read_sql(query, conn, params={"region": region})
            else:
                query = text("""
                    SELECT * FROM public.v4_titan_intelligence_fabric
                    ORDER BY region_name, date_key
                """)
                df = pd.read_sql(query, conn)

        if df.empty:
            raise HTTPException(status_code=404, detail="No data in v4_titan_intelligence_fabric")

        # Instantiate Titan V4 Engine
        fe = DemandForecastEngine(country="India")
        history = df.to_dict(orient="records")
        analytics = fe.train(history)
        predictions = fe.predict(horizon_years=2)

        # Regional signal summary (latest per region)
        df['date_key'] = pd.to_datetime(df['date_key'])
        latest = df.sort_values('date_key').groupby('region_name').tail(1)
        records = latest.replace({np.nan: None}).to_dict(orient="records")

        return {
            "source": "v4_titan_intelligence_fabric",
            "region": region or "ALL",
            "records": records,
            "forecast": predictions,
            "analytics": analytics
        }
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
