"""
NEXUS-SCM | Digital Twin: Warehouse / Facility + Inventory
Facility = physical plant/warehouse. Inventory = stock per SKU per facility.
"""
import enum
from datetime import date
from sqlalchemy import String, Float, Integer, Boolean, ForeignKey, Date, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.models.base import Base, TimestampMixin


class FacilityType(str, enum.Enum):
    GIGAFACTORY = "gigafactory"
    WAREHOUSE = "warehouse"
    DISTRIBUTION_CENTER = "distribution_center"
    PORT = "port"
    DEALER = "dealer"


class Facility(Base, TimestampMixin):
    __tablename__ = "facilities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    facility_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    facility_type: Mapped[FacilityType] = mapped_column(
        SAEnum(FacilityType), nullable=False, default=FacilityType.WAREHOUSE
    )

    # Location (lat/lng for map visualization)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[str] = mapped_column(String(100), nullable=False)
    country: Mapped[str] = mapped_column(String(100), nullable=False, default="India")
    latitude: Mapped[float] = mapped_column(Float, nullable=True)
    longitude: Mapped[float] = mapped_column(Float, nullable=True)

    # Capacity
    capacity_gwh: Mapped[float] = mapped_column(Float, nullable=True)
    current_utilization_pct: Mapped[float] = mapped_column(Float, default=0.0)
    is_operational: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    inventory: Mapped[list["Inventory"]] = relationship("Inventory", back_populates="facility")
    outbound_shipments: Mapped[list["Shipment"]] = relationship(
        "Shipment", back_populates="origin_facility",
        foreign_keys="[Shipment.origin_facility_id]"
    )
    inbound_shipments: Mapped[list["Shipment"]] = relationship(
        "Shipment", back_populates="destination_facility",
        foreign_keys="[Shipment.destination_facility_id]"
    )

    def __repr__(self) -> str:
        return f"<Facility {self.facility_code}: {self.name} ({self.city})>"


class Inventory(Base, TimestampMixin):
    """
    Junction table: stock level of a specific Product at a specific Facility.
    This IS the core Digital Twin of physical world inventory.
    """
    __tablename__ = "inventory"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False, index=True)
    facility_id: Mapped[int] = mapped_column(ForeignKey("facilities.id"), nullable=False, index=True)

    # Stock Levels
    quantity_on_hand: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    quantity_on_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    quantity_reserved: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # AI-managed Reorder Parameters (AI will update these in Phase 2)
    reorder_point: Mapped[int] = mapped_column(Integer, default=1000)
    economic_order_qty: Mapped[int] = mapped_column(Integer, default=5000)
    safety_stock: Mapped[int] = mapped_column(Integer, default=500)

    last_counted_date: Mapped[date] = mapped_column(Date, nullable=True)

    # Relationships
    product: Mapped["ProductSKU"] = relationship("ProductSKU", back_populates="inventory_records")
    facility: Mapped["Facility"] = relationship("Facility", back_populates="inventory")

    @property
    def available_qty(self) -> int:
        return self.quantity_on_hand - self.quantity_reserved

    @property
    def is_below_reorder_point(self) -> bool:
        return self.quantity_on_hand <= self.reorder_point

    @property
    def stock_health_pct(self) -> float:
        """0–100%. Below 20% = danger zone."""
        if self.reorder_point == 0:
            return 100.0
        return min(100.0, (self.quantity_on_hand / (self.reorder_point * 2)) * 100)

    def __repr__(self) -> str:
        return (
            f"<Inventory product={self.product_id} "
            f"facility={self.facility_id} qty={self.quantity_on_hand}>"
        )
