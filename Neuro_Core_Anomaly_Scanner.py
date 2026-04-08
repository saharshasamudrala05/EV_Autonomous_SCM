"""
NEXUS-SCM | Neuro-Core Anomaly Scanner - TITAN V4 SOVEREIGN OVERHAUL
Anchored on public.v4_titan_intelligence_fabric
Z-Scores computed from target_demand variance (V4 mandate).
"""
import psycopg2
import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text


def run_neuro_core_scan():
    print(">>> Neuro-Core Titan V4 Anomaly Scanner initializing...")
    engine = create_engine("postgresql://postgres:saharsha@localhost:5432/nexus_scm")

    # 1. Pull V4 Titan Intelligence Fabric data
    with engine.connect() as conn:
        df = pd.read_sql(
            text("SELECT * FROM public.v4_titan_intelligence_fabric ORDER BY region_name, date_key"),
            conn
        )

    if df.empty:
        print("[WARN] v4_titan_intelligence_fabric is empty. No scan performed.")
        return

    df['date_key'] = pd.to_datetime(df['date_key'])

    # 2. Z-Score from TARGET_DEMAND variance (V4 mandate - not vahan_retail_registrations)
    stats = df.groupby('region_name')['target_demand'].agg(['mean', 'std']).reset_index()
    stats.columns = ['region_name', 'demand_mean', 'demand_std']
    df = df.merge(stats, on='region_name')
    df['z_score'] = (
        (df['target_demand'] - df['demand_mean']) /
        df['demand_std'].replace(0, np.nan)
    ).fillna(0)

    # 3. Velocity (7-day rolling mean of target_demand)
    df['velocity'] = (
        df.groupby('region_name')['target_demand']
        .transform(lambda x: x.rolling(window=7, min_periods=1).mean())
        .fillna(0)
    )

    # 4. Battery Starvation Flag (supply lead < 25th percentile = starvation risk)
    bat_p25 = df['battery_lead_signal'].quantile(0.25) if 'battery_lead_signal' in df.columns else 0
    df['battery_starvation'] = (
        df['battery_lead_signal'] < bat_p25
        if 'battery_lead_signal' in df.columns
        else False
    )

    # 5. Industrial Inflection Flag (reg_industrial > 120% of regional mean)
    if 'reg_industrial' in df.columns:
        ind_stats = df.groupby('region_name')['reg_industrial'].mean().reset_index()
        ind_stats.columns = ['region_name', 'ind_mean']
        df = df.merge(ind_stats, on='region_name')
        df['industrial_inflection'] = df['reg_industrial'] > (df['ind_mean'] * 1.2)
    else:
        df['industrial_inflection'] = False

    # 6. Outlier detection: Z-Score > 2.5 sigma = Logic Cluster Severity event
    df['is_outlier'] = df['z_score'].abs() > 2.5
    df['severity'] = df['z_score'].apply(lambda x: min(int(abs(x) * 2), 10))

    # 7. Print regional anomaly summary
    outliers = df[df['is_outlier']]
    if not outliers.empty:
        print(f"\n>>> [ANOMALY DETECTED] {len(outliers)} Titan V4 Z-Score events flagged:")
        for _, row in outliers.iterrows():
            bat_flag = " ⚠️ BATTERY STARVATION" if row.get('battery_starvation', False) else ""
            ind_flag = " 📈 INDUSTRIAL INFLECTION" if row.get('industrial_inflection', False) else ""
            print(
                f"  [{row['region_name']}] date={row['date_key'].date()} "
                f"z={row['z_score']:.2f} demand={row['target_demand']:.0f}"
                f"{bat_flag}{ind_flag}"
            )
    else:
        print(">>> [STABLE] No Titan V4 anomalies detected above 2.5 sigma.")

    # 8. Write Z-Scores back to autonomous_decisions as intelligence markers
    conn = psycopg2.connect(
        dbname="nexus_scm", user="postgres", password="saharsha",
        host="localhost", port="5432"
    )
    cur = conn.cursor()

    print("\n>>> Neuro-Core injecting V4 Z-Score intelligence...")

    # Compute region-level summary for agentic context
    region_summary = (
        df.groupby('region_name').agg(
            mean_z=('z_score', 'mean'),
            max_z=('z_score', 'max'),
            outlier_count=('is_outlier', 'sum'),
            battery_risk=('battery_starvation', 'any'),
            industrial_inflection=('industrial_inflection', 'any'),
        ).reset_index()
    )

    for _, row in region_summary.iterrows():
        region = row['region_name']
        max_z = row['max_z']
        bat_risk = row['battery_risk']
        ind_inf = row['industrial_inflection']
        outlier_count = int(row['outlier_count'])

        if outlier_count == 0:
            continue

        # Build trigger reason with specific maker/supply deltas
        latest_region = df[df['region_name'] == region].sort_values('date_key').iloc[-1]
        tata_delta = latest_region.get('reg_tata', 0)
        ola_delta = latest_region.get('reg_ola', 0)
        mah_delta = latest_region.get('reg_mahindra', 0)
        bat_signal = latest_region.get('battery_lead_signal', 0)
        ind_regs = latest_region.get('reg_industrial', 0)

        trigger = (
            f"V4 Z-Score: {max_z:.2f} ({outlier_count} outlier events). "
            f"Maker deltas — Tata: {tata_delta:.0f}, Ola: {ola_delta:.0f}, Mahindra: {mah_delta:.0f}. "
            f"Battery supply signal: {bat_signal:.1f}"
            + (" | ⚠️ BATTERY STARVATION RISK" if bat_risk else "")
            + (" | 📈 INDUSTRIAL INFLECTION DETECTED" if ind_inf else "")
        )

        cur.execute("""
            INSERT INTO public.autonomous_decisions
            (decision_type, title, trigger_reason, input_data_summary,
             ai_confidence_score, action_taken, action_parameters, status, was_overridden_by_human)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            'GENERATE_PO',
            f"[V4_NEURO] {region} Anomaly Scan Alert",
            trigger,
            f"target_demand Z-Score peak: {max_z:.2f} | Industrial: {ind_regs:.0f} regs",
            min(round(abs(max_z) * 25 + 50, 1), 99.9),
            f"Neuro-Core V4 flagged {outlier_count} demand anomaly events in {region}.",
            f'{{"region": "{region}", "z_score": {max_z:.2f}, "outliers": {outlier_count}}}',
            'PENDING',
            False
        ))

    conn.commit()
    cur.close()
    conn.close()
    print("[OK] Titan V4 Neuro-Core Scan Complete. Anomaly decisions committed.")


if __name__ == "__main__":
    run_neuro_core_scan()