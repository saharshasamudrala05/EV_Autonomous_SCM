"""NEXUS-SCM | Shipment & Alert API Routes"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List
from backend.core.database import get_db
from backend.core.schemas import ShipmentOut, AlertOut, DecisionOut
from backend.models.shipment import Shipment, ShipmentStatus
from backend.models.alert import Alert, AlertSeverity
from backend.models.autonomous_decision import AutonomousDecision

router = APIRouter(tags=["Logistics & Alerts"])


# ── Shipments ─────────────────────────────────────────────────
@router.get("/shipments", response_model=List[ShipmentOut])
def list_shipments(
    status: str = Query(None),
    limit: int = Query(50),
    db: Session = Depends(get_db),
):
    q = db.query(Shipment)
    if status:
        q = q.filter(Shipment.status == status)
    return q.order_by(Shipment.created_at.desc()).limit(limit).all()


# ── Alerts ────────────────────────────────────────────────────
@router.get("/alerts", response_model=List[AlertOut])
def list_alerts(
    unresolved_only: bool = Query(True),
    severity: str = Query(None),
    limit: int = Query(50),
    db: Session = Depends(get_db),
):
    q = db.query(Alert)
    if unresolved_only:
        q = q.filter(Alert.is_resolved == False)
    if severity:
        q = q.filter(Alert.severity == severity)
    return q.order_by(Alert.created_at.desc()).limit(limit).all()


# ── Autonomous Decisions ───────────────────────────────────────
@router.get("/decisions", response_model=List[DecisionOut])
def list_decisions(
    limit: int = Query(50),
    db: Session = Depends(get_db),
):
    return (
        db.query(AutonomousDecision)
        .order_by(AutonomousDecision.created_at.desc())
        .limit(limit)
        .all()
    )
