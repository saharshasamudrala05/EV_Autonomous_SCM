"""
NEXUS-SCM | Reporting API Routes
Bridges Intelligence Dossiers to the Mission Control UI.
"""
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
import pandas as pd
from backend.core.database import get_db, engine
from backend.ml.report_agent import SovereignReportAgent

router = APIRouter(prefix="/reports", tags=["Executive Summary"])
report_agent = SovereignReportAgent()

from fastapi.concurrency import run_in_threadpool
from backend.core.database import engine

@router.get("/dossier")
async def generate_network_dossier():
    """
    Asynchronous Synthesis Gateway.
    Bridges the Digital Twin telemetry to the Llama 3.3 Analytic Engine.
    """
    def generate_dossier_logic():
        try:
            # 1. Fetch live Demand & Risk telemetry (Titan V4 Fabric)
            query_features = "SELECT * FROM public.v4_titan_intelligence_fabric ORDER BY date_key DESC LIMIT 100"
            features_df = pd.read_sql(query_features, engine)
            
            # Ensure the report agent has real data to work with
            if features_df.empty:
                return bytes("INTERNAL_REGISTRY_EMPTY: No data in v4_titan_intelligence_fabric.", "utf-8")

            # 2. Fetch Agentic Decision Logs
            query_decisions = "SELECT action_taken, trigger_reason, created_at FROM public.autonomous_decisions ORDER BY created_at DESC LIMIT 10"
            decisions_df = pd.read_sql(query_decisions, engine)
            decisions_json = decisions_df.to_dict(orient="records")

            # 3. Trigger High-Fidelity PDF Synthesis
            # This generates charts and embeds them into a professional PDF
            pdf_bytes = report_agent.generate_executive_pdf(df=features_df, logs=decisions_json)
            return pdf_bytes
        except Exception as e:
            # Fallback for critical errors (returns generic error notice)
            return bytes(f"PDF_SYNTHESIS_FAILURE: {str(e)}", "utf-8")

    # Offload the heavy PDF/Chart generation to a background thread
    pdf_content = await run_in_threadpool(generate_dossier_logic)

    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=NEXUS_SOVEREIGN_DOSSIER_{datetime.now().strftime('%Y%m%d')}.pdf"
        }
    )
