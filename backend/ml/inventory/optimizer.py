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
        forecast_signals: Optional[Dict[str, Any]] = None,
        facility_count: int = 14
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
            avg_demand = (next_forecast.get("ensemble", default_avg_demand) / facility_count) / 30 # Daily per facility
            # Probabilistic volatility: distance between P90 and Expected
            std_dev_demand = ((next_forecast.get("upper95", next_forecast.get("ensemble", default_avg_demand) * 1.5) - next_forecast.get("ensemble", default_avg_demand)) / 2) / facility_count
        else:
            avg_demand = (default_avg_demand / facility_count) / 30
            std_dev_demand = (default_std_dev / facility_count) / 30

        for item in inventory_data:
            on_hand = item['quantity_on_hand']
            reorder_point = item['reorder_point']
            
            # --- TASK 3: DYNAMIC LEAD-TIME INTELLIGENCE ---
            supplier_lt = item.get('supplier_lead_time', 14)
            battery_signal = item.get('battery_lead_signal', 100) or 100
            
            # Formula: Effective_LT = Supplier_LT * (100 / AVG(battery_lead_signal))
            effective_lt = supplier_lt * (100 / battery_signal)
            std_lt = effective_lt * 0.2
            
            optimal_ss = self.calculate_safety_stock(avg_demand, std_dev_demand, int(effective_lt), std_lt)
            
            # Trigger: Supply Delay Alert
            status_override = None
            if battery_signal < 70:
                status_override = "CRITICAL_SUPPLY_DELAY"
                optimal_ss *= 3 # Triple safety stock per Task 3
            
            target_stock = reorder_point + optimal_ss
            
            # Logic for Recommendation Type
            if on_hand < reorder_point:
                status = status_override or "Critical Deficit"
                action = "Trigger Strategic Order"
                severity = "Critical"
                protocol = f"Immediate acquisition of {int(target_stock - on_hand)} units required."
            elif on_hand < target_stock:
                status = status_override or "Below Optimal"
                action = "Buffer Reinforcement"
                severity = "Warning"
                protocol = "Slow-burn replenishment via local network."
            else:
                status = status_override or "Stable"
                action = "Hold"
                severity = "Info"
                protocol = "Monitoring demand pulse (T-Now window)."

            recommendations.append({
                "sku_id": item['product_id'],
                "facility": item.get('facility_name', f"FAC-{item['facility_id']}"),
                "status": status,
                "action": action,
                "severity": severity,
                "protocol": protocol,
                "metrics": {
                    "health_idx": round((on_hand / target_stock) * 100, 1) if target_stock > 0 else 100,
                    "safety_buffer": int(optimal_ss),
                    "effective_lead_time": f"{effective_lt:.1f} days",
                    "capital_lock_risk": "High" if on_hand > target_stock * 2 else "Optimal"
                }
            })
        
        return recommendations

    def simulate_echelon_flow(self, gateway_nodes: List[Dict[str, Any]], hub_nodes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Simulates the movement of stock throughout the Indian corridor network.
        Moves goods from SUPPLY_GATEWAYs to DEMAND_HUBs in the same/neighboring states.
        """
        flows = []
        if not gateway_nodes or not hub_nodes: return []
        
        # We select 12 flows per Task 4
        for i in range(12):
            origin = np.random.choice(gateway_nodes)
            
            # Try to find a destination in the same state (heuristic parsing if state in name)
            o_state = origin['name'].split(' - ')[-1] if ' - ' in origin['name'] else "India"
            match_hubs = [h for h in hub_nodes if (h['name'].split(' - ')[-1] if ' - ' in h['name'] else "") == o_state]
            
            if not match_hubs: 
                dest = np.random.choice(hub_nodes)
            else:
                dest = np.random.choice(match_hubs)
            
            volume = dest.get('total_stock', np.random.randint(100, 1000))
            
            flows.append({
                "id": f"FLW-{1000 + i}",
                "origin": origin['name'],
                "destination": dest['name'],
                "volume": f"{volume} units",
                "latency": f"{np.random.randint(12, 72)}h",
                "status": "In-Transit" if np.random.random() > 0.2 else "Customs_Hold"
            })
        return flows
