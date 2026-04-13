import time
import pandas as pd
import os
import io
from datetime import datetime
from sqlalchemy import create_engine, types, text
from playwright.sync_api import sync_playwright

# --- CONFIGURATION ---
DB_URI = 'postgresql://postgres:saharsha@localhost:5432/nexus_scm'
TARGET_URL = "https://vahan.parivahan.gov.in/vahan4dashboard/vahan/dashboardview.xhtml"

def extract_targeted_table(page, selector):
    """
    Extracts data from specific PrimeFaces containers by ID.
    Debugs content and attempts to find a valid table with rows.
    """
    try:
        page.wait_for_selector(f"#{selector}", timeout=30000)
        
        # Wait specifically for data rows to load via AJAX
        data_rows_selector = f"#{selector}_data tr"
        print(f"      Waiting for data in {selector}...")
        try:
            page.wait_for_selector(data_rows_selector, timeout=20000)
        except:
            print(f"      [!] Rows not detected in body after 20s.")

        container_html = page.locator(f"#{selector}").evaluate("el => el.outerHTML")
        
        if not container_html or len(container_html) < 200:
            print(f"      [!] Container {selector} appears too small ({len(container_html)} chars).")
            return None

        # Parse with Pandas
        dfs = pd.read_html(io.StringIO(container_html))
        
        if not dfs:
            print(f"      [!] No tables found in container {selector} HTML.")
            return None
        
        # Find the first non-empty table
        df = None
        for temp_df in dfs:
            if len(temp_df) > 0:
                df = temp_df
                break
        
        if df is None:
            print(f"      [!] All tables in {selector} are empty.")
            return None
            
        # Clean columns
        df.columns = [
            str(c).lower().replace(' ', '_').replace('(', '').replace(')', '').replace('.', '').strip() 
            for c in df.columns
        ]
        
        # Metadata
        df['extracted_at'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"      Found {len(df)} rows. Columns: {list(df.columns)}")
        
        return df
        
    except Exception as e:
        print(f"      [!] Extraction error for {selector}: {e}")
        return None

def verify_tables(engine):
    """Lists all tables in the public schema for verification."""
    print("\n[VERIFICATION] Listing tables in 'nexus_scm' database:")
    try:
        with engine.connect() as conn:
            result = conn.execute(text(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
            ))
            tables = [row[0] for row in result]
            vahan_tables = [t for t in tables if t.startswith("vahan_")]
            for t in tables:
                status = "✅" if t.startswith("vahan_") else "📦"
                print(f"   {status} {t}")
            
            if not vahan_tables:
                print("\n   [❌] NO VAHAN TABLES DETECTED.")
            else:
                print(f"\n   [✔] Verified {len(vahan_tables)} Vahan tables.")
    except Exception as e:
        print(f"   [!] Verification failed: {e}")

def run_vahan_deep_sync():
    print(f"\n{'='*60}")
    print(f"NEXUS-SCM | Vahan Intelligence Deep-Sync [v2.2]")
    print(f"Target DB: {DB_URI}")
    print(f"{'='*60}\n")
    
    engine = create_engine(DB_URI)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(viewport={'width': 1600, 'height': 900})
        page = context.new_page()
        
        print(f"[*] Navigating to Vahan Portal...")
        page.goto(TARGET_URL, wait_until="networkidle", timeout=60000)
        
        # SNAPSHOTS: Till Today + Historical
        snapshots = ["Till Today", "2026", "2025", "2024", "2023", "2022"]
        
        # ID Map
        table_targets = {
            "fuel": "datatable_fuel",
            "maker": "datatable_maker"
        }

        for snap in snapshots:
            print(f"\n[PHASE] Snapshot Target: {snap}")
            try:
                # Target the link in the "Vehicle Registration" panel
                print(f"   -> Clicking '{snap}' link...")
                
                # Use a specific locator to avoid clicking text in tables themselves
                # Usually there's a specific div or panel for years
                try:
                    # Look for the link by text. If multiple, pick the first in registration section.
                    link = page.locator(f"a:has-text('{snap}')").first
                    page.wait_for_selector(f"a:has-text('{snap}')", timeout=10000)
                    link.click(force=True)
                except:
                    print(f"   [!] Link '{snap}' find failed. Trying fallback text click...")
                    page.click(f"text='{snap}'", timeout=10000)
                
                # Server aggregation patience (Mandatory)
                print(f"   -> Waiting 25 seconds for AJAX data sync...")
                time.sleep(25)
                
                # Scroll to bottom
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                time.sleep(3)

                label = snap.replace(" ", "_").lower()

                for key, selector in table_targets.items():
                    print(f"   -> Syncing: {selector}...")
                    df = extract_targeted_table(page, selector)
                    
                    if df is not None and len(df) > 0:
                        table_name = f"vahan_{key}_{label}"
                        df.to_csv(f"backup_{table_name}.csv", index=False)
                        
                        with engine.begin() as conn:
                            df.to_sql(
                                table_name,
                                conn,
                                if_exists='replace',
                                index=False,
                                schema='public',
                                dtype={col: types.TEXT for col in df.columns}
                            )
                        print(f"      ✅ DB WRITE SUCCESS: {table_name}")
                    else:
                        print(f"      [!] No valid data for {key} in this snapshot.")

            except Exception as e:
                print(f"   [!] Failed snapshot '{snap}': {e}")

        # Final Verify
        verify_tables(engine)
        
        print(f"\n{'='*60}")
        print("SYNC COMPLETE.")
        print(f"{'='*60}\n")
        browser.close()

if __name__ == "__main__":
    run_vahan_deep_sync()
