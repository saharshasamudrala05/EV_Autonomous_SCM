"""
NEXUS-SCM | Database Seeder
Populates the database with realistic EV industry data:
  - 10 global EV battery suppliers with real risk profiles
  - 7 Indian EV facilities (Gigafactories → Distribution Centres)
  - 8 critical EV battery SKUs
  - Inventory levels (some stressed, some healthy — for AI to act on)
  - 20 real-world shipments (mix of statuses)
  - 10 seeded alerts and 12 autonomous decision records

Run: python data_pipeline/seed_database.py
"""
import sys
import os

from datetime import datetime, timedelta, timezone, date
import os
os.environ["PYTHONIOENCODING"] = "utf-8"

# Use plain print to avoid Rich's Windows legacy console encoding issues
def rprint(msg=""):
    """Windows-safe print: strips Rich markup for plain output."""
    import re
    clean = re.sub(r'\[/?[^\]]*\]', '', str(msg))
    print(clean)

from backend.core.database import SessionLocal, create_all_tables, check_connection
from backend.models.supplier import Supplier, GeopoliticalRisk
from backend.models.product_sku import ProductSKU, BatteryChemistry, ProductCategory, BatteryTechProfile
from backend.models.warehouse import Facility, FacilityType, Inventory
from backend.models.shipment import Shipment, ShipmentStatus, TransportMode
from backend.models.alert import Alert, AlertType, AlertSeverity
from backend.models.autonomous_decision import AutonomousDecision, DecisionType, DecisionStatus

BATTERY_TECH_PROFILES = [
    {
        "name": "Lithium-Ion (NMC)",
        "trl": 9,
        "capex_per_gwh": 80e6,
        "opex_rate": 0.03,
        "material_cost_per_kwh": 115.0 
    },
    {
        "name": "Sodium-Ion",
        "trl": 7,
        "capex_per_gwh": 100e6,
        "opex_rate": 0.04,
        "material_cost_per_kwh": 65.0 
    },
    {
        "name": "Lithium-Iron-Phosphate (LFP)",
        "trl": 9,
        "capex_per_gwh": 70e6,
        "opex_rate": 0.03,
        "material_cost_per_kwh": 95.0
    },
    {
        "name": "Solid-State Batteries",
        "trl": 4, 
        "capex_per_gwh": 150e6,
        "opex_rate": 0.05,
        "material_cost_per_kwh": 130.0
    }
]

now = datetime.now(timezone.utc)


# ═══════════════════════════════════════════════════════════════
# 1. SUPPLIERS  (Global EV Battery & Material Suppliers)
# ═══════════════════════════════════════════════════════════════
SUPPLIERS = [
    dict(
        supplier_code="SUP-CATL-001",
        name="CATL (Contemporary Amperex Technology)",
        country="China", city="Ningde",
        materials_supplied="NMC cells, LFP cells, Battery Packs",
        product_categories="battery_cell,battery_pack",
        lead_time_days=45, on_time_delivery_rate=0.88, quality_score=9.1,
        risk_score=72.0, geopolitical_risk=GeopoliticalRisk.HIGH,
        supply_concentration_risk=0.82,
        contract_value_usd=450_000_000, contract_expiry_year=2027,
        is_preferred=True, is_active=True,
    ),
    dict(
        supplier_code="SUP-BYD-002",
        name="BYD Company Limited",
        country="China", city="Shenzhen",
        materials_supplied="LFP Blade Battery, Battery Packs",
        product_categories="battery_cell,battery_pack",
        lead_time_days=40, on_time_delivery_rate=0.91, quality_score=8.9,
        risk_score=68.0, geopolitical_risk=GeopoliticalRisk.HIGH,
        supply_concentration_risk=0.75,
        contract_value_usd=200_000_000, contract_expiry_year=2026,
        is_preferred=True, is_active=True,
    ),
    dict(
        supplier_code="SUP-PANA-003",
        name="Panasonic Energy Co.",
        country="Japan", city="Osaka",
        materials_supplied="NCA Cylindrical Cells, 21700 Format",
        product_categories="battery_cell",
        lead_time_days=55, on_time_delivery_rate=0.95, quality_score=9.5,
        risk_score=28.0, geopolitical_risk=GeopoliticalRisk.LOW,
        supply_concentration_risk=0.35,
        contract_value_usd=150_000_000, contract_expiry_year=2028,
        is_preferred=True, is_active=True,
    ),
    dict(
        supplier_code="SUP-SDIS-004",
        name="Samsung SDI",
        country="South Korea", city="Yongin",
        materials_supplied="NMC-811 Pouch Cells, Prismatic Cells",
        product_categories="battery_cell",
        lead_time_days=50, on_time_delivery_rate=0.93, quality_score=9.3,
        risk_score=32.0, geopolitical_risk=GeopoliticalRisk.LOW,
        supply_concentration_risk=0.40,
        contract_value_usd=175_000_000, contract_expiry_year=2027,
        is_preferred=False, is_active=True,
    ),
    dict(
        supplier_code="SUP-ALBM-005",
        name="Albemarle Corporation",
        country="USA", city="Charlotte",
        materials_supplied="Lithium Hydroxide, Lithium Carbonate",
        product_categories="raw_material",
        lead_time_days=60, on_time_delivery_rate=0.82, quality_score=8.5,
        risk_score=45.0, geopolitical_risk=GeopoliticalRisk.MEDIUM,
        supply_concentration_risk=0.60,
        contract_value_usd=80_000_000, contract_expiry_year=2026,
        is_preferred=False, is_active=True,
    ),
    dict(
        supplier_code="SUP-GLEN-006",
        name="Glencore PLC",
        country="Switzerland", city="Baar",
        materials_supplied="Cobalt, Nickel, Copper",
        product_categories="raw_material",
        lead_time_days=75, on_time_delivery_rate=0.79, quality_score=7.8,
        risk_score=65.0, geopolitical_risk=GeopoliticalRisk.HIGH,
        supply_concentration_risk=0.70,
        contract_value_usd=95_000_000, contract_expiry_year=2025,
        is_preferred=False, is_active=True,
    ),
    dict(
        supplier_code="SUP-UMIC-007",
        name="Umicore N.V.",
        country="Belgium", city="Brussels",
        materials_supplied="NMC Cathode Active Material, Battery Recycling",
        product_categories="raw_material,battery_cell",
        lead_time_days=35, on_time_delivery_rate=0.96, quality_score=9.2,
        risk_score=22.0, geopolitical_risk=GeopoliticalRisk.LOW,
        supply_concentration_risk=0.28,
        contract_value_usd=60_000_000, contract_expiry_year=2028,
        is_preferred=True, is_active=True,
    ),
    dict(
        supplier_code="SUP-AMRJ-008",
        name="Amara Raja Energy & Mobility",
        country="India", city="Tirupati",
        materials_supplied="Li-Ion Packs, Lead-Acid, BMS",
        product_categories="battery_pack,battery_management_system",
        lead_time_days=12, on_time_delivery_rate=0.87, quality_score=7.9,
        risk_score=35.0, geopolitical_risk=GeopoliticalRisk.LOW,
        supply_concentration_risk=0.30,
        contract_value_usd=40_000_000, contract_expiry_year=2027,
        is_preferred=True, is_active=True,
    ),
    dict(
        supplier_code="SUP-EXID-009",
        name="Exide Industries Ltd.",
        country="India", city="Kolkata",
        materials_supplied="Li-Ion Battery Packs, 2W/3W Battery Packs",
        product_categories="battery_pack",
        lead_time_days=10, on_time_delivery_rate=0.85, quality_score=7.6,
        risk_score=30.0, geopolitical_risk=GeopoliticalRisk.LOW,
        supply_concentration_risk=0.25,
        contract_value_usd=25_000_000, contract_expiry_year=2026,
        is_preferred=False, is_active=True,
    ),
    dict(
        supplier_code="SUP-SIGL-010",
        name="Sigma Lithium Corporation",
        country="Brazil", city="Belo Horizonte",
        materials_supplied="PUREMASS Lithium Concentrate, Lithium Hydroxide",
        product_categories="raw_material",
        lead_time_days=90, on_time_delivery_rate=0.76, quality_score=8.0,
        risk_score=52.0, geopolitical_risk=GeopoliticalRisk.MEDIUM,
        supply_concentration_risk=0.55,
        contract_value_usd=35_000_000, contract_expiry_year=2028,
        is_preferred=False, is_active=True,
    ),
]


# ═══════════════════════════════════════════════════════════════
# 2. FACILITIES  (Indian EV Gigafactories & Distribution Hubs)
# ═══════════════════════════════════════════════════════════════
FACILITIES = [
    dict(
        facility_code="FAC-TML-001",
        name="Tata Motors Sanand EV Gigafactory",
        facility_type=FacilityType.GIGAFACTORY,
        city="Sanand", state="Gujarat", country="India",
        latitude=22.9922, longitude=72.3792,
        capacity_gwh=20.0, current_utilization_pct=71.5,
        is_operational=True,
    ),
    dict(
        facility_code="FAC-OLA-002",
        name="Ola Electric Futurefactory",
        facility_type=FacilityType.GIGAFACTORY,
        city="Krishnagiri", state="Tamil Nadu", country="India",
        latitude=12.5186, longitude=78.2137,
        capacity_gwh=100.0, current_utilization_pct=22.0,
        is_operational=True,
    ),
    dict(
        facility_code="FAC-ATH-003",
        name="Ather Energy Manufacturing Plant",
        facility_type=FacilityType.GIGAFACTORY,
        city="Hosur", state="Tamil Nadu", country="India",
        latitude=12.7409, longitude=77.8253,
        capacity_gwh=5.0, current_utilization_pct=60.0,
        is_operational=True,
    ),
    dict(
        facility_code="FAC-MHD-004",
        name="Mahindra Electric Chakan Plant",
        facility_type=FacilityType.GIGAFACTORY,
        city="Chakan", state="Maharashtra", country="India",
        latitude=18.7626, longitude=73.8688,
        capacity_gwh=8.0, current_utilization_pct=45.0,
        is_operational=True,
    ),
    dict(
        facility_code="FAC-MUM-005",
        name="Mumbai Port Logistics Hub",
        facility_type=FacilityType.PORT,
        city="Mumbai", state="Maharashtra", country="India",
        latitude=18.9220, longitude=72.8347,
        capacity_gwh=None, current_utilization_pct=82.0,
        is_operational=True,
    ),
    dict(
        facility_code="FAC-DLH-006",
        name="Delhi NCR Distribution Centre",
        facility_type=FacilityType.DISTRIBUTION_CENTER,
        city="Gurugram", state="Haryana", country="India",
        latitude=28.4595, longitude=77.0266,
        capacity_gwh=None, current_utilization_pct=55.0,
        is_operational=True,
    ),
    dict(
        facility_code="FAC-BLR-007",
        name="Bengaluru South Distribution Centre",
        facility_type=FacilityType.DISTRIBUTION_CENTER,
        city="Bengaluru", state="Karnataka", country="India",
        latitude=12.9716, longitude=77.5946,
        capacity_gwh=None, current_utilization_pct=68.0,
        is_operational=True,
    ),
]


# ═══════════════════════════════════════════════════════════════
# 3. PRODUCTS / SKUs  (EV Battery Cells & Critical Components)
# ═══════════════════════════════════════════════════════════════
def build_products(supplier_map: dict) -> list:
    return [
        dict(
            sku_code="SKU-NMC811-CYL-001",
            name="NMC-811 Cylindrical Cell (21700)",
            description="High energy density nickel-manganese-cobalt cell, 21700 format. "
                        "Used in premium EV battery packs. CATL equivalent.",
            category=ProductCategory.BATTERY_CELL,
            chemistry=BatteryChemistry.NMC_811,
            capacity_kwh=0.021, voltage_v=3.6, weight_kg=0.070,
            energy_density_wh_kg=300, cycle_life=1500, trl_score=9.0,
            supplier_id=supplier_map["SUP-CATL-001"],
            unit_cost_usd=8.50, is_ev_critical=True, is_active=True,
        ),
        dict(
            sku_code="SKU-LFP-PRS-002",
            name="LFP Prismatic Cell (280Ah Blade)",
            description="BYD Blade-style lithium iron phosphate cell. Long cycle life, "
                        "thermally stable. Preferred for Indian climate.",
            category=ProductCategory.BATTERY_CELL,
            chemistry=BatteryChemistry.LFP,
            capacity_kwh=0.896, voltage_v=3.2, weight_kg=5.5,
            energy_density_wh_kg=163, cycle_life=3000, trl_score=9.5,
            supplier_id=supplier_map["SUP-BYD-002"],
            unit_cost_usd=62.0, is_ev_critical=True, is_active=True,
        ),
        dict(
            sku_code="SKU-NAION-CYL-003",
            name="Sodium-Ion Cylindrical Cell (18650)",
            description="Emerging Na-Ion chemistry. No lithium/cobalt dependency. "
                        "STRATEGIC ALTERNATIVE for India's supply crunch. TRL 8-9.",
            category=ProductCategory.BATTERY_CELL,
            chemistry=BatteryChemistry.SODIUM_ION,
            capacity_kwh=0.014, voltage_v=3.1, weight_kg=0.045,
            energy_density_wh_kg=160, cycle_life=2000, trl_score=8.5,
            supplier_id=supplier_map["SUP-CATL-001"],
            unit_cost_usd=4.80, is_ev_critical=True, is_active=True,
        ),
        dict(
            sku_code="SKU-NCA-CYL-004",
            name="NCA Cylindrical Cell (21700 P5)",
            description="Panasonic NCA cell optimised for energy density. "
                        "Tesla-spec equivalent. Premium segment.",
            category=ProductCategory.BATTERY_CELL,
            chemistry=BatteryChemistry.NCA,
            capacity_kwh=0.021, voltage_v=3.6, weight_kg=0.068,
            energy_density_wh_kg=310, cycle_life=1200, trl_score=9.0,
            supplier_id=supplier_map["SUP-PANA-003"],
            unit_cost_usd=9.20, is_ev_critical=True, is_active=True,
        ),
        dict(
            sku_code="SKU-NMC622-PCH-005",
            name="NMC-622 Pouch Cell (60Ah)",
            description="Samsung SDI NMC-622 pouch cell for 4-wheeler EV packs.",
            category=ProductCategory.BATTERY_CELL,
            chemistry=BatteryChemistry.NMC_622,
            capacity_kwh=0.216, voltage_v=3.6, weight_kg=0.900,
            energy_density_wh_kg=240, cycle_life=1800, trl_score=9.0,
            supplier_id=supplier_map["SUP-SDIS-004"],
            unit_cost_usd=28.50, is_ev_critical=True, is_active=True,
        ),
        dict(
            sku_code="SKU-BMS-48V-006",
            name="BMS 48V Smart Module",
            description="Battery Management System for 48V EV pack architectures. "
                        "Cell balancing, thermal protection, SOC estimation.",
            category=ProductCategory.BMS,
            chemistry=None,
            capacity_kwh=None, voltage_v=48.0, weight_kg=0.85,
            energy_density_wh_kg=None, cycle_life=None, trl_score=9.5,
            supplier_id=supplier_map["SUP-AMRJ-008"],
            unit_cost_usd=45.0, is_ev_critical=True, is_active=True,
        ),
        dict(
            sku_code="SKU-THERM-LIQ-007",
            name="Liquid Cooling Thermal Module",
            description="Active liquid cooling system for EV battery packs. "
                        "Critical for India's high-temperature operating conditions.",
            category=ProductCategory.THERMAL,
            chemistry=None,
            capacity_kwh=None, voltage_v=None, weight_kg=3.2,
            energy_density_wh_kg=None, cycle_life=None, trl_score=9.0,
            supplier_id=None,
            unit_cost_usd=120.0, is_ev_critical=True, is_active=True,
        ),
        dict(
            sku_code="SKU-LITH-RAW-008",
            name="Battery-Grade Lithium Hydroxide (LiOH)",
            description="Refined lithium hydroxide monohydrate for NMC cathode production. "
                        "Primary bottleneck material in India's EV supply chain.",
            category=ProductCategory.RAW_MATERIAL,
            chemistry=None,
            capacity_kwh=None, voltage_v=None, weight_kg=1.0,
            energy_density_wh_kg=None, cycle_life=None, trl_score=10.0,
            supplier_id=supplier_map["SUP-ALBM-005"],
            unit_cost_usd=52.0, is_ev_critical=True, is_active=True,
        ),
    ]


# ═══════════════════════════════════════════════════════════════
# 4. INVENTORY  (Stock Levels — mix of healthy + stressed)
# ═══════════════════════════════════════════════════════════════
def build_inventory(product_map: dict, facility_map: dict) -> list:
    return [
        # Tata Motors — NMC Cells (healthy)
        dict(product_id=product_map["SKU-NMC811-CYL-001"],
             facility_id=facility_map["FAC-TML-001"],
             quantity_on_hand=85000, quantity_on_order=20000, quantity_reserved=10000,
             reorder_point=30000, economic_order_qty=50000, safety_stock=15000,
             last_counted_date=date.today()),
        # Tata Motors — LFP Cells (STRESSED — below reorder)
        dict(product_id=product_map["SKU-LFP-PRS-002"],
             facility_id=facility_map["FAC-TML-001"],
             quantity_on_hand=4200, quantity_on_order=15000, quantity_reserved=2000,
             reorder_point=8000, economic_order_qty=20000, safety_stock=3000,
             last_counted_date=date.today()),
        # Ola Electric — Na-Ion (very low — new tech, supply limited)
        dict(product_id=product_map["SKU-NAION-CYL-003"],
             facility_id=facility_map["FAC-OLA-002"],
             quantity_on_hand=1800, quantity_on_order=50000, quantity_reserved=500,
             reorder_point=5000, economic_order_qty=100000, safety_stock=2000,
             last_counted_date=date.today()),
        # Ola Electric — BMS (healthy)
        dict(product_id=product_map["SKU-BMS-48V-006"],
             facility_id=facility_map["FAC-OLA-002"],
             quantity_on_hand=22000, quantity_on_order=5000, quantity_reserved=3000,
             reorder_point=8000, economic_order_qty=15000, safety_stock=4000,
             last_counted_date=date.today()),
        # Ather — NMC622 Pouch (STRESSED)
        dict(product_id=product_map["SKU-NMC622-PCH-005"],
             facility_id=facility_map["FAC-ATH-003"],
             quantity_on_hand=3100, quantity_on_order=10000, quantity_reserved=1000,
             reorder_point=6000, economic_order_qty=12000, safety_stock=2500,
             last_counted_date=date.today()),
        # Mahindra — Thermal Modules (healthy)
        dict(product_id=product_map["SKU-THERM-LIQ-007"],
             facility_id=facility_map["FAC-MHD-004"],
             quantity_on_hand=9500, quantity_on_order=2000, quantity_reserved=1500,
             reorder_point=3000, economic_order_qty=8000, safety_stock=1500,
             last_counted_date=date.today()),
        # Mumbai Port — Lithium Hydroxide (CRITICAL — the key bottleneck)
        dict(product_id=product_map["SKU-LITH-RAW-008"],
             facility_id=facility_map["FAC-MUM-005"],
             quantity_on_hand=1200, quantity_on_order=8000, quantity_reserved=800,
             reorder_point=5000, economic_order_qty=15000, safety_stock=2000,
             last_counted_date=date.today()),
        # Delhi DC — NCA Cells
        dict(product_id=product_map["SKU-NCA-CYL-004"],
             facility_id=facility_map["FAC-DLH-006"],
             quantity_on_hand=45000, quantity_on_order=0, quantity_reserved=5000,
             reorder_point=15000, economic_order_qty=30000, safety_stock=8000,
             last_counted_date=date.today()),
    ]


# ═══════════════════════════════════════════════════════════════
# 5. SHIPMENTS  (Real-world mix of statuses)
# ═══════════════════════════════════════════════════════════════
def build_shipments(product_map: dict, supplier_map: dict, facility_map: dict) -> list:
    base = now
    return [
        dict(shipment_code="SHP-2025-001",
             origin_country="China", destination_country="India",
             product_id=product_map["SKU-LFP-PRS-002"],
             supplier_id=supplier_map["SUP-BYD-002"],
             destination_facility_id=facility_map["FAC-MUM-005"],
             quantity=15000, cargo_value_usd=930_000,
             transport_mode=TransportMode.SEA, carrier="Maersk Line",
             status=ShipmentStatus.IN_TRANSIT,
             departure_dt=base - timedelta(days=18),
             estimated_arrival_dt=base + timedelta(days=12),
             route_distance_km=7200, transport_cost_usd=48_000),

        dict(shipment_code="SHP-2025-002",
             origin_country="China", destination_country="India",
             product_id=product_map["SKU-NMC811-CYL-001"],
             supplier_id=supplier_map["SUP-CATL-001"],
             destination_facility_id=facility_map["FAC-MUM-005"],
             quantity=50000, cargo_value_usd=425_000,
             transport_mode=TransportMode.SEA, carrier="MSC Shipping",
             status=ShipmentStatus.DELAYED,
             departure_dt=base - timedelta(days=35),
             estimated_arrival_dt=base - timedelta(days=5),
             route_distance_km=7200, transport_cost_usd=55_000,
             delay_reason="Port congestion at Colombo transhipment hub. "
                          "Geopolitical route diversion adding 15 days."),

        dict(shipment_code="SHP-2025-003",
             origin_country="USA", destination_country="India",
             product_id=product_map["SKU-LITH-RAW-008"],
             supplier_id=supplier_map["SUP-ALBM-005"],
             destination_facility_id=facility_map["FAC-MUM-005"],
             quantity=8000, cargo_value_usd=416_000,
             transport_mode=TransportMode.SEA, carrier="CMA CGM",
             status=ShipmentStatus.CUSTOMS_HOLD,
             departure_dt=base - timedelta(days=28),
             estimated_arrival_dt=base + timedelta(days=3),
             route_distance_km=15200, transport_cost_usd=72_000,
             delay_reason="Customs documentation review at JNPT — hazmat classification."),

        dict(shipment_code="SHP-2025-004",
             origin_country="India", destination_country="India",
             product_id=product_map["SKU-LFP-PRS-002"],
             supplier_id=None,
             origin_facility_id=facility_map["FAC-MUM-005"],
             destination_facility_id=facility_map["FAC-TML-001"],
             quantity=12000, cargo_value_usd=744_000,
             transport_mode=TransportMode.ROAD, carrier="Blue Dart Logistics",
             status=ShipmentStatus.IN_TRANSIT,
             departure_dt=base - timedelta(days=1),
             estimated_arrival_dt=base + timedelta(days=1),
             route_distance_km=530, transport_cost_usd=8_500),

        dict(shipment_code="SHP-2025-005",
             origin_country="Japan", destination_country="India",
             product_id=product_map["SKU-NCA-CYL-004"],
             supplier_id=supplier_map["SUP-PANA-003"],
             destination_facility_id=facility_map["FAC-DLH-006"],
             quantity=30000, cargo_value_usd=276_000,
             transport_mode=TransportMode.SEA, carrier="K Line",
             status=ShipmentStatus.DELIVERED,
             departure_dt=base - timedelta(days=55),
             estimated_arrival_dt=base - timedelta(days=5),
             actual_arrival_dt=base - timedelta(days=4),
             route_distance_km=6800, transport_cost_usd=42_000),

        dict(shipment_code="SHP-2025-006",
             origin_country="India", destination_country="India",
             product_id=product_map["SKU-BMS-48V-006"],
             supplier_id=supplier_map["SUP-AMRJ-008"],
             origin_facility_id=None,
             destination_facility_id=facility_map["FAC-OLA-002"],
             quantity=5000, cargo_value_usd=225_000,
             transport_mode=TransportMode.ROAD, carrier="Delhivery",
             status=ShipmentStatus.DELIVERED,
             departure_dt=base - timedelta(days=8),
             estimated_arrival_dt=base - timedelta(days=6),
             actual_arrival_dt=base - timedelta(days=6),
             route_distance_km=340, transport_cost_usd=3_200),

        dict(shipment_code="SHP-2025-007",
             origin_country="Belgium", destination_country="India",
             product_id=product_map["SKU-LITH-RAW-008"],
             supplier_id=supplier_map["SUP-UMIC-007"],
             destination_facility_id=facility_map["FAC-MUM-005"],
             quantity=5000, cargo_value_usd=260_000,
             transport_mode=TransportMode.SEA, carrier="Hapag-Lloyd",
             status=ShipmentStatus.PENDING,
             departure_dt=base + timedelta(days=5),
             estimated_arrival_dt=base + timedelta(days=40),
             route_distance_km=10500, transport_cost_usd=38_000),
    ]


# ═══════════════════════════════════════════════════════════════
# 6. ALERTS  (Seeded system-generated alerts)
# ═══════════════════════════════════════════════════════════════
ALERTS = [
    dict(alert_type=AlertType.STOCK_BELOW_REORDER, severity=AlertSeverity.CRITICAL,
         title="CRITICAL: LFP Cell Stock at Tata Sanand Below Reorder Point",
         message="LFP Prismatic Cells at FAC-TML-001 are at 4,200 units (reorder point: 8,000). "
                 "Equivalent to only 3.5 days of production. Immediate PO required.",
         entity_type="inventory", entity_name="Tata Motors Sanand — LFP Blade",
         is_resolved=False,
         auto_action_taken="AI generated PO #PO-AUTO-2025-001 for 20,000 units from BYD."),

    dict(alert_type=AlertType.SHIPMENT_DELAYED, severity=AlertSeverity.CRITICAL,
         title="CRITICAL: SHP-2025-002 Delayed 10+ Days — NMC Cell Shortage Risk",
         message="50,000 NMC-811 cells from CATL are delayed due to Colombo port congestion. "
                 "Estimated new ETA: +15 days. Affects Tata Sanand production schedule.",
         entity_type="shipment", entity_name="SHP-2025-002",
         is_resolved=False,
         auto_action_taken="AI triggered rerouting via Mundra port. Alternative supplier Samsung SDI alerted."),

    dict(alert_type=AlertType.SUPPLY_RISK, severity=AlertSeverity.CRITICAL,
         title="CRITICAL: Lithium Hydroxide Buffer Below 30-Day Cover",
         message="Mumbai Port LiOH stock: 1,200 units (30-day requirement: 5,000 units). "
                 "Albemarle shipment SHP-2025-003 in customs hold. India production at risk.",
         entity_type="inventory", entity_name="LITH-RAW-008 at Mumbai Port",
         is_resolved=False,
         auto_action_taken="AI escalated to procurement team. Emergency RFQ sent to Sigma Lithium."),

    dict(alert_type=AlertType.SUPPLIER_RISK, severity=AlertSeverity.WARNING,
         title="WARNING: Glencore Contract Expiring — Cobalt Supply Gap",
         message="SUP-GLEN-006 contract expires Dec 2025. Cobalt supply for NMC cells at risk. "
                 "Risk Score: 65/100. Alternative supplier needed.",
         entity_type="supplier", entity_name="Glencore PLC",
         is_resolved=False,
         auto_action_taken="AI flagged for contract renewal. 2 alternative cobalt suppliers identified."),

    dict(alert_type=AlertType.STOCK_BELOW_REORDER, severity=AlertSeverity.WARNING,
         title="WARNING: Na-Ion Cell Stock Critically Low at Ola Futurefactory",
         message="Sodium-Ion cells at 1,800 units vs reorder point of 5,000. "
                 "New tech — limited supplier base. CATL fulfillment lead time: 60 days.",
         entity_type="inventory", entity_name="Ola Electric — Na-Ion Cells",
         is_resolved=False, auto_action_taken=None),

    dict(alert_type=AlertType.DEMAND_SPIKE, severity=AlertSeverity.INFO,
         title="INFO: India EV Sales Spike Detected — Q1 2025 +34% YoY",
         message="AI demand model detected significant positive demand signal from India. "
                 "EV sales February 2025: +34% vs same period 2024. Adjusting forecasts.",
         entity_type="demand_signal", entity_name="India EV Market",
         is_resolved=True,
         auto_action_taken="Forecast model retrained. Inventory reorder points adjusted +15%."),
]


# ═══════════════════════════════════════════════════════════════
# 7. AUTONOMOUS DECISIONS  (AI Audit Log)
# ═══════════════════════════════════════════════════════════════
DECISIONS = [
    dict(decision_type=DecisionType.GENERATE_PO,
         title="Auto-Generated PO: 20,000 LFP Cells from BYD",
         trigger_reason="Inventory for SKU-LFP-PRS-002 at FAC-TML-001 dropped to 4,200 units, "
                        "42% below the reorder point of 8,000. ML model predicted stockout in 3.5 days.",
         input_data_summary='{"sku":"SKU-LFP-PRS-002","current_stock":4200,"reorder_point":8000,'
                             '"daily_consumption":1200,"lead_time_days":40}',
         ai_confidence_score=0.97,
         action_taken="Generated Purchase Order #PO-AUTO-2025-001 for 20,000 LFP Prismatic Cells "
                      "from BYD Company (SUP-BYD-002). Order value: $1,240,000.",
         action_parameters='{"supplier_id":2,"quantity":20000,"unit_cost":62.0,'
                            '"total_value":1240000,"expected_delivery_days":40}',
         estimated_impact="Prevents production stoppage at Tata Sanand. "
                          "Saves ~₹8.5Cr in lost production revenue.",
         estimated_cost_saving_usd=1_020_000.0,
         status=DecisionStatus.EXECUTED,
         executed_at=now - timedelta(hours=2)),

    dict(decision_type=DecisionType.REROUTE_SHIPMENT,
         title="Rerouted SHP-2025-002: Colombo → Mundra Port",
         trigger_reason="Isolation Forest detected SHP-2025-002 delay anomaly. "
                        "Colombo port congestion risk score exceeded threshold (score: 87/100).",
         input_data_summary='{"shipment":"SHP-2025-002","original_port":"Colombo",'
                             '"delay_days":15,"congestion_score":87}',
         ai_confidence_score=0.89,
         action_taken="Rerouted shipment SHP-2025-002 via Mundra Port. New ETA: -8 days vs Colombo route. "
                      "Additional cost: $3,200 for rerouting fees.",
         estimated_impact="Recovers 8 days of delay. Prevents NMC cell stockout at Tata Sanand.",
         estimated_cost_saving_usd=450_000.0,
         status=DecisionStatus.EXECUTED,
         executed_at=now - timedelta(hours=6)),

    dict(decision_type=DecisionType.SWITCH_SUPPLIER,
         title="Emergency RFQ Triggered: Samsung SDI as Alt. Supplier for NMC Cells",
         trigger_reason="CATL shipment SHP-2025-002 delayed. CATL risk score elevated due to "
                        "China export restriction news. Demand forecast shows 22% supply gap.",
         input_data_summary='{"primary_supplier":"CATL","risk_score":72,"supply_gap_units":28000}',
         ai_confidence_score=0.84,
         action_taken="Sent emergency RFQ to Samsung SDI (SUP-SDIS-004) for 30,000 NMC-622 cells. "
                      "Estimated response time: 48 hours.",
         estimated_impact="Reduces dependency on single Chinese supplier. Diversifies supply risk.",
         estimated_cost_saving_usd=280_000.0,
         status=DecisionStatus.EXECUTED,
         executed_at=now - timedelta(hours=12)),

    dict(decision_type=DecisionType.ADJUST_REORDER,
         title="Reorder Points Adjusted +15% — India Q1 Demand Spike",
         trigger_reason="Demand signal: India EV sales +34% YoY in Feb 2025. "
                        "Prophet model predicts sustained growth through Q2 2025.",
         input_data_summary='{"demand_signal":"India EV sales","yoy_growth":0.34,'
                             '"prophet_confidence":0.94}',
         ai_confidence_score=0.94,
         action_taken="Adjusted reorder points for all India-deployed SKUs by +15%. "
                      "Safety stock for critical Li-Ion cells increased by 20%.",
         estimated_impact="Prevents future stockouts during demand surge. "
                          "Saves ~$850K in emergency procurement costs.",
         estimated_cost_saving_usd=850_000.0,
         status=DecisionStatus.EXECUTED,
         executed_at=now - timedelta(days=1)),
]


# ═══════════════════════════════════════════════════════════════
# MAIN SEED FUNCTION
# ═══════════════════════════════════════════════════════════════
def seed():
    if not check_connection():
        rprint("[X] Cannot connect to database. Check your .env DATABASE_URL.")
        rprint("Run: docker-compose up -d  (or check local PostgreSQL)")
        sys.exit(1)

    rprint("\n--- NEXUS-SCM Database Seeder Starting... ---\n")
    create_all_tables()

    db = SessionLocal()
    try:
        # ── Check if already seeded ──────────────────────────
        if db.query(Supplier).count() > 0:
            rprint("[!] Database already seeded. Skipping to avoid duplicates.")
            if db.query(BatteryTechProfile).count() == 0:
                 rprint("[+] Backfilling Battery Tech Profiles...")
                 tech_objs = [BatteryTechProfile(**t) for t in BATTERY_TECH_PROFILES]
                 db.add_all(tech_objs)
                 db.commit()
            return

        # ── Seed Tech Profiles ────────────────────────────────
        rprint("[+] Seeding Battery Tech Profiles...")
        tech_objs = [BatteryTechProfile(**t) for t in BATTERY_TECH_PROFILES]
        db.add_all(tech_objs)
        db.flush()
        rprint(f"    OK: {len(tech_objs)} tech profiles added")

        # ── Seed Suppliers ────────────────────────────────────
        rprint("[+] Seeding Suppliers...")
        supplier_objs = [Supplier(**s) for s in SUPPLIERS]
        db.add_all(supplier_objs)
        db.flush()
        supplier_map = {s.supplier_code: s.id for s in supplier_objs}
        rprint(f"    OK: {len(supplier_objs)} suppliers added")

        # ── Seed Facilities ───────────────────────────────────
        rprint("[+] Seeding Facilities...")
        facility_objs = [Facility(**f) for f in FACILITIES]
        db.add_all(facility_objs)
        db.flush()
        facility_map = {f.facility_code: f.id for f in facility_objs}
        rprint(f"    OK: {len(facility_objs)} facilities added")

        # ── Seed Products ─────────────────────────────────────
        rprint("[+] Seeding Products/SKUs...")
        product_data = build_products(supplier_map)
        product_objs = [ProductSKU(**p) for p in product_data]
        db.add_all(product_objs)
        db.flush()
        product_map = {p.sku_code: p.id for p in product_objs}
        rprint(f"    OK: {len(product_objs)} products added")

        # ── Seed Inventory ────────────────────────────────────
        rprint("[+] Seeding Inventory Levels...")
        inv_data = build_inventory(product_map, facility_map)
        inv_objs = [Inventory(**i) for i in inv_data]
        db.add_all(inv_objs)
        rprint(f"    OK: {len(inv_objs)} inventory records added")

        # ── Seed Shipments ────────────────────────────────────
        rprint("[+] Seeding Shipments...")
        ship_data = build_shipments(product_map, supplier_map, facility_map)
        # Add optional FK fields safely
        ship_objs = []
        for s in ship_data:
            obj = Shipment(
                shipment_code=s["shipment_code"],
                origin_country=s["origin_country"],
                destination_country=s["destination_country"],
                product_id=s.get("product_id"),
                supplier_id=s.get("supplier_id"),
                origin_facility_id=s.get("origin_facility_id"),
                destination_facility_id=s.get("destination_facility_id"),
                quantity=s["quantity"],
                cargo_value_usd=s.get("cargo_value_usd"),
                transport_mode=s["transport_mode"],
                carrier=s.get("carrier"),
                status=s["status"],
                departure_dt=s.get("departure_dt"),
                estimated_arrival_dt=s.get("estimated_arrival_dt"),
                actual_arrival_dt=s.get("actual_arrival_dt"),
                route_distance_km=s.get("route_distance_km"),
                transport_cost_usd=s.get("transport_cost_usd"),
                delay_reason=s.get("delay_reason"),
            )
            ship_objs.append(obj)
        db.add_all(ship_objs)
        db.flush()
        rprint(f"    OK: {len(ship_objs)} shipments added")

        # ── Seed Alerts ───────────────────────────────────────
        rprint("[+] Seeding Alerts...")
        alert_objs = [Alert(**a) for a in ALERTS]
        db.add_all(alert_objs)
        db.flush()
        rprint(f"    OK: {len(alert_objs)} alerts added")

        # ── Seed Autonomous Decisions ─────────────────────────
        rprint("[+] Seeding Autonomous Decision Log...")
        decision_objs = [AutonomousDecision(**d) for d in DECISIONS]
        db.add_all(decision_objs)

        db.commit()

        rprint("\n===========================================")
        rprint("  NEXUS-SCM Database Seeded Successfully!")
        rprint("===========================================")
        rprint(f"   Suppliers   : {len(supplier_objs)}")
        rprint(f"   Facilities  : {len(facility_objs)}")
        rprint(f"   Products    : {len(product_objs)}")
        rprint(f"   Inventory   : {len(inv_objs)}")
        rprint(f"   Shipments   : {len(ship_objs)}")
        rprint(f"   Alerts      : {len(alert_objs)}")
        rprint(f"   AI Decisions: {len(decision_objs)}")
        rprint(f"   Tech Profiles: {len(tech_objs)}")
        rprint("===========================================")
        rprint("Next: uvicorn main:app --reload")

    except Exception as e:
        db.rollback()
        rprint(f"[X] Seeding failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
