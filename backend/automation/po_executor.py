import json
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from backend.models.warehouse import Inventory
from backend.models.autonomous_decision import AutonomousDecision, DecisionType, DecisionStatus
from backend.ml.optimization.inventory_optimizer import InventoryOptimizer

logger = logging.getLogger("nexus-scm.automation")

class PurchaseOrderExecutor:
    """
    NEXUS-SCM Autonomous Purchase Order Executor.
    Scan inventory -> Apply ML Optimization -> Execute replenishment action.
    """

    def __init__(self, db: Session):
        self.db = db
        self.optimizer = InventoryOptimizer(service_level=0.95)

    def scan_and_replenish(self) -> int:
        """
        Main autonomous loop. Scans only for items needing replenishment.
        Returns the number of autonomous decisions taken.
        """
        # 1. Find all items below reorder point that haven't had a recent decision
        low_stock_items = self.db.query(Inventory).filter(
            Inventory.quantity_on_hand <= Inventory.reorder_point
        ).all()
        
        decisions_taken = 0
        
        for item in low_stock_items:
            # Check if we already have a pending/recent PO decision for this (to avoid duplication)
            existing = self.db.query(AutonomousDecision).filter(
                AutonomousDecision.related_product_id == item.product_id,
                AutonomousDecision.related_facility_id == item.facility_id,
                AutonomousDecision.decision_type == DecisionType.GENERATE_PO,
                AutonomousDecision.status == DecisionStatus.EXECUTED
            ).order_by(AutonomousDecision.created_at.desc()).first()
            
            # If we recently (last 24h) ordered this, skip
            if existing and (datetime.utcnow() - existing.created_at.replace(tzinfo=None)).total_seconds() < 86400:
                continue

            # 2. Run Optimizer for the specific SKU context
            # Simulating some parameters that might be in a Product table in production
            sku_context = {
                "product_id": item.product_id,
                "facility_id": item.facility_id,
                "annual_demand": 120000, # Example: 10k cells/month
                "order_cost": 250,
                "holding_cost": 12,
                "lead_time_days": 10
            }
            
            optimization = self.optimizer.optimize_sku_inventory(sku_context)
            order_qty = optimization["optimal_order_quantity (EOQ)"]
            
            # 3. Formulate the Autonomous Decision
            decision = AutonomousDecision(
                decision_type=DecisionType.GENERATE_PO,
                title=f"Autonomously Generated PO for Product #{item.product_id}",
                trigger_reason=f"Stock level ({item.quantity_on_hand}) dropped below ROP ({item.reorder_point})",
                input_data_summary=json.dumps(sku_context),
                ai_confidence_score=0.98,
                action_taken=f"Generated Purchase Order for {order_qty} units",
                action_parameters=json.dumps({"order_quantity": order_qty, "supplier_lead_time": 10}),
                estimated_impact=f"Prevents stockout at Facility #{item.facility_id}. Maintains 95% service level.",
                estimated_cost_saving_usd=450.0, # Example cost of stockout prevention
                related_product_id=item.product_id,
                related_facility_id=item.facility_id,
                status=DecisionStatus.EXECUTED,
                executed_at=datetime.utcnow()
            )
            
            self.db.add(decision)
            decisions_taken += 1
            
            logger.info(f"Autonomous Decision: Placed PO for {order_qty} units of Prod {item.product_id}")

        if decisions_taken > 0:
            self.db.commit()
            
        return decisions_taken
