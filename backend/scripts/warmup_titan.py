import os
import sys

# Add the project root to sys.path to allow absolute imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.core.database import SessionLocal
from backend.ml.demand_forecast.engine import DemandForecastEngine
import pandas as pd
from sqlalchemy import text

def warm_up():
    db = SessionLocal()
    print("\n🛰️ TITAN V4: Initiating Global Shard Training...")
    
    # 1. Fetch all unique states
    try:
        query = text("SELECT DISTINCT region_name FROM public.v4_titan_intelligence_fabric")
        regions = [r[0] for r in db.execute(query).fetchall()]
        print(f"📌 Found {len(regions)} regions in the Intelligence Fabric.")
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return
    
    fe = DemandForecastEngine(country="India")
    
    # Create artifacts directory if missing
    os.makedirs("backend/ml/artifacts/registry", exist_ok=True)
    
    results = []
    for region in regions:
        print(f"\n🧠 Training Shard: {region}...")
        try:
            q = text("SELECT * FROM public.v4_titan_intelligence_fabric WHERE region_name = :r ORDER BY date_key")
            df = pd.read_sql(q, db.bind, params={"r": region})
            
            if df.empty:
                print(f"⚠️ No data for {region}. Skipping.")
                continue

            # Train and Save
            history = df.to_dict(orient="records")
            fe.train(history)
            fe.save_model(region)
            
            analytics = fe.get_analytics()
            print(f"✅ Saved: {region}_v4.joblib (Accuracy: {analytics['accuracy']}%)")
            results.append(analytics['accuracy'])
        except Exception as e:
            print(f"❌ Failed shard {region}: {e}")
            
    if results:
        avg_acc = sum(results) / len(results)
        print(f"\n✨ VAULT SYNCHRONIZED: {len(results)} Shards Pre-Trained.")
        print(f"📊 Mean Shard Accuracy: {avg_acc:.2f}%\n")
    else:
        print("\n⚠️ No shards were trained.")

    # 2. Finally, Train the National Combined Snapshot
    print("🌍 Finalizing National Combined Snapshot...")
    try:
        q = text("SELECT * FROM public.v4_titan_intelligence_fabric ORDER BY date_key")
        df = pd.read_sql(q, db.bind)
        # Group by date for the unified curve
        df_nat = df.groupby('date_key').sum(numeric_only=True).reset_index()
        history = df_nat.to_dict(orient="records")
        fe.train(history)
        fe.save_model("National")
        print("✅ National Baseline Artifact Persisted.")
    except Exception as e:
        print(f"❌ National training failed: {e}")

if __name__ == "__main__":
    warm_up()
