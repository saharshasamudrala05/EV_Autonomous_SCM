"""NEXUS-SCM | Inventory & Facility API Routes"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List
from backend.core.database import get_db
from backend.core.schemas import FacilityOut, InventoryOut
from backend.models.warehouse import Facility, Inventory
from backend.models.product_sku import ProductSKU
from backend.ml.inventory.optimizer import InventoryOptimizer
from backend.api.routes_forecast import get_ev_sales_forecast

router = APIRouter(prefix="/inventory", tags=["Inventory Intelligence"])
optimizer = InventoryOptimizer()

@router.get("/facilities", response_model=List[FacilityOut])
def list_facilities(db: Session = Depends(get_db)):
    return db.query(Facility).filter(Facility.is_operational == True).all()


@router.get("/stock", response_model=List[InventoryOut])
def get_stock_levels(
    below_reorder_only: bool = Query(False),
    facility_id: int = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Inventory)
    if facility_id:
        q = q.filter(Inventory.facility_id == facility_id)
    if below_reorder_only:
        # SQLAlchemy column comparison for the reorder check
        q = q.filter(Inventory.quantity_on_hand <= Inventory.reorder_point)
    return q.all()


@router.get("/recommendations")
def get_inventory_recommendations(db: Session = Depends(get_db)):
    """
    Returns AI-generated action protocols for current stock levels.
    """
    # 1. Fetch current forecast to drive the logic
    try:
        forecast_data = get_ev_sales_forecast(country="India", db=db)
    except Exception:
        forecast_data = None

    inventory = db.query(Inventory).all()
    # Convert SQLAlchemy model to dict for processing
    inv_list = [
        {
            "id": i.id,
            "product_id": i.product_id,
            "facility_id": i.facility_id,
            "quantity_on_hand": i.quantity_on_hand,
            "reorder_point": i.reorder_point
        } 
        for i in inventory
    ]
    return optimizer.generate_stock_recommendations(inv_list, forecast_signals=forecast_data)


@router.get("/flows")
def get_inventory_flows():
    """
    Simulates the global neural stock movement pulse.
    """
    return optimizer.simulate_echelon_flow()


@router.get("/alerts")
def get_low_stock_alerts(db: Session = Depends(get_db)):
    """Returns items that are at or below their reorder point — ready for AI action."""
    low = db.query(Inventory).filter(
        Inventory.quantity_on_hand <= Inventory.reorder_point
    ).all()
    return [
        {
            "inventory_id": i.id,
            "product_id": i.product_id,
            "facility_id": i.facility_id,
            "quantity_on_hand": i.quantity_on_hand,
            "reorder_point": i.reorder_point,
            "deficit": i.reorder_point - i.quantity_on_hand,
            "stock_health_pct": i.stock_health_pct,
        }
        for i in low
    ]
