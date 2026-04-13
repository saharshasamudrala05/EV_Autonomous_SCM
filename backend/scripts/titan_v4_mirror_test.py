
import sys
import os
from sqlalchemy import func, text
from datetime import datetime, timezone

# Ensure project root is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

try:
    from backend.core.database import SessionLocal
    from backend.models.supplier import Supplier
    from backend.models.warehouse import Facility, Inventory
    from backend.models.shipment import Shipment, ShipmentStatus
    from backend.models.alert import Alert, AlertSeverity
    from backend.models.autonomous_decision import AutonomousDecision
    from backend.models.network import NetworkNode
    from backend.models.product_sku import ProductSKU

    db = SessionLocal()
    print(">>> CERTIFICATION: Commencing Mirror Test...")
    
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    print("1. Suppliers...")
    total_suppliers = db.query(func.count(Supplier.id)).scalar() or 0
    print(f"   {total_suppliers}")
    
    print("2. Facilities...")
    total_facilities = db.query(func.count(NetworkNode.node_id)).scalar() or 0
    print(f"   {total_facilities}")

    print("3. Products...")
    total_products = db.query(func.count(ProductSKU.id)).scalar() or 0
    print(f"   {total_products}")

    print("4. Inventory...")
    critical_stock = db.query(func.count(Inventory.id)).filter(
        Inventory.quantity_on_hand <= Inventory.reorder_point
    ).scalar() or 0
    print(f"   {critical_stock}")

    print("5. Shipments...")
    in_transit = db.query(func.count(Shipment.id)).filter(
        Shipment.status == ShipmentStatus.IN_TRANSIT
    ).scalar() or 0
    print(f"   {in_transit}")

    print("6. Alerts...")
    unresolved = db.query(func.count(Alert.id)).filter(
        Alert.is_resolved == False
    ).scalar() or 0
    print(f"   {unresolved}")

    print("7. Decisions...")
    decisions_today = db.query(func.count(AutonomousDecision.id)).filter(
        AutonomousDecision.created_at >= today_start
    ).scalar() or 0
    print(f"   {decisions_today}")

    print("8. Titan V4 IQ Signal...")
    latest_battery_signal = 100.0
    q = text("SELECT AVG(battery_lead_signal) FROM public.v4_titan_intelligence_fabric")
    res = db.execute(q).scalar()
    if res is not None: latest_battery_signal = float(res)
    print(f"   {latest_battery_signal}")

    print(">>> STATUS: 200 OK")
    db.close()
    sys.exit(0)
except Exception as e:
    import traceback
    print(">>> STATUS: 500 FAIL")
    traceback.print_exc()
    sys.exit(1)
