"""
NEXUS-SCM | Digital Twin: Shipment / Logistics Object
Tracks every physical movement of goods across the EV supply chain.
"""
import enum
from datetime import datetime
from sqlalchemy import String, Float, Integer, ForeignKey, DateTime, Text, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.models.base import Base, TimestampMixin


class ShipmentStatus(str, enum.Enum):
    PENDING = "pending"
    IN_TRANSIT = "in_transit"
    CUSTOMS_HOLD = "customs_hold"
    DELAYED = "delayed"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class TransportMode(str, enum.Enum):
    ROAD = "road"
    RAIL = "rail"
    SEA = "sea"
    AIR = "air"
    MULTIMODAL = "multimodal"


class Shipment(Base, TimestampMixin):
    __tablename__ = "shipments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    shipment_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)

    # Origin / Destination
    origin_facility_id: Mapped[int] = mapped_column(ForeignKey("facilities.id"), nullable=True)
    destination_facility_id: Mapped[int] = mapped_column(ForeignKey("facilities.id"), nullable=True)
    origin_country: Mapped[str] = mapped_column(String(100), nullable=False, default="China")
    destination_country: Mapped[str] = mapped_column(String(100), nullable=False, default="India")

    # Cargo
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cargo_value_usd: Mapped[float] = mapped_column(Float, nullable=True)

    # Logistics
    transport_mode: Mapped[TransportMode] = mapped_column(
        SAEnum(TransportMode), default=TransportMode.SEA
    )
    carrier: Mapped[str] = mapped_column(String(100), nullable=True)
    status: Mapped[ShipmentStatus] = mapped_column(
        SAEnum(ShipmentStatus), default=ShipmentStatus.PENDING, index=True
    )

    # Timing
    departure_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    estimated_arrival_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_arrival_dt: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    # Cost & Route
    route_distance_km: Mapped[float] = mapped_column(Float, nullable=True)
    transport_cost_usd: Mapped[float] = mapped_column(Float, nullable=True)
    delay_reason: Mapped[str] = mapped_column(Text, nullable=True)

    # Relationships
    origin_facility: Mapped["Facility"] = relationship(
        "Facility", back_populates="outbound_shipments", foreign_keys=[origin_facility_id]
    )
    destination_facility: Mapped["Facility"] = relationship(
        "Facility", back_populates="inbound_shipments", foreign_keys=[destination_facility_id]
    )
    product: Mapped["ProductSKU"] = relationship("ProductSKU")
    supplier: Mapped["Supplier"] = relationship("Supplier", back_populates="shipments")

    @property
    def is_delayed(self) -> bool:
        return self.status == ShipmentStatus.DELAYED

    @property
    def delay_days(self) -> int | None:
        if self.actual_arrival_dt and self.estimated_arrival_dt:
            delta = self.actual_arrival_dt - self.estimated_arrival_dt
            return max(0, delta.days)
        return None

    def __repr__(self) -> str:
        return f"<Shipment {self.shipment_code}: {self.status.value}>"
