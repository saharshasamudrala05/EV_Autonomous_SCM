"""
NEXUS-SCM | Digital Twin: Supplier / Market Object
Represents a battery material or component supplier in the EV supply chain.
"""
import enum
from sqlalchemy import String, Float, Integer, Boolean, Text, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.models.base import Base, TimestampMixin


class GeopoliticalRisk(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Supplier(Base, TimestampMixin):
    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    supplier_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    country: Mapped[str] = mapped_column(String(100), nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=True)

    # What they supply
    materials_supplied: Mapped[str] = mapped_column(Text, nullable=True)   # comma-separated
    product_categories: Mapped[str] = mapped_column(Text, nullable=True)   # comma-separated

    # Performance KPIs
    lead_time_days: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    on_time_delivery_rate: Mapped[float] = mapped_column(Float, default=0.85)
    quality_score: Mapped[float] = mapped_column(Float, default=8.0)       # 0–10

    # Risk Intelligence
    risk_score: Mapped[float] = mapped_column(Float, default=50.0)         # 0–100 (100=highest)
    geopolitical_risk: Mapped[GeopoliticalRisk] = mapped_column(
        SAEnum(GeopoliticalRisk), default=GeopoliticalRisk.MEDIUM
    )
    supply_concentration_risk: Mapped[float] = mapped_column(Float, default=0.5)  # 0–1

    # Contract
    contract_value_usd: Mapped[float] = mapped_column(Float, default=0.0)
    contract_expiry_year: Mapped[int] = mapped_column(Integer, nullable=True)
    is_preferred: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    products: Mapped[list["ProductSKU"]] = relationship("ProductSKU", back_populates="supplier")
    shipments: Mapped[list["Shipment"]] = relationship("Shipment", back_populates="supplier")

    def __repr__(self) -> str:
        return f"<Supplier {self.supplier_code}: {self.name} ({self.country})>"
