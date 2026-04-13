import pandas as pd
from sqlalchemy import create_engine, text

def apply_schema():
    print("Connecting to database...")
    engine = create_engine('postgresql://postgres:saharsha@localhost:5432/nexus_scm')
    
    with engine.begin() as conn:
        print("Applying BOM mapping (bom_components)...")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS public.bom_components (
                id SERIAL PRIMARY KEY,
                parent_product_id INTEGER REFERENCES public.products(id),
                component_name VARCHAR(255),
                hs_code VARCHAR(20),
                quantity_per_unit DOUBLE PRECISION,
                unit_of_measure VARCHAR(50),
                is_critical_path BOOLEAN DEFAULT true,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        """))

        print("Applying Semantic Graph Layer (network_nodes, network_edges)...")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS public.network_nodes (
                node_id SERIAL PRIMARY KEY,
                node_type VARCHAR(50),
                entity_id INTEGER,
                loc_h3_index VARCHAR(15),
                name VARCHAR(255)
            );
        """))
        
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS public.network_edges (
                edge_id SERIAL PRIMARY KEY,
                source_node_id INTEGER REFERENCES public.network_nodes(node_id),
                target_node_id INTEGER REFERENCES public.network_nodes(node_id),
                relationship_type VARCHAR(50),
                transport_mode VARCHAR(50),
                avg_transit_time_days DOUBLE PRECISION,
                transit_variance_days DOUBLE PRECISION
            );
        """))

        print("Adding ESG columns...")
        # Add columns if they do not exist
        try:
            conn.execute(text("ALTER TABLE public.products ADD COLUMN expected_carbon_footprint_kg DOUBLE PRECISION;"))
        except Exception as e:
            print(f"Column expected_carbon_footprint_kg may exist: {e}")
            
        try:
            conn.execute(text("ALTER TABLE public.products ADD COLUMN local_mfg_value_pct DOUBLE PRECISION;"))
        except:
            pass
            
        try:
            conn.execute(text("ALTER TABLE public.shipments ADD COLUMN actual_carbon_emitted_kg DOUBLE PRECISION;"))
        except:
            pass

        print("Creating Gold Feature Store (gold_scm_features)...")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS public.gold_scm_features (
                feature_id SERIAL PRIMARY KEY,
                date_key DATE NOT NULL,
                geospatial_h3 VARCHAR(15),
                
                vahan_retail_registrations DOUBLE PRECISION,
                vahan_velocity_7d_ma DOUBLE PRECISION,
                policy_pulse_index DOUBLE PRECISION,
                
                critical_hs_import_volume DOUBLE PRECISION,
                avg_supplier_lead_time DOUBLE PRECISION,
                
                port_congestion_index DOUBLE PRECISION,
                carrier_delay_variance DOUBLE PRECISION,
                
                bullwhip_ratio DOUBLE PRECISION,
                resilience_buffer_days DOUBLE PRECISION,
                
                is_outlier BOOLEAN DEFAULT false,
                anomaly_z_score DOUBLE PRECISION,
                
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        """))
        
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_gold_scm_temporal ON public.gold_scm_features (date_key, geospatial_h3);
        """))
        
        print("Schema successfully applied!")

if __name__ == "__main__":
    apply_schema()
