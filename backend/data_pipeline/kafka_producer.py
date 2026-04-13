"""
NEXUS-SCM | Kafka Producer
Streams simulated EV SCM events to Kafka topics.
Gracefully falls back to console logging if Kafka is unavailable.

Run: python data_pipeline/kafka_producer.py
"""
import sys, os, time, random, json

from datetime import datetime, timezone
from rich import print as rprint
from backend.config import settings

COUNTRIES = ["India", "China", "USA", "Germany", "Norway", "UK", "France"]
KAFKA_AVAILABLE = False
producer = None


def init_kafka():
    global KAFKA_AVAILABLE, producer
    if not settings.ENABLE_KAFKA:
        rprint("[yellow]ℹ️  Kafka disabled in config (ENABLE_KAFKA=false)[/yellow]")
        return
    try:
        from confluent_kafka import Producer
        conf = {
            "bootstrap.servers": settings.KAFKA_BOOTSTRAP_SERVERS,
            "client.id": "nexus-scm-producer",
            "socket.timeout.ms": 5000,
        }
        producer = Producer(conf)
        # Test connection with metadata fetch
        producer.list_topics(timeout=5)
        KAFKA_AVAILABLE = True
        rprint(f"[bold green]✅ Kafka connected: {settings.KAFKA_BOOTSTRAP_SERVERS}[/bold green]")
    except Exception as e:
        rprint(f"[yellow]⚠️  Kafka unavailable ({e}). Running in log-only mode.[/yellow]")


def delivery_report(err, msg):
    if err:
        rprint(f"[red]Delivery failed: {err}[/red]")


def send_event(topic: str, payload: dict):
    """Sends a JSON event to a Kafka topic (or logs it if Kafka is down)."""
    message = json.dumps(payload, default=str)
    if KAFKA_AVAILABLE and producer:
        producer.produce(topic, value=message.encode("utf-8"), callback=delivery_report)
        # Asynchronous delivery relies on the background poll loop
    else:
        rprint(f"  [dim][LOG] Topic={topic} | {message[:80]}...[/dim]")


def build_demand_event() -> dict:
    country = random.choice(COUNTRIES)
    return {
        "event_type": "demand_signal",
        "country": country,
        "year": datetime.now().year,
        "month": datetime.now().month,
        "parameter": "EV sales",
        "mode": random.choice(["Cars", "Two-Wheelers"]),
        "powertrain": random.choice(["BEV", "PHEV"]),
        "value": random.randint(5_000, 200_000),
        "cumulative_policy_score": round(random.uniform(5.0, 25.0), 2),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "kafka_stream",
    }


def build_supply_event() -> dict:
    return {
        "event_type": "supply_event",
        "facility_id": random.randint(1, 7),
        "product_id": random.randint(1, 8),
        "event_subtype": random.choice(["stock_depletion", "stock_replenishment"]),
        "quantity_delta": random.choice([-1, 1]) * random.randint(200, 5000),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def build_price_event() -> dict:
    materials = ["Lithium Hydroxide", "Cobalt", "NMC Cathode", "Sodium Carbonate"]
    return {
        "event_type": "price_event",
        "material": random.choice(materials),
        "price_usd_per_kg": round(random.uniform(8.0, 80.0), 2),
        "change_pct": round(random.uniform(-5.0, 8.0), 2),
        "source_market": random.choice(["LME", "CME", "Shanghai Metal Market"]),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def run():
    init_kafka()
    rprint("\n[bold cyan]📡 NEXUS-SCM Kafka Producer Started[/bold cyan]")
    rprint("[dim]Press Ctrl+C to stop[/dim]\n")

    cycle = 0
    while True:
        cycle += 1
        event_type = random.choices(
            ["demand", "supply", "price"],
            weights=[0.50, 0.35, 0.15]
        )[0]

        if event_type == "demand":
            payload = build_demand_event()
            send_event(settings.TOPIC_DEMAND, payload)
            rprint(f"[cyan]#{cycle:04d}[/cyan] 📈 → [{settings.TOPIC_DEMAND}] {payload['country']} {payload['value']:,} EVs")

        elif event_type == "supply":
            payload = build_supply_event()
            send_event(settings.TOPIC_SUPPLY, payload)
            rprint(f"[cyan]#{cycle:04d}[/cyan] 📦 → [{settings.TOPIC_SUPPLY}] Facility#{payload['facility_id']} delta={payload['quantity_delta']:+,}")

        elif event_type == "price":
            payload = build_price_event()
            send_event(settings.TOPIC_PRICE, payload)
            icon = "📈" if payload["change_pct"] > 0 else "📉"
            rprint(f"[cyan]#{cycle:04d}[/cyan] {icon} → [{settings.TOPIC_PRICE}] {payload['material']} ${payload['price_usd_per_kg']}/kg ({payload['change_pct']:+.1f}%)")

        if KAFKA_AVAILABLE and producer:
            # Non-blocking poll handles delivery callbacks without blocking the main event stream
            producer.poll(0)

        time.sleep(3)


if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        rprint("\n[yellow]⏹️  Producer stopped.[/yellow]")
