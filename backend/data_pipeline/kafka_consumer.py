"""
NEXUS-SCM | Kafka Consumer
Subscribes to EV SCM topics and writes ingested events to PostgreSQL.
Gracefully works without Kafka (for local dev without Docker Kafka).

Run: python data_pipeline/kafka_consumer.py
"""
import sys, os, json, time
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime, timezone
from rich import print as rprint
from config import settings
from core.database import SessionLocal, check_connection
from models.demand_signal import DemandSignal, SignalSource
from models.alert import Alert, AlertType, AlertSeverity
import numpy as np
from pydantic import BaseModel
from sklearn.ensemble import IsolationForest

class AnomalyResult(BaseModel):
    is_anomaly: bool
    anomaly_score: float
    reason: str

class AIInferenceEngine:
    def __init__(self):
        self.model = IsolationForest(n_estimators=100, contamination=0.01, random_state=42)
        self.is_fitted = False
        
    def score_batch(self, features_array: np.ndarray) -> list[AnomalyResult]:
        if len(features_array) == 0:
            return []
            
        if not self.is_fitted:
            X_train = features_array
            if len(X_train) < 10:
                dummy = np.random.normal(loc=np.mean(X_train), scale=1.0, size=(10 - len(X_train), features_array.shape[1]))
                X_train = np.vstack((X_train, dummy))
            self.model.fit(X_train)
            self.is_fitted = True
            
        preds = self.model.predict(features_array)
        scores = self.model.decision_function(features_array)
        
        results = []
        for pred, score in zip(preds, scores):
            is_anomaly = bool(pred == -1)
            # Normalize score
            norm_score = float(max(0.0, min(1.0, -score + 0.5))) if is_anomaly else float(max(0.0, 0.5 - score))
            reason = "Statistically significant variance detected" if is_anomaly else "Normal telemetry"
            results.append(AnomalyResult(is_anomaly=is_anomaly, anomaly_score=norm_score, reason=reason))
        return results

inference_engine = AIInferenceEngine()

KAFKA_AVAILABLE = False
consumer = None
TOPICS = [
    settings.TOPIC_DEMAND,
    settings.TOPIC_SUPPLY,
    settings.TOPIC_SHIPMENT,
    settings.TOPIC_PRICE,
]


def init_kafka():
    global KAFKA_AVAILABLE, consumer
    if not settings.ENABLE_KAFKA:
        rprint("[yellow]Kafka disabled in config.[/yellow]")
        return
    try:
        from confluent_kafka import Consumer
        conf = {
            "bootstrap.servers": settings.KAFKA_BOOTSTRAP_SERVERS,
            "group.id": settings.KAFKA_GROUP_ID,
            "auto.offset.reset": "earliest",
            "socket.timeout.ms": 5000,
            "session.timeout.ms": 10000,
        }
        consumer = Consumer(conf)
        consumer.subscribe(TOPICS)
        KAFKA_AVAILABLE = True
        rprint(f"[bold green]✅ Kafka consumer subscribed to: {', '.join(TOPICS)}[/bold green]")
    except Exception as e:
        rprint(f"[yellow]⚠️  Kafka not available ({e}). Consumer in standby.[/yellow]")


from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert
from models.warehouse import Inventory

def flush_batch(batch: list, db):
    """Processes a micro-batch of telemetry payloads and commits using SQLAlchemy 2.0 Bulk Operations."""
    if not batch: return

    demand_events = []
    supply_deltas = {}  # (product_id, facility_id) -> qty_delta
    new_alerts = []

    # Prepare features for numpy vectorized batch scoring
    features = []
    for payload in batch:
        val = 0.0
        p_data = payload.get("payload", payload)
        event_type = payload.get("event_type", "unknown")
        if "demand" in event_type:
            val = float(p_data.get("value", 0.0))
        elif "supply" in event_type or "inventory" in event_type:
            val = float(p_data.get("quantity_delta", 0.0))
        elif "qty_after" in p_data and "qty_before" in p_data:
            val = float(p_data["qty_after"] - p_data["qty_before"])
        features.append([val])

    features_array = np.array(features)
    inference_results = inference_engine.score_batch(features_array)

    for i, payload in enumerate(batch):
        event_type = payload.get("event_type", "unknown")
        
        # Merge inference results
        payload["is_anomaly"] = inference_results[i].is_anomaly
        payload["anomaly_score"] = inference_results[i].anomaly_score
        payload["anomaly_reason"] = inference_results[i].reason
        
        if payload["is_anomaly"]:
            new_alerts.append({
                "alert_type": AlertType.SYSTEM if "demand" not in event_type else AlertType.DEMAND_SPIKE,
                "severity": AlertSeverity.WARNING,
                "title": f"Telemetry Anomaly Detected (Score: {payload['anomaly_score']:.2f})",
                "message": payload["anomaly_reason"],
                "created_at": datetime.now(timezone.utc),
                "is_resolved": False
            })
        
        if "demand" in event_type:
            # For data simulator structured events (payload inside payload key)
            p_data = payload.get("payload", payload)
            demand_events.append({
                "country": p_data.get("country", "Unknown"),
                "year": p_data.get("year", datetime.now().year),
                "month": p_data.get("month"),
                "parameter": p_data.get("parameter", "EV sales"),
                "mode": p_data.get("mode"),
                "powertrain": p_data.get("powertrain"),
                "value": p_data.get("value", 0),
                "cumulative_policy_score": p_data.get("cumulative_policy_score", 0.0),
                "category": "Kafka-Ingested",
                "source": SignalSource.KAFKA_STREAM,
                "event_timestamp": datetime.now(timezone.utc),
            })
            
        elif "supply_event" in event_type or "inventory" in event_type:
            p_data = payload.get("payload", payload)
            pid = p_data.get("product_id")
            fid = p_data.get("facility_id")
            
            if "quantity_delta" in p_data:
                delta = p_data.get("quantity_delta", 0)
            elif "qty_after" in p_data and "qty_before" in p_data:
                delta = p_data["qty_after"] - p_data["qty_before"]
            else:
                delta = 0

            if pid and fid:
                supply_deltas[(pid, fid)] = supply_deltas.get((pid, fid), 0) + delta

        elif "price_event" in event_type:
            p_data = payload.get("payload", payload)
            rprint(f"   [dim]Price logged: {p_data.get('material')} ${p_data.get('price_usd_per_kg')}/kg[/dim]")

    try:
        # 1. Bulk Upsert Demand Signals (DO NOTHING on conflict)
        if demand_events:
            stmt = insert(DemandSignal).values(demand_events)
            stmt = stmt.on_conflict_do_nothing()
            db.execute(stmt)
            rprint(f"   [dim]Bulk inserted {len(demand_events)} demand signals.[/dim]")

        # 2. Bulk/Batch Update Inventory with raw SQL for optimal performance
        if supply_deltas:
            for (pid, fid), delta in supply_deltas.items():
                if delta == 0: continue
                db.execute(
                    text("UPDATE inventory SET quantity_on_hand = GREATEST(0, quantity_on_hand + :delta) WHERE product_id = :pid AND facility_id = :fid"),
                    {"delta": delta, "pid": pid, "fid": fid}
                )
            rprint(f"   [dim]Aggregated and updated {len(supply_deltas)} inventory records.[/dim]")
            
        # 3. Bulk Upsert Anomalies via Alerts
        if new_alerts:
            stmt_alert = insert(Alert).values(new_alerts)
            db.execute(stmt_alert)
            rprint(f"   [dim]Bulk inserted {len(new_alerts)} ML anomaly alerts.[/dim]")

        db.commit()
    except Exception as e:
        db.rollback()
        rprint(f"[bold red]Batch commit failed, rolled back to preserve DB: {e}[/bold red]")


def run():
    if not check_connection():
        rprint("[bold red]❌ DB not reachable. Run docker-compose up first.[/bold red]")
        sys.exit(1)

    init_kafka()

    if not KAFKA_AVAILABLE:
        rprint("[yellow]Running in standby — no Kafka messages to consume.[/yellow]")
        rprint("[dim]Start Kafka with: docker-compose up -d kafka[/dim]")
        rprint("[dim]Then send events with: python data_pipeline/kafka_producer.py[/dim]")
        return

    rprint("\n[bold cyan]📥 NEXUS-SCM Kafka Consumer Running[/bold cyan]")
    rprint("[dim]Listening for events... Ctrl+C to stop[/dim]\n")

    msg_count = 0
    batch = []
    last_flush_time = time.time()
    BATCH_SIZE = 500
    FLUSH_INTERVAL = 2.0

    while True:
        msg = consumer.poll(timeout=1.0)
        
        if msg is not None:
            if msg.error():
                rprint(f"[red]Consumer error: {msg.error()}[/red]")
            else:
                msg_count += 1
                try:
                    payload = json.loads(msg.value().decode("utf-8"))
                    batch.append(payload)
                except json.JSONDecodeError:
                    rprint(f"[red]Invalid JSON in message at offset {msg.offset()}[/red]")

        current_time = time.time()
        if len(batch) >= BATCH_SIZE or (current_time - last_flush_time >= FLUSH_INTERVAL and len(batch) > 0):
            rprint(f"[cyan]Flushing batch of {len(batch)} events... (Total processed: {msg_count})[/cyan]")
            db = SessionLocal()
            try:
                flush_batch(batch, db)
            except Exception as e:
                db.rollback()
                rprint(f"[red]Fatal batch error: {e}[/red]")
            finally:
                db.close()
                
            batch.clear()
            last_flush_time = current_time


if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        rprint("\n[yellow]⏹️  Consumer stopped.[/yellow]")
        if consumer:
            consumer.close()
