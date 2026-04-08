"""
NEXUS-SCM | Digital Twin: Product / SKU Object
Represents a battery cell, EV component, or critical raw material.
"""
import enum
from sqlalchemy import String, Float, Integer, Boolean, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.models.base import Base, TimestampMixin


class BatteryChemistry(str, enum.Enum):
    NMC_811 = "NMC-811"
    NMC_622 = "NMC-622"
    LFP = "LFP"
    SODIUM_ION = "Na-Ion"
    SOLID_STATE = "Solid-State"
    NCA = "NCA"
    OTHER = "Other"


class ProductCategory(str, enum.Enum):
    BATTERY_CELL = "battery_cell"
    BATTERY_PACK = "battery_pack"
    BMS = "battery_management_system"
    MOTOR = "electric_motor"
    THERMAL = "thermal_management"
    CHARGING = "charging_interface"
    RAW_MATERIAL = "raw_material"
    OTHER = "other_component"


class ProductSKU(Base, TimestampMixin):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sku_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)

    # Classification
    category: Mapped[ProductCategory] = mapped_column(
        SAEnum(ProductCategory), nullable=False, default=ProductCategory.BATTERY_CELL
    )
    chemistry: Mapped[BatteryChemistry] = mapped_column(
        SAEnum(BatteryChemistry), nullable=True
    )

    # Technical Specifications
    capacity_kwh: Mapped[float] = mapped_column(Float, nullable=True)
    voltage_v: Mapped[float] = mapped_column(Float, nullable=True)
    weight_kg: Mapped[float] = mapped_column(Float, nullable=True)
    energy_density_wh_kg: Mapped[float] = mapped_column(Float, nullable=True)
    cycle_life: Mapped[int] = mapped_column(Integer, nullable=True)
    trl_score: Mapped[float] = mapped_column(Float, default=9.0)  # IEA Tech Readiness Level

    # Supply Chain Attributes
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"), nullable=True)
    unit_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    is_ev_critical: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    supplier: Mapped["Supplier"] = relationship("Supplier", back_populates="products")
    inventory_records: Mapped[list["Inventory"]] = relationship(
        "Inventory", back_populates="product"
    )

    def __repr__(self) -> str:
        return f"<Product {self.sku_code}: {self.name}>"
