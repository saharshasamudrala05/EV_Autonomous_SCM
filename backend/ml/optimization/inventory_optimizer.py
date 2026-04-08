import math
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger("nexus-scm.ml")

class InventoryOptimizer:
    """
    NEXUS-SCM Inventory Optimizer.
    Calculates EOQ (Economic Order Quantity) and dynamic Reorder Points.
    """

    def __init__(self, service_level: float = 0.95):
        """
        service_level: The probability of not having a stockout (e.g., 95%)
        """
        # Z-score for service level (Standard Normal Distribution)
        # 0.90 -> 1.28
        # 0.95 -> 1.65
        # 0.99 -> 2.33
        self.z_score = 1.65 if service_level == 0.95 else 1.28

    def calculate_eoq(self, annual_demand_units: float, order_cost_usd: float, holding_cost_per_unit_usd: float) -> int:
        """
        Wilson's EOQ Formula: sqrt(2DS / H)
        D: Annual Demand
        S: Ordering Cost (Setup)
        H: Holding Cost (Carrying)
        """
        if holding_cost_per_unit_usd <= 0:
            return 0
            
        eoq = math.sqrt((2 * annual_demand_units * order_cost_usd) / holding_cost_per_unit_usd)
        return int(eoq)

    def calculate_reorder_point(self, avg_daily_demand: float, avg_lead_time_days: int, demand_std_dev: float = 0.0) -> int:
        """
        ROP = (Lead Time Demand) + (Safety Stock)
        ROP = (d * L) + (Z * sqrt(L * sigma_d^2))
        """
        lead_time_demand = avg_daily_demand * avg_lead_time_days
        
        # Safety Stock calculation (Statistical)
        # Assuming demand variation is the primary driver
        safety_stock = self.z_score * math.sqrt(avg_lead_time_days) * demand_std_dev
        
        return int(lead_time_demand + safety_stock)

    def optimize_sku_inventory(self, sku_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Take SKU data and return optimized replenishment parameters.
        """
        # 1. Fetch parameters
        # Example for a Battery Cell (NMC 811)
        # Annual Demand might come from our Forecast Engine
        annual_demand = sku_data.get('annual_demand', 50000)
        order_cost = sku_data.get('order_cost', 500) # $500 per order setup
        holding_cost = sku_data.get('holding_cost', 15) # $15 per unit per year
        
        # 2. Daily metrics
        daily_demand = annual_demand / 365
        lead_time = sku_data.get('lead_time_days', 14)
        
        # 3. Calculate optimized values
        optimal_order_qty = self.calculate_eoq(annual_demand, order_cost, holding_cost)
        
        # Safe reorder point (adding 10% buffer if no std_dev provided)
        std_dev = sku_data.get('demand_std_dev', daily_demand * 0.2)
        reorder_point = self.calculate_reorder_point(daily_demand, lead_time, std_dev)
        
        return {
            "product_id": sku_data.get('product_id'),
            "facility_id": sku_data.get('facility_id'),
            "optimal_order_quantity (EOQ)": optimal_order_qty,
            "optimized_reorder_point (ROP)": reorder_point,
            "suggested_safety_stock": int(reorder_point - (daily_demand * lead_time))
        }
