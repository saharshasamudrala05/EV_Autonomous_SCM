from fastapi import APIRouter, Depends, Query, HTTPException, BackgroundTasks, File, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any, Optional
import pandas as pd
import io
import time
from pydantic import BaseModel
from backend.core.database import get_db, engine as db_engine
from backend.core.schemas import DemandForecastResponse, TitanV4IntelligenceOut
from backend.ml.demand_forecast.engine import DemandForecastEngine

class ForecastParams(BaseModel):
    country: str = "India"
    region: str = "National"
    ev_category: str = "All"
    scenario: str = "baseline"

router = APIRouter(prefix="/forecast", tags=["Intelligence"])

# Service Caches
_forecasters = {}

def get_forecaster(country: str) -> DemandForecastEngine:
    if country not in _forecasters:
        _forecasters[country] = DemandForecastEngine(country=country)
    return _forecasters[country]

@router.get("/ev-sales", response_model=DemandForecastResponse)
def get_ev_sales_forecast(
    background_tasks: BackgroundTasks,
    country: str = Query("India"),
    scenario: str = Query("baseline"),
    region: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Titan V4: Returns Sales Forecast anchored on v4_titan_intelligence_fabric.
    Uses multi-variate causal signals (Maker volumes, Battery Signals).
    """
    try:
        # 1. Fetch the World-Class Fabric Data
        with db_engine.connect() as conn:
            if region and region != "National":
                q = text("SELECT * FROM public.v4_titan_intelligence_fabric WHERE region_name = :r ORDER BY date_key")
                p = {"r": region}
            else:
                q = text("SELECT * FROM public.v4_titan_intelligence_fabric ORDER BY date_key")
                p = {}
            df = pd.read_sql(q, conn, params=p)
        
        if df.empty:
            raise HTTPException(status_code=404, detail="No Titan V4 intelligence data found in the fabric.")

        # --- REGIONAL CLUSTERING: NATIONAL ENSEMBLE vs STATE MODEL ---
        is_national = not region or region == "National"
        region_id = "National" if is_national else region

        # Aggregation for UI display (National Ensemble sums individual projections, but UI needs historical trend)
        if is_national:
            historical_df = df.groupby('date_key').sum(numeric_only=True).reset_index()
        else:
            historical_df = df

        # --- STATISTICAL ANCHORING (Z-Score Injection) ---
        historical_df = historical_df.fillna(0)
        historical_df['demand_z_score'] = (
            (historical_df['target_demand'] - historical_df['target_demand'].mean()) / 
            (historical_df['target_demand'].std() + 1e-9)
        ).round(2).fillna(0)

        history = historical_df.to_dict(orient="records")
        for rec in history:
            for k, v in rec.items():
                if hasattr(v, 'isoformat'): rec[k] = v.isoformat()

        # 2. Get Forecaster and check state (Lazy Loading Implementation)
        forecaster = get_forecaster(country)
        model_loaded = forecaster.load_model(region_id)
        
        if not model_loaded:
            # PERFORMANCE FIX: Offload training to background to avoid main-thread lag.
            # Serve placeholder or national forecast while training.
            logger.info(f"Model missing for {region_id}. Offloading training to background.")
            background_tasks.add_task(forecaster.train, history)
            background_tasks.add_task(forecaster.save_model, region_id)
            
            # Fallback to National if state model missing (to satisfy UI immediately)
            if not is_national:
                forecaster.load_model("National")
        
        # --- SPEED OPTIMIZATION: Main thread now only runs predict() ---

        # 3. Prediction Ensembling
        multiplier = 1.0
        if scenario == "policy_push": multiplier = 1.25
        elif scenario == "pessimistic": multiplier = 0.8
            
        if is_national:
            national_pkg = forecaster.predict_national(horizon_years=3)
            predictions = national_pkg["results"]
            final_analytics = national_pkg["analytics"]
        else:
            predictions = forecaster.predict(horizon_years=3, policy_multiplier=multiplier)
            final_analytics = forecaster.get_analytics()
        
        return {
            "country": country,
            "scenario": scenario,
            "historical_count": len(df),
            "records": history,
            "analytics": final_analytics,
            "meta": {
                "results": predictions, # Unified chart layer
                "process_time": "0.0s",
                "message": f"Titan V4 Cluster {region_id} Active"
            }
        }
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload")
async def upload_scenario(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Sovereign Scenario Upload: Processes CSV/XLSX to influence the Digital Twin.
    Sandbox training: User_Scenario_[timestamp].joblib
    """
    import time
    timestamp = int(time.time())
    
    # 1. Read & Validate
    content = await file.read()
    if file.filename.endswith('.csv'):
        user_df = pd.read_csv(io.BytesIO(content))
    else:
        user_df = pd.read_excel(io.BytesIO(content))
    
    required = ["date_key", "region_name", "target_demand"]
    if not all(c in user_df.columns for c in required):
        raise HTTPException(status_code=400, detail=f"Invalid Schema. Missing: {[c for c in required if c not in user_df.columns]}")

    # 2. Sandbox Training
    history = user_df.fillna(0).to_dict(orient="records")
    sandbox_engine = DemandForecastEngine(country="India")
    
    try:
        sandbox_engine.train(history)
    except Exception as e:
        return {
            "error": "Neural training interrupted",
            "fallback_active": True,
            "detail": str(e)
        }

    scenario_id = f"User_Scenario_{timestamp}"
    sandbox_engine.save_model(scenario_id, is_scenario=True)

    # 3. Digital Twin Impact Logic (Inventory Correlation)
    regions = user_df['region_name'].unique().tolist()
    forecasted_vol = user_df['target_demand'].sum()
    
    # Query live stock for impacted regions
    from backend.models.warehouse import Inventory, Facility
    from backend.models.network import NetworkNode
    
    total_stock = db.query(text("SUM(quantity_on_hand)")).from_statement(
        text("SELECT SUM(i.quantity_on_hand) FROM inventory i JOIN network_nodes n ON i.facility_id = n.node_id WHERE n.region IN :r")
    ).params(r=tuple(regions)).scalar() or 1
    
    risk_score = forecasted_vol / total_stock
    
    return {
        "scenario_id": scenario_id,
        "risk_score": round(risk_score, 2),
        "impact_regions": regions,
        "recommendation": "URGENT REALLOCATION REQUIRED" if risk_score > 1.5 else "NORMAL_RESILIENCE"
    }

@router.post("/simulate")
def simulate_scenario(
    country: str,
    region: Optional[str] = None,
    policy_delta: float = 1.0,
    db: Session = Depends(get_db)
):
    """Simulates impact using the Titan V4 Causal Matrix."""
    try:
        with db_engine.connect() as conn:
            if region:
                q = text("SELECT * FROM public.v4_titan_intelligence_fabric WHERE region_name = :r ORDER BY date_key")
                p = {"r": region}
            else:
                q = text("SELECT * FROM public.v4_titan_intelligence_fabric ORDER BY date_key")
                p = {}
            df = pd.read_sql(q, conn, params=p)
            
        if df.empty:
            raise HTTPException(status_code=404, detail="No V4 intelligence data found for simulation.")
            
        history = df.to_dict(orient="records")
        forecaster = get_forecaster(country)
        forecaster.train(history)
        
        predictions = forecaster.predict(horizon_years=3, policy_multiplier=policy_delta)
        
        return {
            "status": "simulation_complete",
            "results": predictions,
            "v4_analytics": forecaster.get_analytics()
        }
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/recompute", response_model=DemandForecastResponse)
async def recompute_forecast(
    params: ForecastParams,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Refactors static data into an on-demand compute inference."""
    start_time = time.time()
    try:
        # 1. Dynamic Data Filtering
        with db_engine.connect() as conn:
            q = text("SELECT * FROM public.v4_titan_intelligence_fabric WHERE 1=1")
            df = pd.read_sql(q, conn)
        
        if params.ev_category != "All":
            pass 

        if params.region == "National":
            df = df.groupby('date_key').sum(numeric_only=True).reset_index()
            region_id = "National"
        else:
            df = df[df['region_name'] == params.region]
            region_id = params.region

        if df.empty:
            raise HTTPException(status_code=404, detail="No data matching compute filters.")

        # 2. Live Statistical Anchoring (Z-Score)
        df = df.fillna(0)
        df['demand_z_score'] = (
            (df['target_demand'] - df['target_demand'].mean()) / 
            (df['target_demand'].std() + 1e-9)
        ).round(2).fillna(0)

        max_z = df['demand_z_score'].abs().max()
        history = df.to_dict(orient="records")
        for rec in history:
            for k, v in rec.items():
                if hasattr(v, 'isoformat'): rec[k] = v.isoformat()

        # 3. Compute Logic (Persistence Aware)
        forecaster = get_forecaster("India")
        model_loaded = forecaster.load_model(region_id or "National")
        
        if model_loaded:
            background_tasks.add_task(forecaster.train, history)
            background_tasks.add_task(forecaster.save_model, region_id or "National")
        else:
            forecaster.train(history)
            forecaster.save_model(region_id or "National")

        # 4. System Intelligence (Meta-Alerts)
        alert = None
        severity = "NORMAL"
        if max_z > 2.5:
            alert = "UNUSUAL_DEMAND_SURGE"
            severity = "HIGH"

        return {
            "country": "India",
            "scenario": "On_Demand_Recompute",
            "historical_count": len(df),
            "records": history,
            "analytics": forecaster.get_analytics(),
            "meta": {
                "alert": alert,
                "severity": severity,
                "process_time": f"{time.time() - start_time:.4f}s",
                "message": "Neural Engine Sync Complete"
            }
        }
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))
