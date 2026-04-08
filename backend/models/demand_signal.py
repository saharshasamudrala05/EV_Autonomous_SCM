"""NEXUS-SCM | Demand Signal — Kafka-ingested demand events"""
import enum
from datetime import datetime
from sqlalchemy import String, Float, Integer, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from backend.models.base import Base, TimestampMixin


class SignalSource(str, enum.Enum):
    KAFKA_STREAM = "kafka_stream"
    IEA_DATA = "iea_data"
    MANUAL = "manual"
    SIMULATION = "simulation"


class DemandSignal(Base, TimestampMixin):
    __tablename__ = "demand_signals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Dimensions
    country: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    region: Mapped[str] = mapped_column(String(100), nullable=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    month: Mapped[int] = mapped_column(Integer, nullable=True)

    # Metric
    parameter: Mapped[str] = mapped_column(String(100), nullable=False)   # e.g. 'EV sales'
    mode: Mapped[str] = mapped_column(String(100), nullable=True)          # e.g. 'Cars'
    powertrain: Mapped[str] = mapped_column(String(50), nullable=True)     # e.g. 'BEV'
    value: Mapped[float] = mapped_column(Float, nullable=False)
    cumulative_policy_score: Mapped[float] = mapped_column(Float, default=0.0)

    # Metadata
    category: Mapped[str] = mapped_column(String(50), default="Historical")
    source: Mapped[SignalSource] = mapped_column(
        SAEnum(SignalSource), default=SignalSource.SIMULATION
    )
    kafka_offset: Mapped[int] = mapped_column(Integer, nullable=True)
    event_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<DemandSignal {self.country} {self.year}: {self.parameter}={self.value}>"
