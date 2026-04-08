"""NEXUS-SCM | Logistics Intelligence API Routes"""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from backend.core.database import get_db
from backend.models.warehouse import Facility, FacilityType
from backend.ml.logistics.optimizer import LogisticsOptimizer

router = APIRouter(tags=["Logistics Discovery"])
optimizer = LogisticsOptimizer()

@router.get("/logistics/routes")
async def get_logistics_routes(
    simulation: bool = Query(True),
    priority: str = Query("balanced"),
    origin: Optional[str] = Query(None),
    destination: Optional[str] = Query(None)
):
    """
    Returns AI-optimized logistics routes or a full network snapshot.
    """
    if origin and destination:
        result = optimizer.find_optimal_route(origin, destination, priority)
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        return result
    
    if simulation:
        return optimizer.simulate_global_network()
    
    return {"status": "success", "message": "Specify origin and destination for optimization."}

@router.get("/logistics/hubs")
async def get_logistics_hubs():
    """
    Returns a list of global logistics hubs (nodes) supported by the optimizer.
    """
    return optimizer.nodes
