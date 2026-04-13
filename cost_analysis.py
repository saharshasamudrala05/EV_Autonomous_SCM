import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

# ==========================================
# 1. IEA LCOP METHODOLOGY (Corrected)
# ==========================================
def calculate_lcop(capacity_gwh, capex_per_gwh, opex_rate, material_cost_per_kwh):
    # Financial Assumptions
    wacc = 0.08    # 8% Cost of Capital
    lifetime = 15  # 15 Year factory life
    utilization = 0.85 # 85% Uptime

    # 1. Annualised CAPEX
    # We remove the extra '1e6' here because inputs are already in full USD value
    total_capex = capacity_gwh * capex_per_gwh 
    
    # Capital Recovery Factor (Standard Finance Formula)
    crf = (wacc * (1 + wacc)**lifetime) / ((1 + wacc)**lifetime - 1)
    annual_capex = total_capex * crf

    # 2. Fixed OPEX (Staff, Maintenance)
    fixed_opex = total_capex * opex_rate

    # 3. Variable OPEX (The Materials)
    # Convert GWh to kWh: 1 GWh = 1,000,000,000 kWh
    annual_output_kwh = capacity_gwh * 1e9 * utilization
    variable_opex = annual_output_kwh * material_cost_per_kwh

    # 4. Final LCOP
    total_annual_cost = annual_capex + fixed_opex + variable_opex
    lcop_per_kwh = total_annual_cost / annual_output_kwh
    
    return lcop_per_kwh, total_annual_cost

# ==========================================
# 2. INPUTS (Real World Benchmarks)
# ==========================================
target_capacity = 30 # GWh

# OPTION A: Lithium-Ion (NMC)
# Factory: $80 Million per GWh
# Materials: $110 per kWh (High due to shortage)
li_capex = 80000000 
li_material = 110 

# OPTION B: Sodium-Ion
# Factory: $100 Million per GWh (Newer tech = slightly higher startup cost)
# Materials: $60 per kWh (Sodium is cheap/abundant)
na_capex = 100000000
na_material = 60

# ==========================================
# 3. RUN MODEL
# ==========================================
lcop_li, cost_li = calculate_lcop(target_capacity, li_capex, 0.03, li_material)
lcop_na, cost_na = calculate_lcop(target_capacity, na_capex, 0.04, na_material)

savings = cost_li - cost_na

# ==========================================
# 4. VISUALIZATION
# ==========================================
labels = ['Lithium-Ion', 'Sodium-Ion']
costs = [lcop_li, lcop_na]
colors = ['#FF6B6B', '#4ECDC4']

plt.figure(figsize=(9, 6))
bars = plt.bar(labels, costs, color=colors, width=0.5)

# Add accurate labels
for bar in bars:
    height = bar.get_height()
    plt.text(bar.get_x() + bar.get_width()/2., height + 2,
             f'${height:.2f} / kWh',
             ha='center', va='bottom', fontsize=12, fontweight='bold')

plt.title('Final Financial Verdict: LCOP Analysis', fontsize=14)
plt.ylabel('Cost ($ per kWh)', fontsize=12)
plt.ylim(0, 160) # Set reasonable y-axis for battery costs
plt.grid(axis='y', linestyle='--', alpha=0.3)

# Annotation
plt.text(0.5, 140, 
         f"ANNUAL PROFIT INCREASE:\n${savings/1e6:.0f} Million", 
         ha='center', fontsize=12, color='green', fontweight='bold',
         bbox=dict(facecolor='white', edgecolor='green', boxstyle='round'))

plt.savefig('Financial_Verdict_Fixed.png')

print(f"✅ Analysis Corrected.")
print(f"   Lithium LCOP: ${lcop_li:.2f}/kWh")
print(f"   Sodium LCOP:  ${lcop_na:.2f}/kWh")
print(f"   Conclusion: Sodium is ${(lcop_li - lcop_na):.2f}/kWh cheaper.")