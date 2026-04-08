"""NEXUS-SCM | Automation & Orchestration API Routes"""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from backend.core.database import get_db
from backend.models.autonomous_decision import AutonomousDecision, DecisionType, DecisionStatus
from backend.automation.po_executor import PurchaseOrderExecutor

router = APIRouter(prefix="/automation", tags=["Orchestration"])

@router.post("/execute-replenishment")
def manual_trigger_replenishment(db: Session = Depends(get_db)):
    """
    Manually triggers the Autonomous PO Executor loop.
    Typically this runs on a schedule in production.
    """
    executor = PurchaseOrderExecutor(db)
    count = executor.scan_and_replenish()
    
    return {
        "status": "success",
        "decisions_taken": count,
        "mode": "manual_override_trigger"
    }

@router.get("/audit-logs", response_model=List[Dict[str, Any]])
def get_decision_audit_logs(
    limit: int = Query(50),
    decision_type: Optional[DecisionType] = None,
    db: Session = Depends(get_db)
):
    """
    Returns the history of all autonomous decisions taken by NEXUS-SCM.
    Key for Explainable AI (XAI).
    """
    query = db.query(AutonomousDecision)
    if decision_type:
        query = query.filter(AutonomousDecision.decision_type == decision_type)
        
    results = query.order_by(AutonomousDecision.created_at.desc()).limit(limit).all()
    
    return [
        {
            "id": r.id,
            "title": r.title,
            "type": r.decision_type,
            "trigger": r.trigger_reason,
            "impact": r.estimated_impact,
            "confidence": r.ai_confidence_score,
            "timestamp": r.created_at.isoformat(),
            "status": r.status
        } for r in results
    ]
