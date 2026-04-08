import logging
from typing import List, Dict, Any

logger = logging.getLogger("nexus-scm.ml")

class CommercialAssortmentOptimizer:
    """
    NEXUS-SCM Commercial Assortment Optimizer.
    Ranks supply chain technology options based on LCOP (Cost) and TRL (Readiness).
    """

    def __init__(self, wacc: float = 0.08, lifetime_yrs: int = 15):
        self.wacc = wacc
        self.lifetime = lifetime_yrs

    def calculate_lcop(self, capacity_gwh: float, capex_per_gwh: float, opex_rate: float, material_cost_per_kwh: float) -> float:
        """
        Standard IEA methodology for Levelized Cost of Production.
        Returns: $/kWh
        """
        # Capital Recovery Factor
        crf = (self.wacc * (1 + self.wacc)**self.lifetime) / ((1 + self.wacc)**self.lifetime - 1)
        
        total_capex = capacity_gwh * capex_per_gwh
        annual_capex = total_capex * crf
        fixed_opex = total_capex * opex_rate
        
        # Output assume 85% utilization
        utilization = 0.85
        annual_output_kwh = capacity_gwh * 1e6 * 1000 * utilization # GWh -> kWh
        
        variable_opex = annual_output_kwh * material_cost_per_kwh
        total_annual_cost = annual_capex + fixed_opex + variable_opex
        
        return total_annual_cost / annual_output_kwh

    def rank_technologies(self, demand_gwh: float, tech_options: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Ranks technologies (NMC, LFP, Sodium-Ion) based on a weighted Score.
        """
        ranked = []
        for tech in tech_options:
            lcop = self.calculate_lcop(
                capacity_gwh=demand_gwh, 
                capex_per_gwh=tech.get('capex_per_gwh', 80e6),
                opex_rate=tech.get('opex_rate', 0.03),
                material_cost_per_kwh=tech.get('material_cost_per_kwh', 100)
            )
            
            trl = tech.get('trl', 5) # Default TRL 5 (Pilot)
            
            # Normalize scores (Higher TRL is good, Lower LCOP is good)
            score = 200 - (lcop) + (trl * 5)
            
            ranked.append({
                "tech_name": tech['name'],
                "lcop_per_kwh": round(lcop, 2),
                "trl_score": trl,
                "overall_score": round(score, 2),
                "recommendation": "Deploy immediately" if trl >= 8 and lcop < 100 else "Wait for Scaling"
            })
            
        return sorted(ranked, key=lambda x: x['overall_score'], reverse=True)

    def optimize_assortment_strategy(self, state_data: Dict[str, Any]) -> Dict[str, Any]:
        return {}
