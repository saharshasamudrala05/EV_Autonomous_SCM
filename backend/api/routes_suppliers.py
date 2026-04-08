"""NEXUS-SCM | Supplier API Routes"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List
from backend.core.database import get_db
from backend.core.schemas import SupplierOut
from backend.models.supplier import Supplier

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])


@router.get("/", response_model=List[SupplierOut])
def list_suppliers(
    active_only: bool = Query(True),
    min_risk: float = Query(0),
    max_risk: float = Query(100),
    db: Session = Depends(get_db),
):
    q = db.query(Supplier).filter(
        Supplier.risk_score >= min_risk,
        Supplier.risk_score <= max_risk,
    )
    if active_only:
        q = q.filter(Supplier.is_active == True)
    return q.order_by(Supplier.risk_score.desc()).all()


@router.get("/{supplier_id}", response_model=SupplierOut)
def get_supplier(supplier_id: int, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    s = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return s
