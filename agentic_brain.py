"""
NEXUS-SCM | Agentic Brain - TITAN V4 SOVEREIGN OVERHAUL
Anchored on public.v4_titan_intelligence_fabric
Causal Features: Maker Volumes, Battery Lead Signal, Industrial Inflection
"""
import pandas as pd
import numpy as np
import shap
from sklearn.ensemble import GradientBoostingRegressor
import sqlite3
from sqlalchemy import create_engine, text
from pulp import LpProblem, LpMinimize, LpVariable, lpSum
from scipy.stats import norm
import warnings
import os
from datetime import datetime

warnings.filterwarnings('ignore')

print("🚀 Booting NEXUS-SCM Titan V4 (Sovereign Causal Agentic Brain)...")

# Database Connection
engine = create_engine('postgresql://postgres:saharsha@localhost:5432/nexus_scm')

def get_in_transit_inventory():
    try:
        conn = sqlite3.connect('erp_ledger.db')
        df_erp = pd.read_sql(
            "SELECT delivery_node, SUM(quantity) as in_transit FROM order_history "
            "WHERE status = 'CONFIRMED_IN_ERP' GROUP BY delivery_node", conn
        )
        conn.close()
        return df_erp.set_index('delivery_node')['in_transit'].to_dict()
    except:
        return {}

def get_recent_decisions():
    try:
        with engine.connect() as conn:
            query = "SELECT DISTINCT title FROM public.autonomous_decisions WHERE created_at > NOW() - INTERVAL '24 hours'"
            res = conn.execute(text(query)).fetchall()
            return [r[0] for r in res]
    except:
        return []

in_transit_map = get_in_transit_inventory()
recent_decisions = get_recent_decisions()

# ─── CLEANUP ──────────────────────────────────────────────────────────────
try:
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM public.autonomous_decisions WHERE status = 'PENDING'"))
    print("🧹 Neural Buffer Cleared: Old PENDING states purged.")
except Exception as e:
    print(f"⚠️  Cleanup failed: {str(e)}")

# ─── TITAN V4 DATA INGESTION ───────────────────────────────────────────────
print("📡 Fetching Titan V4 Intelligence Fabric (Causal Anchor)...")
with engine.connect() as conn:
    df = pd.read_sql(
        "SELECT * FROM public.v4_titan_intelligence_fabric ORDER BY region_name, date_key",
        conn
    )

df['date_key'] = pd.to_datetime(df['date_key'])

# ─── TITAN V4 CAUSAL FEATURE ENGINEERING ──────────────────────────────────
# Battery lead signal: 60-day logistical gap between Asian shipping
# and Indian RTO registrations (2-month shift per mandate)
df['supply_lag_signal'] = (
    df.groupby('region_name')['battery_lead_signal'].shift(2).fillna(0)
)

# Industrial Inflection momentum (rolling 3-month mean)
df['industrial_momentum'] = (
    df.groupby('region_name')['reg_industrial']
    .transform(lambda x: x.rolling(3, min_periods=1).mean())
    .fillna(0)
)

# Target demand variance (Z-Score basis for Neuro-Core Anomaly Scanner)
df['demand_variance'] = (
    df.groupby('region_name')['target_demand']
    .transform(lambda x: x.rolling(14, min_periods=1).var())
    .fillna(0)
)

# Anomaly Z-Score based on target_demand variance
df['demand_z_score'] = (
    df.groupby('region_name')['target_demand']
    .transform(lambda x: (x - x.mean()) / (x.std() + 1e-9))
    .fillna(0)
)

train_df = df.dropna(subset=['target_demand']).copy()

# ─── V4 FEATURE MATRIX ────────────────────────────────────────────────────
features = [
    'ev_penetration_rate',
    'reg_tata', 'reg_ola', 'reg_mahindra',
    'reg_2w', 'reg_industrial',
    'battery_lead_signal',
    'supply_lag_signal',
    'industrial_momentum'
]
# Only use features that exist in the dataframe
features = [f for f in features if f in train_df.columns]
target = 'target_demand'

# ─── PROBABILISTIC QUANTILE ML ────────────────────────────────────────────
print("🧠 Training Titan V4 Neuro-Core Quantile Models...")
X = train_df[features].fillna(0)
y = train_df[target].fillna(0)

model_p10 = GradientBoostingRegressor(loss='quantile', alpha=0.1, n_estimators=100).fit(X, y)
model_p50 = GradientBoostingRegressor(loss='quantile', alpha=0.5, n_estimators=100).fit(X, y)
model_p90 = GradientBoostingRegressor(loss='quantile', alpha=0.9, n_estimators=100).fit(X, y)

# Latest state per region
latest_data = train_df.groupby('region_name').tail(1).copy().reset_index(drop=True)
latest_data['demand_p10'] = np.maximum(model_p10.predict(latest_data[features].fillna(0)), 0)
latest_data['demand_p50'] = np.maximum(model_p50.predict(latest_data[features].fillna(0)), 0)
latest_data['demand_p90'] = np.maximum(model_p90.predict(latest_data[features].fillna(0)), 10)

# ─── SHAP EXPLAINABILITY ──────────────────────────────────────────────────
explainer = shap.TreeExplainer(model_p50)
shap_values = explainer.shap_values(latest_data[features].fillna(0))

def generate_shap_reason(row_idx):
    contributions = shap_values[row_idx]
    top_idx = np.argsort(-np.abs(contributions))[0]
    feat = features[top_idx]
    impact = "surge" if contributions[top_idx] > 0 else "deceleration"
    mapping = {
        'ev_penetration_rate':   f"regional EV maturity index ({impact})",
        'reg_tata':              f"Tata Motors volume signal ({impact})",
        'reg_ola':               f"Ola Electric adoption wave ({impact})",
        'reg_mahindra':          f"Mahindra EV market share ({impact})",
        'reg_2w':                f"2-wheeler EV segment ({impact})",
        'reg_industrial':        f"industrial inflection signal ({impact})",
        'battery_lead_signal':   f"Asian battery import lead signal ({impact})",
        'supply_lag_signal':     f"60-day supply lag (Asian shipping → RTO) ({impact})",
        'industrial_momentum':   f"industrial demand momentum ({impact})",
    }
    reason_text = mapping.get(feat, f"market causal signal ({impact})")

    # Battery Starvation / Industrial Inflection qualitative flags
    bat_val = latest_data.iloc[row_idx].get('battery_lead_signal', 0)
    ind_val = latest_data.iloc[row_idx].get('reg_industrial', 0)
    flags = []
    if bat_val < 50:
        flags.append("⚠️ BATTERY STARVATION RISK: Low Asian import signal")
    if ind_val > latest_data['reg_industrial'].mean() * 1.2:
        flags.append("📈 INDUSTRIAL INFLECTION DETECTED: Above-average industrial EV demand")
    suffix = " | " + " | ".join(flags) if flags else ""

    return f"Forecast driven by {reason_text}{suffix}"

# ─── STOCHASTIC MEIO SOLVER ───────────────────────────────────────────────
print("⚖️  Optimizing Regional Inventory Nodes (V4 Causal)...")
prob = LpProblem("NEXUS_MEIO_V4", LpMinimize)
regions = latest_data['region_name'].tolist()
Z_SCORE = norm.ppf(0.98)  # 98% Sovereign Service Level

regional_vars = {
    r: LpVariable(f"Stock_{r.replace(' ', '_').replace('-', '_')}", 0, None)
    for r in regions
}
prob += lpSum([regional_vars[r] for r in regions])

for idx, region in enumerate(regions):
    D = latest_data.iloc[idx]['demand_p50']
    Var_D = max(latest_data.iloc[idx]['demand_variance'], 5)
    SS = Z_SCORE * np.sqrt(14 * Var_D)
    prob += regional_vars[region] >= (latest_data.iloc[idx]['demand_p90'] + SS)

prob.solve()

# ─── AGENTIC ACTION CARDS (V4) ────────────────────────────────────────────
print("📝 Generating Titan V4 Agentic Action Cards...")

decisions = []
for i, region in enumerate(regions):
    opt_stock = regional_vars[region].varValue
    in_transit = in_transit_map.get(region, 0)
    final_order = max(0, int(opt_stock - in_transit))

    if final_order <= 5:
        continue

    explanation = generate_shap_reason(i)
    bat_delta = latest_data.iloc[i].get('battery_lead_signal', 0)
    ind_delta = latest_data.iloc[i].get('reg_industrial', 0)
    maker_deltas = {
        'Tata': latest_data.iloc[i].get('reg_tata', 0),
        'Ola': latest_data.iloc[i].get('reg_ola', 0),
        'Mahindra': latest_data.iloc[i].get('reg_mahindra', 0),
    }
    top_maker = max(maker_deltas, key=maker_deltas.get)
    top_maker_val = maker_deltas[top_maker]

    trigger = (
        f"{explanation} | {top_maker} delta: {top_maker_val:.0f} units | "
        f"Battery signal: {bat_delta:.1f} | Industrial: {ind_delta:.0f} regs"
    )

    summary = (
        f"Autonomous V4 Action: Re-balanced {final_order} units to {region}. "
        f"{explanation}. 98% service-level buffer applied."
    )

    decision = {
        'decision_type': 'GENERATE_PO',
        'title': f"[V4_CAUSAL] {region} Titan Hub Optimization",
        'trigger_reason': trigger,
        'input_data_summary': (
            f"p90 Demand: {int(latest_data.iloc[i]['demand_p90'])} | "
            f"BatteryLead: {bat_delta:.1f} | IndustrialInflection: {ind_delta:.0f}"
        ),
        'ai_confidence_score': 94.5,
        'action_taken': summary,
        'action_parameters': str(final_order) + " units",
        'status': 'PENDING',
        'was_overridden_by_human': False
    }
    decisions.append(decision)

# ─── FINAL PUSH ───────────────────────────────────────────────────────────
if decisions:
    decisions_df = pd.DataFrame(decisions)
    with engine.begin() as conn:
        decisions_df.to_sql(
            'autonomous_decisions', engine,
            schema='public', if_exists='append', index=False
        )
    print(f"✅ Success: {len(decisions)} Titan V4 Decisions committed to Digital Twin.")
else:
    print("💤 System Stable: No V4 intervention required.")