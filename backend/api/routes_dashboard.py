"""
NEXUS-SCM | Dashboard KPI Route
Returns the top-level metrics that power the Command Center homepage.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, text
from datetime import datetime, timezone, timedelta

from backend.core.database import get_db
from backend.core.schemas import DashboardKPIs
from backend.models.supplier import Supplier
from backend.models.warehouse import Facility, Inventory
from backend.models.shipment import Shipment, ShipmentStatus
from backend.models.alert import Alert, AlertSeverity
from backend.models.autonomous_decision import AutonomousDecision

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/kpis", response_model=DashboardKPIs)
def get_dashboard_kpis(db: Session = Depends(get_db)):
    """
    Aggregates all KPIs needed for the Command Center dashboard.
    Called every 10 seconds by the frontend for live updates.
    """
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    # ── Supplier Metrics ──────────────────────────────────────
    total_suppliers = db.query(func.count(Supplier.id)).scalar() or 0
    active_suppliers = db.query(func.count(Supplier.id)).filter(
        Supplier.is_active == True
    ).scalar() or 0
    high_risk_suppliers = db.query(func.count(Supplier.id)).filter(
        Supplier.risk_score >= 70
    ).scalar() or 0
    avg_risk = db.query(func.avg(Supplier.risk_score)).scalar() or 0.0

    # ── Facility / Product Metrics ────────────────────────────
    total_facilities = db.query(func.count(Facility.id)).scalar() or 0
    from models.product_sku import ProductSKU
    total_products = db.query(func.count(ProductSKU.id)).scalar() or 0

    # ── Inventory Alerts ──────────────────────────────────────
    # Count inventory rows where on_hand <= reorder_point
    critical_stock = db.query(func.count(Inventory.id)).filter(
        Inventory.quantity_on_hand <= Inventory.reorder_point
    ).scalar() or 0

    # ── Shipment Metrics ──────────────────────────────────────
    in_transit = db.query(func.count(Shipment.id)).filter(
        Shipment.status == ShipmentStatus.IN_TRANSIT
    ).scalar() or 0
    delayed = db.query(func.count(Shipment.id)).filter(
        Shipment.status == ShipmentStatus.DELAYED
    ).scalar() or 0

    # ── Alert Metrics ─────────────────────────────────────────
    unresolved = db.query(func.count(Alert.id)).filter(
        Alert.is_resolved == False
    ).scalar() or 0
    critical = db.query(func.count(Alert.id)).filter(
        Alert.severity == AlertSeverity.CRITICAL,
        Alert.is_resolved == False
    ).scalar() or 0

    # ── Autonomous AI Decisions ───────────────────────────────
    decisions_today = db.query(func.count(AutonomousDecision.id)).filter(
        AutonomousDecision.created_at >= today_start
    ).scalar() or 0

    cost_savings = db.query(
        func.sum(AutonomousDecision.estimated_cost_saving_usd)
    ).scalar() or 0.0

    # ── Titan V4 Intelligence Signal (Asian Import Lead) ───────
    # We pull the latest fleet-wide battery signal to detect Asian port lags
    latest_battery_signal = 100.0
    try:
        q = text("SELECT AVG(battery_lead_signal) FROM public.v4_titan_intelligence_fabric")
        res = db.execute(q).scalar()
        if res is not None: latest_battery_signal = float(res)
    except: pass
    
    # Calculate Import Shortfall (0 if signal >= 100, up to 100 if signal drops)
    # The V4 target is 100. Signal < 50 triggers the "Starvation" alert.
    import_shortfall = max(0.0, 100.0 - (latest_battery_signal))
    critical_stock_factor = min(critical_stock * 5, 100)

    # ── Revised Composite Supply Risk Index (0–100) ───────────
    # Sovereign Weighted: 30% Supplier + 30% Stock + 40% Asian Import Signal
    supply_risk_index = round(
        (avg_risk * 0.3) +
        (critical_stock_factor * 0.3) +
        (import_shortfall * 0.4),
        1
    )

    return DashboardKPIs(
        total_suppliers=total_suppliers,
        active_suppliers=active_suppliers,
        high_risk_suppliers=high_risk_suppliers,
        total_facilities=total_facilities,
        total_products=total_products,
        critical_stock_alerts=critical_stock,
        shipments_in_transit=in_transit,
        shipments_delayed=delayed,
        unresolved_alerts=unresolved,
        critical_alerts=critical,
        autonomous_decisions_today=decisions_today,
        estimated_cost_savings_usd=round(cost_savings, 2),
        avg_supplier_risk_score=round(avg_risk, 1),
        supply_risk_index=supply_risk_index,
    )
