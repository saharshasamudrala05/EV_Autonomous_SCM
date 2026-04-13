"""NEXUS-SCM | Risk & Intelligence API Routes"""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from backend.core.database import get_db
from backend.models.warehouse import Inventory, Facility
from backend.models.shipment import Shipment
from backend.models.supplier import Supplier
from backend.models.alert import Alert, AlertType, AlertSeverity
from backend.ml.anomaly_detection.detector import AnomalyDetector
from backend.ml.assortment.optimizer import CommercialAssortmentOptimizer

router = APIRouter(prefix="/risk", tags=["Intelligence"])

# Service Layer
_detector = AnomalyDetector(contamination=0.08)
_optimizer = CommercialAssortmentOptimizer(wacc=0.08, lifetime_yrs=15)

@router.get("/anomalies")
def get_live_anomalies(
    active_scenario_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """
    Runs the Isolation Forest over live Digital Twin data.
    Finds supply chain disruptions autonomously.
    """
    from backend.ml.demand_forecast.engine import DemandForecastEngine
    from backend.models.autonomous_decision import AutonomousDecision, DecisionType, DecisionStatus
    
    # 1. Gather live state data
    inv_records = db.query(Inventory).all()
    history = [
        {
            "id": i.id,
            "product_id": i.product_id,
            "facility_id": i.facility_id,
            "quantity_on_hand": i.quantity_on_hand,
            "reorder_point": i.reorder_point or 0,
            "stock_health_pct": i.stock_health_pct or 0
        } for i in inv_records
    ]
    
    # Joining with Supplier for real risk_score
    ship_records = db.query(Shipment).join(Supplier, Shipment.supplier_id == Supplier.id).all()
    shipment_list = [
        {
            "id": s.id,
            "shipment_code": s.shipment_code,
            "status": s.status.value if s.status else "PENDING",
            "carrier_risk_score": s.supplier.risk_score if s.supplier else 50,
            "carrier_name": s.carrier or "Standard Hub"
        } for s in ship_records
    ]

    # 2. Run Detectors
    inv_anomalies = _detector.detect_inventory_anomalies(history)
    ship_anomalies = _detector.detect_shipment_anomalies(shipment_list)
    
    # 3. SOVEREIGN SCENARIO INJECTION
    scenario_anomalies = []
    if active_scenario_id:
        forecaster = DemandForecastEngine(country="India")
        if forecaster.load_model(active_scenario_id, is_scenario=True):
            predictions = forecaster.predict(horizon_years=1)
            # Find peak demand in scenario
            max_demand = max([p['ensemble'] for p in predictions]) if predictions else 0
            total_stock = sum([i.quantity_on_hand for i in inv_records]) or 1
            risk_score = max_demand / total_stock
            
            if risk_score > 1.5:
                try:
                    existing = db.query(AutonomousDecision).filter(
                        AutonomousDecision.title == "URGENT STOCK REALLOCATION: USER SCENARIO V1",
                        AutonomousDecision.status == DecisionStatus.EXECUTED
                    ).first()
                    
                    if not existing:
                        new_dec = AutonomousDecision(
                            decision_type=DecisionType.SCENARIO_TRIGGER,
                            title="URGENT STOCK REALLOCATION: USER SCENARIO V1",
                            trigger_reason=f"Sovereign Scenario {active_scenario_id} predicts peak demand of {max_demand:.0f} units against total stock of {total_stock:.0f}.",
                            action_taken="Pre-emptive inventory buffering triggered in all impacted regions.",
                            ai_confidence_score=0.92,
                            status=DecisionStatus.EXECUTED,
                            executed_at=datetime.now(timezone.utc)
                        )
                        db.add(new_dec)
                        db.commit()
                except Exception as de:
                    logger.error(f"Autonomous Decision Guard Triggered: {de}")
                    db.rollback()
                
                scenario_anomalies.append({
                    "severity": "critical",
                    "title": "SCENARIO RISK DETECTED",
                    "message": f"User Scenario {active_scenario_id} indicates {risk_score:.1f}x demand-to-stock ratio. Shortage imminent.",
                    "entity_type": "inventory",
                    "entity_name": "Sovereign Vault",
                    "anomaly_z_score": risk_score
                })

    # 4. TITAN V4 INTELLIGENCE FABRIC PROBE
    v4_anomalies = []
    try:
        # Graceful Probe: Check if table is empty or missing
        fabric_rows = db.execute(text("SELECT * FROM public.v4_titan_intelligence_fabric LIMIT 100")).mappings().all()
        if not fabric_rows:
            logger.warning("Titan V4 Intelligence Fabric is empty. Skipping probe.")
        else:
            for row in fabric_rows:
                bat_sig = float(row.get('battery_lead_signal') or 100)
                if bat_sig < 50:
                    v4_anomalies.append({
                        "severity": "critical",
                        "title": "ASIAN SUPPLY CHAIN STARVATION",
                        "message": f"Critical battery lead signal ({bat_sig:.1f}) detected for {row.get('region_name')}. Impending component shortage.",
                        "entity_type": "supplier",
                        "entity_name": row.get('region_name'),
                        "anomaly_z_score": 9.5
                    })
    except Exception as e:
        logger.error(f"Intelligence Fabric probe failed (Graceful fallback): {e}")

    # 5. Combine and Normalize to 'Control Tower' Front-End format
    normalized = []
    idx = 1
    
    for a in (inv_anomalies + ship_anomalies + scenario_anomalies + v4_anomalies):
        sev = a.get('severity', 'warning')
        
        normalized.append({
            "id": idx,
            "severity": sev,
            "category": a.get('entity_type', 'inventory'),
            "message": str(a.get('message', 'Potential disruption detected.')),
            "title": str(a.get('title', 'NEURAL ALERT')),
            "location": str(a.get('entity_name') or a.get('location') or "Global Node"),
            "time": "Just now",
            "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000),
            "acknowledged": False,
            "rootCause": f"Titan V4 logic: {a.get('title')}. Risk detected in causal stream.",
            "anomaly_z_score": round(float(a.get('anomaly_z_score', 0)), 2)
        })
        idx += 1
        
    return normalized

@router.get("/assortment")
def get_battery_tech_recommendations(
    demand_gwh: float = Query(50.0),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    # 1. Fetch live tech profiles from DB
    from backend.models.product_sku import BatteryTechProfile
    profiles = db.query(BatteryTechProfile).all()
    
    # 2. Convert to Optimizer format
    tech_options = [
        {
            "name": p.name,
            "trl": p.trl,
            "capex_per_gwh": p.capex_per_gwh,
            "opex_rate": p.opex_rate,
            "material_cost_per_kwh": p.material_cost_per_kwh 
        } for p in profiles
    ]
    
    # If DB is empty, use a baseline (fallback)
    if not tech_options:
        tech_options = [
            {"name": "Lithium-Ion (NMC)", "trl": 9, "capex_per_gwh": 80e6, "opex_rate": 0.03, "material_cost_per_kwh": 115.0}
        ]

    # 3. Rank them using the Neural Optimizer
    recommendations = _optimizer.rank_technologies(demand_gwh, tech_options)
    
    return recommendations
