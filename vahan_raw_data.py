import time
import pandas as pd
import os
from datetime import datetime
from sqlalchemy import create_engine, types, text
from playwright.sync_api import sync_playwright

# --- CONFIGURATION ---
# Target DB URI: postgresql://postgres:saharsha@localhost:5432/nexus_scm
DB_URI = 'postgresql://postgres:saharsha@localhost:5432/nexus_scm'
# Vahan Dashboard View
TARGET_URL = "https://vahan.parivahan.gov.in/vahan4dashboard/vahan/dashboardview.xhtml"

def extract_targeted_table(page, selector):
    """
    Extracts data from specific PrimeFaces containers by ID to avoid memory buffer crashes.
    """
    try:
        # Step-specific Wait for the selector
        page.wait_for_selector(f"#{selector}", timeout=60000)
        
        # Target the specific container ID provided in requirements
        container_html = page.locator(f"#{selector}").inner_html()
        
        # Parse container HTML with Pandas
        dfs = pd.read_html(container_html)
        if not dfs:
            return None
        
        df = dfs[0]
        
        # Clean columns for PostgreSQL compatibility
        df.columns = [
            str(c).lower().replace(' ', '_').replace('(', '').replace(')', '').replace('.', '') 
            for c in df.columns
        ]
        # Metadata
        df['extracted_at'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        return df
    except Exception as e:
        print(f"      [!] Extraction failed for selector #{selector}: {e}")
        return None

def main():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Starting NEXUS-SCM Deep-Sync [Vahan Data Port]...")
    engine = create_engine(DB_URI)
    
    with sync_playwright() as p:
        # Launching with headless=False to observe AJAX progress
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()
        
        print(f"   -> Connecting to: {TARGET_URL}")
        page.goto(TARGET_URL, wait_until="networkidle", timeout=90000)
        
        # REQUIRED ITERATION: Till Today first, then historical years
        snapshots = ["Till Today", "2026", "2025", "2024", "2023", "2022"]
        
        # IDs for tables as specified
        table_targets = {
            "fuel": "datatable_fuel",
            "maker": "datatable_maker",
            "catg": "datatable_Catg"
        }

        for snap in snapshots:
            print(f"\n[PHASE] Syncing Snapshot Target: {snap}")
            try:
                # 1. Click target link in Registration panel
                print(f"   -> Clicking '{snap}' link...")
                page.get_by_role("link", name=snap, exact=True).first.click(force=True)
                
                # 2. AJAX Patience: Essential 20s sleep for massive server-side aggregation
                print(f"   -> Waiting 20 seconds for server-side delta calculations...")
                time.sleep(20)
                
                # Scroll to bottom to trigger lazy-renders
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                time.sleep(2)

                snap_label = snap.replace(" ", "_").lower()

                # 3. Targeted Sync
                for key, selector in table_targets.items():
                    print(f"      Syncing table: {selector}")
                    df = extract_targeted_table(page, selector)
                    
                    if df is not None and not df.empty:
                        table_name = f"vahan_{key}_{snap_label}"
                        
                        # Failsafe: CSV local backup
                        backup_file = f"backup_{table_name}.csv"
                        df.to_csv(backup_file, index=False)
                        print(f"         Backup: {backup_file} saved.")

                        # 4. Explicit Transaction Management with engine.begin()
                        # Prevents silent rollbacks and ensures database visibility.
                        with engine.begin() as conn:
                            # Force public schema and TEXT dtypes
                            df.to_sql(
                                table_name,
                                conn,
                                if_exists='replace',
                                index=False,
                                schema='public',
                                dtype={col: types.TEXT for col in df.columns}
                            )
                        
                        print(f"         ✅ POSTGRES COMMIT: {table_name} [{len(df)} rows]")
                    else:
                        print(f"         [SKIP] {key} table holds no data for this period.")

            except Exception as e:
                print(f"   [!] SNAPSHOT ERROR [{snap}]: {e}")

        print("\n" + "="*60)
        print("HISTORICAL SYNC COMPLETE: Check pgAdmin for vahan_* tables.")
        print("="*60)
        browser.close()

if __name__ == "__main__":
    main()