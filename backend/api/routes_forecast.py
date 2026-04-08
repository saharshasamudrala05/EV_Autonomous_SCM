"""
NEXUS-SCM | Forecasting API Routes - TITAN V4 SOVEREIGN RESTORATION
Anchored on public.v4_titan_intelligence_fabric
"""
from fastapi import APIRouter, Depends, Query, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any, Optional
import pandas as pd
from backend.core.database import get_db, engine as db_engine
from backend.core.schemas import DemandForecastResponse, TitanV4IntelligenceOut
from backend.ml.demand_forecast.engine import DemandForecastEngine

router = APIRouter(prefix="/forecast", tags=["Intelligence"])

# Service Caches
_forecasters = {}
_last_trained_size = {}

def get_forecaster(country: str) -> DemandForecastEngine:
    if country not in _forecasters:
        _forecasters[country] = DemandForecastEngine(country=country)
    return _forecasters[country]

def background_train(country: str, history: List[Dict[str, Any]]):
    """Background task to ensure the model remains synchronized with the latest fabric data."""
    id_key = f"{country}"
    if _last_trained_size.get(id_key) == len(history):
        return # Already synced
    
    forecaster = get_forecaster(country)
    forecaster.train(history)
    _last_trained_size[id_key] = len(history)
    print(f"[OK] Background training complete for {id_key} ({len(history)} records)")

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
            if region:
                q = text("SELECT * FROM public.v4_titan_intelligence_fabric WHERE region_name = :r ORDER BY date_key")
                p = {"r": region}
            else:
                q = text("SELECT * FROM public.v4_titan_intelligence_fabric ORDER BY date_key")
                p = {}
            df = pd.read_sql(q, conn, params=p)
        
        if df.empty:
            raise HTTPException(status_code=404, detail="No Titan V4 intelligence data found in the fabric.")

        # --- TEMPORAL AGGREGATION ---
        if not region:
            df = df.groupby('date_key').sum(numeric_only=True).reset_index()
            region_id = "National_Ensemble"
        else:
            region_id = region

        # --- STATISTICAL ANCHORING (Z-Score Injection) ---
        df['demand_z_score'] = (
            (df['target_demand'] - df['target_demand'].mean()) / 
            (df['target_demand'].std() + 1e-9)
        ).round(2)

        history = df.to_dict(orient="records")
        for rec in history:
            for k, v in rec.items():
                if hasattr(v, 'isoformat'):
                    rec[k] = v.isoformat()

        # 2. Get Forecaster and check state
        forecaster = get_forecaster(country)
        
        # --- PERSISTENCE & BACKGROUND UPDATES ---
        model_loaded = forecaster.load_model(region_id)
        
        if model_loaded:
            # Load immediately, refresh math in background
            background_tasks.add_task(forecaster.train, history)
            background_tasks.add_task(forecaster.save_model, region_id)
        else:
            # First-run: Must train synchronously to provide initial P/Q parameters
            forecaster.train(history)
            forecaster.save_model(region_id)

        # 3. Model Logic
        multiplier = 1.0
        if scenario == "policy_push":
            multiplier = 1.25
        elif scenario == "pessimistic":
            multiplier = 0.8
            
        predictions = forecaster.predict(horizon_years=3, policy_multiplier=multiplier)
        
        return {
            "country": country,
            "scenario": scenario,
            "historical_count": len(df),
            "records": history,
            "analytics": forecaster.get_analytics()
        }
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

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
