"""NEXUS-SCM | Risk & Intelligence API Routes"""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from backend.core.database import get_db
from backend.models.warehouse import Inventory, Facility
from backend.models.shipment import Shipment
from backend.models.alert import Alert, AlertType, AlertSeverity
from backend.ml.anomaly_detection.detector import AnomalyDetector
from backend.ml.assortment.optimizer import CommercialAssortmentOptimizer

router = APIRouter(prefix="/risk", tags=["Intelligence"])

# Service Layer
_detector = AnomalyDetector(contamination=0.08)
_optimizer = CommercialAssortmentOptimizer(wacc=0.08, lifetime_yrs=15)

@router.get("/anomalies")
def get_live_anomalies(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """
    Runs the Isolation Forest over live Digital Twin data.
    Finds supply chain disruptions autonomously.
    """
    # 1. Gather live state data
    inv_records = db.query(Inventory).all()
    history = [
        {
            "id": i.id,
            "product_id": i.product_id,
            "facility_id": i.facility_id,
            "quantity_on_hand": i.quantity_on_hand,
            "reorder_point": i.reorder_point,
            "stock_health_pct": i.stock_health_pct
        } for i in inv_records
    ]
    
    ship_records = db.query(Shipment).all()
    shipment_list = [
        {
            "id": s.id,
            "shipment_code": s.shipment_code,
            "status": s.status.value if s.status else None,
            "carrier_risk_score": 40
        } for s in ship_records
    ]

    # 2. Run Detectors
    inv_anomalies = _detector.detect_inventory_anomalies(history)
    ship_anomalies = _detector.detect_shipment_anomalies(shipment_list)
    
    # 3. Combine and Normalize to 'Control Tower' Front-End format
    # Frontend wants: id, severity, category, message, location, time, timestamp, acknowledged, rootCause
    normalized = []
    
    # Counter for unique IDs in the response
    idx = 1
    
    for a in (inv_anomalies + ship_anomalies):
        # Map Severity
        sev = a['severity'] if a['severity'] in ['critical', 'warning', 'info'] else 'warning'
        
        normalized.append({
            "id": idx,
            "severity": sev,
            "category": a['entity_type'] if a['entity_type'] in ['inventory', 'logistics', 'quality', 'supplier'] else 'inventory',
            "message": a['message'],
            "title": a['title'],
            "location": a['entity_name'],
            "time": "Just now", # Simulation
            "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000),
            "acknowledged": False,
            "rootCause": f"Anomaly detected by Isolation Forest. Statistically unexpected {a['entity_type']} state."
        })
        idx += 1
        
    return normalized

@router.get("/assortment")
def get_battery_tech_recommendations(
    demand_gwh: float = Query(50.0),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    # Rank them
    tech_options = [
        {
            "name": "Lithium-Ion (NMC)",
            "trl": 9,
            "capex_per_gwh": 80e6,
            "opex_rate": 0.03,
            "material_cost_per_kwh": 115.0 
        },
        {
            "name": "Sodium-Ion",
            "trl": 7,
            "capex_per_gwh": 100e6,
            "opex_rate": 0.04,
            "material_cost_per_kwh": 65.0 
        },
        {
            "name": "Lithium-Iron-Phosphate (LFP)",
            "trl": 9,
            "capex_per_gwh": 70e6,
            "opex_rate": 0.03,
            "material_cost_per_kwh": 95.0
        },
        {
            "name": "Solid-State Batteries",
            "trl": 4, 
            "capex_per_gwh": 150e6,
            "opex_rate": 0.05,
            "material_cost_per_kwh": 130.0
        }
    ]
    recommendations = _optimizer.rank_technologies(demand_gwh, tech_options)
    
    return recommendations
