from fastapi import APIRouter, status
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from datetime import datetime, timezone

from backend.config import settings
from backend.core.database import check_connection, get_db
from backend.core.schemas import TelemetryEvent
from backend.models.alert import Alert, AlertType, AlertSeverity
from backend.models.demand_signal import DemandSignal, SignalSource
from backend.data_pipeline.kafka_producer import send_event

router = APIRouter(prefix="/telemetry", tags=["Ingestion"])

@router.post("/", status_code=status.HTTP_202_ACCEPTED)
async def ingest_telemetry(payload: TelemetryEvent):
    """
    Non-blocking FastAPI Ingestion.
    Accepts telemetry and passes it to the Kafka Producer immediately.
    """
    topic = settings.TOPIC_SUPPLY
    if "demand" in payload.event_type.lower():
        topic = settings.TOPIC_DEMAND
    elif "price" in payload.event_type.lower() or "market" in payload.event_type.lower():
        topic = settings.TOPIC_PRICE
        
    send_event(topic, payload.model_dump())
    return {"status": "Accepted", "message": "Telemetry queued for ingestion"}
