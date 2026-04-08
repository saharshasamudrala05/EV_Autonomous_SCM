"""
NEXUS-SCM | Autonomous Decision Audit Log
Every AI action is recorded here with full explainability context.
This is a KEY differentiator — shows interviewers the system is truly autonomous and transparent.
"""
import enum
from datetime import datetime
from sqlalchemy import String, Text, Float, Integer, Boolean, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from backend.models.base import Base, TimestampMixin


class DecisionType(str, enum.Enum):
    GENERATE_PO = "generate_purchase_order"
    REROUTE_SHIPMENT = "reroute_shipment"
    ADJUST_REORDER = "adjust_reorder_point"
    TRIGGER_ALERT = "trigger_alert"
    SWITCH_SUPPLIER = "switch_supplier"
    REPLAN_INVENTORY = "replan_inventory"
    SCENARIO_TRIGGER = "scenario_trigger"


class DecisionStatus(str, enum.Enum):
    PENDING = "pending"
    EXECUTED = "executed"
    FAILED = "failed"
    OVERRIDDEN = "overridden"   # human overrode the AI decision


class AutonomousDecision(Base, TimestampMixin):
    __tablename__ = "autonomous_decisions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    decision_type: Mapped[DecisionType] = mapped_column(
        SAEnum(DecisionType), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)

    # ── Explainability (WHY?) ──────────────────────
    trigger_reason: Mapped[str] = mapped_column(Text, nullable=False)
    input_data_summary: Mapped[str] = mapped_column(Text, nullable=True)  # JSON string
    ai_confidence_score: Mapped[float] = mapped_column(Float, nullable=True)  # 0.0–1.0

    # ── Action (WHAT?) ────────────────────────────
    action_taken: Mapped[str] = mapped_column(Text, nullable=False)
    action_parameters: Mapped[str] = mapped_column(Text, nullable=True)   # JSON string

    # ── Impact (RESULT?) ──────────────────────────
    estimated_impact: Mapped[str] = mapped_column(Text, nullable=True)
    estimated_cost_saving_usd: Mapped[float] = mapped_column(Float, nullable=True)

    # ── Related Entities ──────────────────────────
    related_supplier_id: Mapped[int] = mapped_column(Integer, nullable=True)
    related_product_id: Mapped[int] = mapped_column(Integer, nullable=True)
    related_facility_id: Mapped[int] = mapped_column(Integer, nullable=True)
    related_alert_id: Mapped[int] = mapped_column(Integer, nullable=True)

    # ── Status ────────────────────────────────────
    status: Mapped[DecisionStatus] = mapped_column(
        SAEnum(DecisionStatus), default=DecisionStatus.EXECUTED
    )
    executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    was_overridden_by_human: Mapped[bool] = mapped_column(Boolean, default=False)
    override_reason: Mapped[str] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<Decision [{self.decision_type.value}]: {self.title}>"
