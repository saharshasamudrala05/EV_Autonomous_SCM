"""NEXUS-SCM | Alert Model — AI-generated system alerts"""
import enum
from datetime import datetime
from sqlalchemy import String, Text, Boolean, Integer, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from backend.models.base import Base, TimestampMixin


class AlertSeverity(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class AlertType(str, enum.Enum):
    SUPPLY_RISK = "supply_risk"
    STOCK_BELOW_REORDER = "stock_below_reorder"
    SHIPMENT_DELAYED = "shipment_delayed"
    DEMAND_SPIKE = "demand_spike"
    SUPPLIER_RISK = "supplier_risk"
    PRICE_ANOMALY = "price_anomaly"
    FORECAST_ALERT = "forecast_alert"
    SYSTEM = "system"


class Alert(Base, TimestampMixin):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    alert_type: Mapped[AlertType] = mapped_column(SAEnum(AlertType), nullable=False, index=True)
    severity: Mapped[AlertSeverity] = mapped_column(
        SAEnum(AlertSeverity), nullable=False, default=AlertSeverity.INFO, index=True
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)

    # Related entity (what triggered the alert)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=True)
    entity_id: Mapped[int] = mapped_column(Integer, nullable=True)
    entity_name: Mapped[str] = mapped_column(String(200), nullable=True)

    # Resolution
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    resolved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_by: Mapped[str] = mapped_column(String(100), nullable=True)
    auto_action_taken: Mapped[str] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<Alert [{self.severity.value.upper()}] {self.title}>"
