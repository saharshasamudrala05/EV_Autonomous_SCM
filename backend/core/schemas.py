"""NEXUS-SCM | Pydantic Response Schemas (used by FastAPI endpoints)"""
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, List, Dict, Any


# ── Supplier Schemas ──────────────────────────────────────────
class SupplierOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    supplier_code: str
    name: str
    country: str
    city: Optional[str]
    lead_time_days: int
    on_time_delivery_rate: float
    quality_score: float
    risk_score: float
    geopolitical_risk: str
    is_preferred: bool
    is_active: bool
    created_at: datetime


# ── Facility Schemas ──────────────────────────────────────────
class FacilityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    facility_code: str
    name: str
    facility_type: str
    city: str
    state: str
    country: str
    latitude: Optional[float]
    longitude: Optional[float]
    capacity_gwh: Optional[float]
    current_utilization_pct: float
    is_operational: bool


# ── Inventory Schemas ─────────────────────────────────────────
class InventoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    product_id: int
    facility_id: int
    quantity_on_hand: int
    quantity_on_order: int
    quantity_reserved: int
    reorder_point: int
    economic_order_qty: int
    safety_stock: int
    is_below_reorder_point: bool
    stock_health_pct: float


# ── Shipment Schemas ──────────────────────────────────────────
class ShipmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    shipment_code: str
    origin_country: str
    destination_country: str
    quantity: int
    cargo_value_usd: Optional[float]
    transport_mode: str
    carrier: Optional[str]
    status: str
    departure_dt: Optional[datetime]
    estimated_arrival_dt: Optional[datetime]
    transport_cost_usd: Optional[float]
    delay_reason: Optional[str]


# ── Alert Schemas ─────────────────────────────────────────────
class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    alert_type: str
    severity: str
    title: str
    message: str
    entity_type: Optional[str]
    entity_name: Optional[str]
    is_resolved: bool
    auto_action_taken: Optional[str]
    created_at: datetime


# ── Autonomous Decision Schemas ───────────────────────────────
class DecisionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    decision_type: str
    title: str
    trigger_reason: str
    action_taken: str
    ai_confidence_score: Optional[float]
    estimated_cost_saving_usd: Optional[float]
    status: str
    was_overridden_by_human: bool
    created_at: datetime


# ── Dashboard KPI Schema ──────────────────────────────────────
class DashboardKPIs(BaseModel):
    total_suppliers: int
    active_suppliers: int
    high_risk_suppliers: int
    total_facilities: int
    total_products: int
    critical_stock_alerts: int
    shipments_in_transit: int
    shipments_delayed: int
    unresolved_alerts: int
    critical_alerts: int
    autonomous_decisions_today: int
    estimated_cost_savings_usd: float
    avg_supplier_risk_score: float
    supply_risk_index: float   # 0–100 composite score


# ── Telemetry Schemas ─────────────────────────────────────────
class TelemetryEvent(BaseModel):
    event_type: str
    source: str = "fastapi_ingestion"
    timestamp: str
    health_idx: Optional[float] = 100.0
    anomaly_score: Optional[float] = 0.0
    payload: dict


# -- Titan V4 Intelligence Schema (New) -------------------------


class TitanV4IntelligenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    date_key: datetime
    region_name: Optional[str] = "National_Ensemble"
    target_demand: float
    ev_penetration_rate: float
    demand_z_score: Optional[float] = 0.0
    
    # Maker Insights
    reg_tata: float
    reg_mahindra: float
    reg_ola: float
    reg_tvs: float
    reg_ather: float
    reg_bajaj: float
    
    # Segment & Supply Lead Signals
    reg_2w: float
    reg_industrial: float
    reg_pv: float
    battery_lead_signal: float

# -- Analytics Out -----------------------------------
class DemandAnalyticsOut(BaseModel):
    accuracy: float
    mae: float
    elasticity: float
    sensitivity: float
    p: float
    q: float
    m: float

class DemandForecastResponse(BaseModel):
    country: str
    scenario: str
    historical_count: int
    records: List[TitanV4IntelligenceOut]
    analytics: Optional[Dict[str, Any]] = None
