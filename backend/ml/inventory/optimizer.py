import numpy as np
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

class InventoryOptimizer:
    """
    NEXUS-SCM | Inventory Intelligence Engine v6.2
    Multi-Echelon Stochastic Optimization for EV Components.
    Specializes in high-variance lead times and capital-heavy battery minerals.
    """

    def __init__(self):
        self.service_level_factors = {
            "99.9%": 3.09,
            "99%": 2.33,
            "95%": 1.65,
            "90%": 1.28
        }

    def calculate_safety_stock(
        self, 
        avg_daily_demand: float, 
        std_dev_demand: float, 
        avg_lead_time_days: int, 
        std_dev_lead_time: float,
        service_level: str = "95%"
    ) -> float:
        """
        Stochastic Safety Stock Formula:
        SS = Z * sqrt( (Avg LT * sigma_demand^2) + (Avg Demand^2 * sigma_LT^2) )
        """
        Z = self.service_level_factors.get(service_level, 1.65)
        
        term1 = avg_lead_time_days * (std_dev_demand ** 2)
        term2 = (avg_daily_demand ** 2) * (std_dev_lead_time ** 2)
        
        safety_stock = Z * np.sqrt(term1 + term2)
        return round(safety_stock, 2)

    def generate_stock_recommendations(
        self, 
        inventory_data: List[Dict[str, Any]], 
        forecast_signals: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Analyzes raw stock and demand signals to generate tactical action protocols.
        Integrates with the Titan v7 Forecast Engine for dynamic safety stock.
        """
        recommendations = []
        
        # Determine average demand from forecast if available
        # Default fallback if no forecast is provided
        default_avg_demand = 500 
        default_std_dev = 100
        
        # Extract forecast data if available (we assume the forecast is for the current country/market)
        if forecast_signals and "forecast" in forecast_signals:
            # We take the expected (ensemble) and the variance (P90) from the next prediction month
            # to calculate a forward-looking safety stock.
            next_forecast = forecast_signals["forecast"][-1] # Usually the furthest forecast point
            avg_demand = next_forecast.get("ensemble", default_avg_demand) / 30 # Daily
            # Probabilistic volatility: distance between P90 and Expected
            std_dev_demand = (next_forecast.get("upper95", avg_demand * 1.5) - avg_demand) / 2
        else:
            avg_demand = default_avg_demand / 30
            std_dev_demand = default_std_dev / 30

        for item in inventory_data:
            on_hand = item['quantity_on_hand']
            reorder_point = item['reorder_point']
            
            # Global Lead Time Constants (In production, these would be facility-specific)
            avg_lt = 14 # Typical sea-freight leg
            std_lt = 3  # Congestion variance
            
            optimal_ss = self.calculate_safety_stock(avg_demand, std_dev_demand, avg_lt, std_lt)
            target_stock = reorder_point + optimal_ss
            
            # Logic for Recommendation Type
            if on_hand < reorder_point:
                status = "Critical Deficit"
                action = "Trigger Strategic Order"
                severity = "Critical"
                protocol = f"Immediate acquisition of {int(target_stock - on_hand)} units required."
            elif on_hand < target_stock:
                status = "Below Optimal"
                action = "Buffer Reinforcement"
                severity = "Warning"
                protocol = "Slow-burn replenishment via local network."
            else:
                status = "Stable"
                action = "Hold"
                severity = "Info"
                protocol = "Monitoring demand pulse (T-Now window)."

            recommendations.append({
                "sku_id": item['product_id'],
                "facility": f"FAC-{item['facility_id']}",
                "status": status,
                "action": action,
                "severity": severity,
                "protocol": protocol,
                "metrics": {
                    "health_idx": round((on_hand / target_stock) * 100, 1) if target_stock > 0 else 100,
                    "safety_buffer": optimal_ss,
                    "capital_lock_risk": "High" if on_hand > target_stock * 2 else "Optimal"
                }
            })
        
        return recommendations

    def simulate_echelon_flow(self) -> List[Dict[str, Any]]:
        """
        Simulates the movement of stock throughout the global network.
        For the 'Neural Pulse' visualization.
        """
        nodes = ["Shanghai Hub", "Bangalore Factory", "Hamburg Terminal", "Detroit Hub"]
        flows = []
        for i in range(12):
            origin = np.random.choice(nodes)
            dest = np.random.choice([n for n in nodes if n != origin])
            flows.append({
                "id": f"FLW-{1000 + i}",
                "origin": origin,
                "destination": dest,
                "volume": f"{np.random.randint(50, 500)} GWh",
                "latency": f"{np.random.randint(2, 45)}ms",
                "status": "In-Transit" if np.random.random() > 0.2 else "Held"
            })
        return flows
