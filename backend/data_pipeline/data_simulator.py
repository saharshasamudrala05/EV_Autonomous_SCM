"""
NEXUS-SCM | Real-time Data Simulator
Continuously generates realistic EV supply chain events and writes them
directly to PostgreSQL (Kafka-free dev mode) or sends to Kafka topics.

Run:  python data_pipeline/data_simulator.py
Stop: Ctrl+C
"""
import sys, os, time, random, json

from datetime import datetime, timezone, timedelta
import os
os.environ["PYTHONIOENCODING"] = "utf-8"

def rprint(msg=""):
    import re
    clean = re.sub(r'\[/?[^\]]*\]', '', str(msg))
    print(clean)

from core.database import SessionLocal, check_connection
from core.schemas import TelemetryEvent
from backend.models.demand_signal import DemandSignal, SignalSource
from backend.models.alert import Alert, AlertType, AlertSeverity
from backend.models.warehouse import Inventory
from backend.models.shipment import Shipment, ShipmentStatus
from config import settings

COUNTRIES = ["India", "China", "USA", "Germany", "UK", "Norway", "France"]
INDIA_MONTHLY_BASE = 120_000    # ~1.4M/year baseline for India
DEMAND_VOLATILITY = 0.12        # ±12% random noise
EVENT_INTERVAL_SECONDS = 5      # generate an event every N seconds

# Global Macro State (simulated internal trackers)
_macro_state = {
    "battery_price": 200.0,
    "charging_infra": 2500.0
}


def simulate_demand_signal(db) -> DemandSignal:
    """Generates an EV market signal (Sales, Battery Price, or Infrastructure)."""
    country = random.choice(COUNTRIES)
    now = datetime.now(timezone.utc)
    
    # Randomly pick which signal type to generate
    signal_type = random.choices(
        ["EV sales", "Battery Price Index", "Charging Infrastructure Growth"],
        weights=[0.6, 0.2, 0.2]
    )[0]

    if signal_type == "EV sales":
        base = INDIA_MONTHLY_BASE if country == "India" else random.randint(20_000, 800_000)
        noise = 1 + random.uniform(-DEMAND_VOLATILITY, DEMAND_VOLATILITY)
        value = max(0, int(base * noise))
    elif signal_type == "Battery Price Index":
        # Simulate gradual cost reduction
        _macro_state["battery_price"] *= 0.998 # Organic 0.2% drop per signal
        value = _macro_state["battery_price"] + random.uniform(-2, 2)
    else: # Charging Infrastructure
        _macro_state["charging_infra"] += random.randint(10, 50)
        value = _macro_state["charging_infra"]

    event_timestamp = now.isoformat()
    # Explicitly enforce payload integrity using core/schemas.py TelemetryEvent
    TelemetryEvent(
        event_type="demand_signal",
        timestamp=event_timestamp,
        health_idx=100.0,
        anomaly_score=round(random.uniform(0.01, 0.2), 2),
        payload={"country": country, "value": value}
    )

    signal = DemandSignal(
        country=country,
        year=now.year,
        month=now.month,
        parameter=signal_type,
        mode=random.choice(["Cars", "Two-Wheelers", "Buses"]) if signal_type == "EV sales" else None,
        powertrain=random.choice(["BEV", "PHEV"]) if signal_type == "EV sales" else None,
        value=value,
        cumulative_policy_score=round(random.uniform(5.0, 25.0), 1),
        category="Simulated",
        source=SignalSource.SIMULATION,
        event_timestamp=now,
    )
    db.add(signal)
    db.commit()
    return signal


def simulate_inventory_depletion(db) -> dict | None:
    """Randomly depletes inventory at a facility to mimic production consumption."""
    inv = db.query(Inventory).order_by(Inventory.id).all()
    if not inv:
        return None
    item = random.choice(inv)
    consumption = random.randint(100, 800)
    old_qty = item.quantity_on_hand
    item.quantity_on_hand = max(0, item.quantity_on_hand - consumption)

    # Raise alert if newly below reorder
    if item.quantity_on_hand <= item.reorder_point and old_qty > item.reorder_point:
        alert = Alert(
            alert_type=AlertType.STOCK_BELOW_REORDER,
            severity=AlertSeverity.WARNING,
            title=f"Stock Alert: Product #{item.product_id} at Facility #{item.facility_id}",
            message=f"Stock depleted to {item.quantity_on_hand} (reorder point: {item.reorder_point}). "
                    f"Auto-reorder will be triggered by AI engine.",
            entity_type="inventory",
            entity_id=item.id,
            is_resolved=False,
        )
        db.add(alert)

    db.commit()
    
    # Enforce Payload Integrity
    TelemetryEvent(
        event_type="inventory_depletion",
        timestamp=datetime.now(timezone.utc).isoformat(),
        health_idx=round((item.quantity_on_hand / max(1, item.reorder_point)) * 100, 1),
        anomaly_score=round(random.uniform(0.01, 0.4), 2),
        payload={
            "product_id": item.product_id, 
            "facility_id": item.facility_id,
            "qty_before": old_qty, 
            "qty_after": item.quantity_on_hand
        }
    )
    
    return {"product_id": item.product_id, "facility_id": item.facility_id,
            "qty_before": old_qty, "qty_after": item.quantity_on_hand}


def simulate_shipment_progress(db) -> dict | None:
    """Randomly advances or delays an in-transit shipment."""
    in_transit = db.query(Shipment).filter(
        Shipment.status == ShipmentStatus.IN_TRANSIT
    ).all()
    if not in_transit:
        return None
    ship = random.choice(in_transit)
    event = random.choices(
        ["progress", "delay", "deliver"],
        weights=[0.70, 0.20, 0.10]
    )[0]

    if event == "delay":
        ship.status = ShipmentStatus.DELAYED
        ship.delay_reason = random.choice([
            "Port congestion at transhipment hub.",
            "Adverse weather conditions in Bay of Bengal.",
            "Carrier equipment failure — container swap required.",
            "Export license delay from origin country.",
        ])
        alert = Alert(
            alert_type=AlertType.SHIPMENT_DELAYED,
            severity=AlertSeverity.WARNING,
            title=f"DELAYED: {ship.shipment_code}",
            message=f"Shipment {ship.shipment_code} ({ship.transport_mode.value}) "
                    f"has been delayed. Reason: {ship.delay_reason}",
            entity_type="shipment",
            entity_id=ship.id,
            entity_name=ship.shipment_code,
            is_resolved=False,
        )
        db.add(alert)
        db.commit()
        
        TelemetryEvent(
            event_type="shipment_progress",
            timestamp=datetime.now(timezone.utc).isoformat(),
            health_idx=25.0,
            anomaly_score=0.9,
            payload={"shipment": ship.shipment_code, "status": "delayed"}
        )
        return {"shipment": ship.shipment_code, "new_status": "delayed"}

    elif event == "deliver":
        ship.status = ShipmentStatus.DELIVERED
        ship.actual_arrival_dt = datetime.now(timezone.utc)
        db.commit()
        return {"shipment": ship.shipment_code, "new_status": "delivered"}

    TelemetryEvent(
        event_type="shipment_progress",
        timestamp=datetime.now(timezone.utc).isoformat(),
        health_idx=100.0,
        anomaly_score=0.01,
        payload={"shipment": ship.shipment_code, "status": "in_transit"}
    )
    return {"shipment": ship.shipment_code, "new_status": "in_transit (progressing)"}


def run_simulation():
    if not check_connection():
        rprint("[X] DB not reachable. Run docker-compose up first.")
        sys.exit(1)

    rprint("\n>>> NEXUS-SCM Real-Time Data Simulator Started")
    rprint(f"Generating events every {EVENT_INTERVAL_SECONDS}s  |  Ctrl+C to stop\n")

    cycle = 0
    while True:
        cycle += 1
        db = SessionLocal()
        try:
            event_type = random.choices(
                ["demand", "inventory", "shipment"],
                weights=[0.50, 0.30, 0.20]
            )[0]

            if event_type == "demand":
                sig = simulate_demand_signal(db)
                rprint(
                    f"#{cycle:04d} [DEMAND] | "
                    f"{sig.country} | {sig.parameter} | {int(sig.value):,} units"
                )

            elif event_type == "inventory":
                result = simulate_inventory_depletion(db)
                if result:
                    status = "BELOW REORDER" if result["qty_after"] <= 1000 else "CONSUMED" 
                    rprint(
                        f"#{cycle:04d} [{status}] | "
                        f"Prod#{result['product_id']} at Fac#{result['facility_id']} | "
                        f"{result['qty_before']:,} -> {result['qty_after']:,}"
                    )

            elif event_type == "shipment":
                result = simulate_shipment_progress(db)
                if result:
                    status_flag = "DELAY" if "delayed" in result["new_status"] else "MOVE"
                    rprint(
                        f"#{cycle:04d} [{status_flag}] | "
                        f"{result['shipment']} -> {result['new_status']}"
                    )

        except Exception as e:
            rprint(f"[red]Event #{cycle} error: {e}[/red]")
        finally:
            db.close()

        time.sleep(EVENT_INTERVAL_SECONDS)


if __name__ == "__main__":
    try:
        run_simulation()
    except KeyboardInterrupt:
        rprint("\n[STOP] Simulator stopped.")
