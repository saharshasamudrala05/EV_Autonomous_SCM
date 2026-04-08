import json
import os
import matplotlib
matplotlib.use('Agg')  # Non-GUI backend for background thread safety
import matplotlib.pyplot as plt
import seaborn as sns
from fpdf import FPDF
from datetime import datetime
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from backend.config import settings


class SovereignReportAgent:
    """
    NEXUS-SCM | Titan V4 Sovereign Report Agent.
    Generates boardroom-ready PDF dossiers anchored on v4_titan_intelligence_fabric.
    Region names resolved directly from V4 SQL data (no hardcoded H3 map).
    Llama-3.3 forced to reason about Industrial Inflection and Battery Starvation.
    """

    def __init__(self):
        self.llm = ChatGroq(
            api_key=settings.GROQ_API_KEY or "dummy_key_to_bypass_validation",
            model_name="llama-3.3-70b-versatile",
            temperature=0.1
        )
        # V4 SYSTEM PROMPT: Forces mention of Industrial Inflection + Battery Starvation
        self.system_prompt = """
### SYSTEM ROLE: NEXUS-SCM TITAN V4 LEAD ORCHESTRATOR
You are the world's most advanced autonomous supply chain intelligence engine.
Convert raw Titan V4 telemetry into a boardroom-ready executive report.

MANDATORY ANALYTICAL DIRECTIVES (no exceptions):
1. You MUST identify and explicitly name any "Industrial Inflection" patterns
   using the reg_industrial column. If reg_industrial is significantly above the
   regional mean, call out: "INDUSTRIAL INFLECTION DETECTED in [REGION]."

2. You MUST analyze the battery_lead_signal column. If this value is low (< 50th
   percentile), explicitly state: "BATTERY STARVATION RISK: Asian import signal
   indicates a 60-day supply constraint ahead of RTO registration peaks."

3. Reference maker-specific volume deltas (reg_tata, reg_ola, reg_mahindra) to
   identify market share shifts. Name the dominant maker per region.

4. Provide a 'Chain of Thought' section explaining Bass Diffusion parameter
   interpretation (Innovation p vs Imitation q factor).

5. Close with 3 SOVEREIGN PRESCRIPTIONS: concrete actions for the SCM team.

Do NOT use placeholder language. Be specific, data-driven, and cite exact column values.
"""

    def _resolve_region_name(self, record: dict) -> str:
        """Resolve region_name directly from V4 data record (no hardcoded map)."""
        return record.get('region_name', 'Unknown Region')

    def _generate_visualizations(self, df):
        """Generates professional PNG charts for the executive dossier."""
        temp_dir = os.path.join(os.getcwd(), "tmp_reports")
        os.makedirs(temp_dir, exist_ok=True)

        # 1. Demand + Battery Lead Signal Dual-Axis Trend Chart
        fig, ax1 = plt.subplots(figsize=(12, 5))
        sns.set_theme(style="darkgrid")

        if 'target_demand' in df.columns:
            ax1.plot(df.index, df['target_demand'], label='Target Demand (V4)', color='#00aaff', linewidth=2)
        ax1.set_ylabel('Target Demand (Units)', color='#00aaff')
        ax1.tick_params(axis='y', labelcolor='#00aaff')

        if 'battery_lead_signal' in df.columns:
            ax2 = ax1.twinx()
            ax2.plot(df.index, df['battery_lead_signal'], label='Battery Lead Signal (Supply Precedence)',
                     color='#ff6600', linestyle='--', linewidth=1.5)
            ax2.set_ylabel('Battery Lead Signal', color='#ff6600')
            ax2.tick_params(axis='y', labelcolor='#ff6600')

        lines1, labels1 = ax1.get_legend_handles_labels()
        ax1.legend(lines1, labels1, loc='upper left')
        plt.title("NEXUS-SCM Titan V4 | Demand vs Battery Supply Precedence", fontweight='bold')
        trend_path = os.path.join(temp_dir, "trend_analysis.png")
        plt.savefig(trend_path, bbox_inches='tight')
        plt.close()

        # 2. Maker Market Share Stacked Area Chart
        maker_cols = [c for c in ['reg_tata', 'reg_ola', 'reg_mahindra', 'reg_tvs', 'reg_ather'] if c in df.columns]
        if maker_cols:
            fig2, ax3 = plt.subplots(figsize=(12, 5))
            df_makers = df[maker_cols].fillna(0)
            ax3.stackplot(
                df.index, [df_makers[c] for c in maker_cols],
                labels=[c.replace('reg_', '').title() for c in maker_cols],
                colors=['#0088ff', '#ff4400', '#00cc66', '#ffcc00', '#cc00ff'],
                alpha=0.8
            )
            ax3.legend(loc='upper left', fontsize=8)
            ax3.set_title("NEXUS-SCM | Maker Market Share Stacked Area (V4 Titan)", fontweight='bold')
            ax3.set_ylabel('Registration Volume')
            maker_path = os.path.join(temp_dir, "maker_share.png")
            plt.savefig(maker_path, bbox_inches='tight')
            plt.close()
        else:
            maker_path = None

        # 3. Anomaly / Industrial Inflection Risk Ranking
        plt.figure(figsize=(10, 5))
        risk_col = 'target_demand'
        if risk_col in df.columns and 'region_name' in df.columns:
            top_risk = df.groupby('region_name')[risk_col].mean().sort_values(ascending=False).head(10)
            top_risk.plot(kind='barh', color='#ff4444')
            plt.title("Regional Demand Intensity Ranking (Neuro-Core V4)")
        plt.tight_layout()
        heatmap_path = os.path.join(temp_dir, "anomaly_heatmap.png")
        plt.savefig(heatmap_path, bbox_inches='tight')
        plt.close()

        return trend_path, heatmap_path, maker_path

    def generate_executive_pdf(self, df, logs):
        """
        Synthesizes the Global Network Intelligence Dossier as a binary PDF.
        Anchored on v4_titan_intelligence_fabric data.
        """
        # Resolve region names directly from data (V4: no hardcoded H3 map)
        if 'region_name' not in df.columns:
            df['region_name'] = 'Unknown Region'

        # Generate Visualizations
        trend_img, heatmap_img, maker_img = self._generate_visualizations(df)

        # Build V4 data sample for Llama-3.3 context
        sample_cols = [c for c in [
            'region_name', 'target_demand', 'ev_penetration_rate',
            'reg_tata', 'reg_ola', 'reg_mahindra', 'reg_industrial',
            'battery_lead_signal'
        ] if c in df.columns]

        data_sample = df[sample_cols].tail(20).to_json(indent=2)

        # Battery starvation signal stats
        bat_mean = df['battery_lead_signal'].mean() if 'battery_lead_signal' in df.columns else 0
        ind_mean = df['reg_industrial'].mean() if 'reg_industrial' in df.columns else 0

        context_block = (
            f"\n\n### KEY SIGNAL STATISTICS\n"
            f"Battery Lead Signal mean: {bat_mean:.2f} "
            f"{'⚠️ BELOW CRITICAL THRESHOLD - STARVATION RISK' if bat_mean < 50 else '✅ Adequate'}\n"
            f"Industrial Demand mean: {ind_mean:.2f} registrations\n"
        )

        prompt = (
            f"{self.system_prompt}\n\n"
            f"### DATA REGISTRY (V4 TITAN)\n{data_sample}"
            f"{context_block}\n\n"
            f"### AGENTIC DECISION LOGS\n{json.dumps(logs)}\n\n"
            f"Provide the full executive analysis per the mandatory directives above."
        )

        insights = self.llm.invoke(prompt).content

        # ─── PDF ASSEMBLY ──────────────────────────────────────────────────
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("Helvetica", "B", 24)
        pdf.set_text_color(0, 51, 153)
        pdf.cell(0, 20, "NEXUS-SCM TITAN V4 SOVEREIGN DOSSIER", ln=True, align="C")

        pdf.set_font("Helvetica", "I", 10)
        pdf.set_text_color(100)
        pdf.cell(0, 10,
                 f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | "
                 f"Source: v4_titan_intelligence_fabric | RESTRICTED",
                 ln=True, align="C")

        # Section 1: Demand + Battery Signal
        pdf.ln(8)
        pdf.set_font("Helvetica", "B", 16)
        pdf.set_text_color(0)
        pdf.cell(0, 10, "1. Demand vs Battery Supply Precedence (Dual-Axis)", ln=True)
        pdf.image(trend_img, x=10, y=None, w=190)

        # Section 2: Maker Market Share
        if maker_img:
            pdf.add_page()
            pdf.set_font("Helvetica", "B", 16)
            pdf.cell(0, 10, "2. Maker Market Share Stacked Analysis", ln=True)
            pdf.image(maker_img, x=10, y=None, w=190)

        # Section 3: AI Strategic Insights (Llama-3.3)
        pdf.add_page()
        pdf.set_font("Helvetica", "B", 16)
        pdf.cell(0, 10, "3. Titan V4 AI Intelligence Synthesis", ln=True)
        pdf.ln(5)
        pdf.set_font("Helvetica", "", 10)
        pdf.multi_cell(0, 6, insights)

        # Section 4: Regional Intensity Ranking
        pdf.add_page()
        pdf.set_font("Helvetica", "B", 16)
        pdf.cell(0, 10, "4. Neuro-Core Regional Demand Profile", ln=True)
        pdf.image(heatmap_img, x=10, y=None, w=190)

        # Section 5: Regional Log
        pdf.ln(10)
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 10, "High-Signal Regional Nodes (V4 Titan):", ln=True)
        pdf.set_font("Helvetica", "", 9)

        for idx, row in df.tail(15).iterrows():
            region = row.get('region_name', 'Unknown')
            demand = row.get('target_demand', 0)
            bat = row.get('battery_lead_signal', 0)
            ind = row.get('reg_industrial', 0)
            pdf.cell(0, 6,
                     f"* {region} | Demand: {demand:.0f} | Battery: {bat:.1f} | Industrial: {ind:.0f}",
                     ln=True)

        output_path = trend_img.replace("trend_analysis.png", "dossier.pdf")
        pdf.output(output_path)

        with open(output_path, "rb") as f:
            pdf_bytes = f.read()

        return pdf_bytes
