import pandas as pd
import numpy as np
from datetime import datetime, timedelta

def generate_data():
    regions = ["Maharashtra", "Punjab", "Karnataka"]
    start_date = datetime(2022, 1, 1)
    months = 36
    
    rows = []
    for region in regions:
        # Varying base demand for each region
        base_demand = {"Maharashtra": 12000, "Punjab": 8000, "Karnataka": 10000}[region]
        growth_rate = 1.02 # 2% monthly growth
        
        for m in range(months):
            current_date = start_date + timedelta(days=m*30.5)
            month_idx = m
            
            # Add seasonality (Peak in Oct/Nov)
            seasonality = 1.0 + 0.2 * np.sin(2 * np.pi * (current_date.month - 1) / 12)
            if current_date.month in [10, 11]: seasonality += 0.15
            
            demand = int(base_demand * (growth_rate ** month_idx) * seasonality)
            
            # Causal Signals (following demand with some noise)
            battery = demand * 6.5 + np.random.normal(0, 500)
            motor = demand * 0.25 + np.random.normal(0, 50)
            
            # Maker splits (TVS/TATA leaders)
            tata = int(demand * 0.25)
            tvs = int(demand * 0.35)
            ola = int(demand * 0.15)
            mahindra = int(demand * 0.12)
            ather = int(demand * 0.08)
            bajaj = int(demand * 0.05)
            
            rows.append({
                "date_key": current_date.strftime("%Y-%m-%d"),
                "region_name": region,
                "target_demand": demand,
                "ev_penetration_rate": round(0.04 + 0.002 * month_idx, 3),
                "reg_tata": tata,
                "reg_mahindra": mahindra,
                "reg_ola": ola,
                "reg_tvs": tvs,
                "reg_ather": ather,
                "reg_bajaj": bajaj,
                "reg_2w": int(demand * 1.2),
                "reg_industrial": int(demand / 30),
                "reg_pv": int(demand * 0.7),
                "battery_lead_signal": round(battery, 1),
                "motor_lead_signal": round(motor, 1),
                "demand_z_score": round(np.random.normal(1.0, 0.5), 2)
            })
            
    df = pd.DataFrame(rows)
    df.to_csv(r"c:\Users\Admin\OneDrive\Documents\AI_SCM_Project(Copy)\test_demand.csv", index=False)
    print(f"Synthesized {len(df)} rows across 3 regions.")

if __name__ == "__main__":
    generate_data()
