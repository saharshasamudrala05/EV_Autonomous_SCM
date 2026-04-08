import heapq
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime, timedelta

class LogisticsOptimizer:
    """
    NEXUS-SCM | Logistics Logic Engine v6.1
    Implements Multi-Objective Optimization for global EV supply chain corridors.
    Balances Cost, Time, and Carbon/Risk factors.
    """

    def __init__(self):
        # High-fidelity network nodes (Global Logistics Hubs)
        self.nodes = [
            "Shanghai", "Shenzhen", "Singapore", "Hamburg", "Rotterdam", 
            "Mumbai", "Chennai", "Detroit", "Long Beach", "Antwerp"
        ]
        
        # Weighted Directed Acyclic Graph (DAG) for global corridors
        # (Origin, Destination, Mode, BaseCost_USD, BaseTime_Days, RiskFactor_0_1)
        self.edges = [
            ("Shanghai", "Hamburg", "Sea", 1800, 32, 0.05),
            ("Shanghai", "Hamburg", "Air", 8500, 3, 0.02),
            ("Shenzhen", "Chennai", "Sea", 1200, 14, 0.08),
            ("Singapore", "Mumbai", "Sea", 900, 10, 0.03),
            ("Mumbai", "Hamburg", "Sea", 1400, 24, 0.12),
            ("Mumbai", "Hamburg", "Air", 6200, 4, 0.01),
            ("Detroit", "Hamburg", "Air", 4500, 2, 0.01),
            ("Rotterdam", "Mumbai", "Sea", 1550, 26, 0.08),
            ("Chennai", "Singapore", "Sea", 450, 4, 0.02),
            ("Singapore", "Rotterdam", "Sea", 1700, 28, 0.04),
        ]

    def find_optimal_route(
        self, 
        origin: str, 
        destination: str, 
        priority: str = "balanced", 
        disruptions: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Dijkstra-inspired pathfinding with multi-objective weighting.
        priority: 'speed', 'cost', 'resiliency'
        """
        disruptions = disruptions or []
        
        # Weight coefficients based on priority
        weights = {
            "speed": {"time": 0.8, "cost": 0.1, "risk": 0.1},
            "cost": {"time": 0.1, "cost": 0.8, "risk": 0.1},
            "resiliency": {"time": 0.2, "cost": 0.2, "risk": 0.6},
            "balanced": {"time": 0.4, "cost": 0.4, "risk": 0.2}
        }.get(priority, "balanced")

        graph = {}
        for u, v, mode, cost, time, risk in self.edges:
            # Skip disrupted routes
            if f"{u}->{v}" in disruptions or mode in disruptions:
                continue
            
            if u not in graph: graph[u] = []
            
            # Normalize and weight the score (Lower is better)
            # Normalization benchmarks: $10k cost, 40 days time
            score = (
                (cost / 10000) * weights["cost"] + 
                (time / 40) * weights["time"] + 
                risk * weights["risk"]
            )
            graph[u].append((v, score, mode, cost, time, risk))

        # Dijkstra Implementation
        queue = [(0, origin, [], 0, 0, 0)] # (total_score, current, path, total_cost, total_time, max_risk)
        visited = {}
        best_path = None

        while queue:
            (s, u, path, c, t, r) = heapq.heappop(queue)
            
            if u == destination:
                best_path = {"score": s, "nodes": path + [u], "cost": c, "time": t, "risk": r}
                break
                
            if u in visited and visited[u] <= s:
                continue
            visited[u] = s
            
            for v, weight, mode, edge_cost, edge_time, edge_risk in graph.get(u, []):
                new_path = path + [u]
                heapq.heappush(queue, (s + weight, v, new_path, c + edge_cost, t + edge_time, max(r, edge_risk)))

        if not best_path:
            return {"error": "No viable corridor found under current constraints."}

        return {
            "origin": origin,
            "destination": destination,
            "corridor_path": best_path["nodes"],
            "metrics": {
                "estimated_cost_usd": best_path["cost"],
                "transit_days": best_path["time"],
                "risk_index": round(best_path["risk"], 2),
                "eta_prediction": (datetime.now() + timedelta(days=best_path["time"])).strftime("%Y-%m-%d")
            },
            "protocol": "Active" if best_path["risk"] < 0.1 else "Observation Required"
        }

    def simulate_global_network(self) -> List[Dict[str, Any]]:
        """
        Returns a high-fidelity snapshot of all major global trade lanes.
        """
        active_routes = []
        for u, v, mode, cost, time, risk in self.edges:
            # Add some variance for 'Live' feel
            jitter = np.random.uniform(0.95, 1.05)
            active_routes.append({
                "id": f"RT-{u[:3].upper()}-{v[:3].upper()}",
                "corridor": f"{u} → {v}",
                "mode": mode,
                "transit": f"{round(time * jitter)}d",
                "utilization": f"{round(np.random.uniform(75, 98))}%",
                "status": "Active" if risk < 0.1 else "Delayed",
                "origin": u,
                "destination": v,
                "logic_score": round(1.0 - risk, 2)
            })
        return active_routes
