# NEXUS-SCM Operations & Deployment Manual (v4.2)

This guide provides the complete blueprint for running the NEXUS-SCM Agentic Supply Chain platform.

## 📦 1. Prerequisite Packages

### Python Ecosystem
```powershell
pip install pandas numpy shap scikit-learn pulp scipy sqlalchemy psycopg2-binary fastapi uvicorn httpx
```

### Frontend Ecosystem (Vite/React)
```powershell
cd nexus-ui-v2
npm install
# Core dependencies: framer-motion, lucide-react, three, @react-three/fiber
```

## 🚀 2. Standard Execution Sequence

### Step 1: Data Infrastructure
```powershell
docker-compose up -d
# Required: PostgreSQL on 5432 and Kafka on 9093
```

### Step 2: Corporate ERP Backbone (Mock)
```powershell
python nexus_erp_simulator.py
# Listen: http://localhost:8001
```

### Step 3: Sovereign Brain API (Middleware)
```powershell
python nexus_brain_api.py
# Listen: http://localhost:8000
```

### Step 4: Integrity Reconciliation Worker
```powershell
python erp_reconciliation_worker.py
# This runs in a 60-second loop auditing Postgres vs SQLite
```

### Step 5: Holographic Mission Control UI
```powershell
cd nexus-ui-v2
npm run dev
# URL: http://localhost:5173 (usually)
```

## 🧠 3. High-Quality Operational Logic

### Dual-Ledger Governance
- **Brain Database (PostgreSQL)**: Stores the INTENT and the ARCHIVE of decisions.
- **ERP Ledger (SQLite)**: Stores the ACTUAL EXECUTED financial transaction.
- **Worker Policy**: If a decision is `EXECUTED` in Brain but missing in `erp_ledger.db`, the audit fails.

### Shadow vs Live Execution
- **SHADOW_MODE = True**: Safe testing. API logs orders but does not send them to the ERP.
- **SHADOW_MODE = False**: Live execution. API sends POST requests to the ERP Simulator.

### Bullwhip & Multi-Echelon Logic
- Before the **Agentic Brain** recommends a new STO/PO, it queries the ERP for "In-Transit" quantities.
- Formula: `final_order = max(0, optimal_required_stock - in_transit_qty)`

## 🛠️ 4. Troubleshooting Support
- **Error: 10048 (Address in Use)**: You have a previous instance of the API or Simulator running. Use `taskkill /F /IM python.exe` or stop the specific terminal.
- **Audit Discrepancy**: If you approve a card in Shadow Mode, the Reconciliation Worker will flag it as a violation. Avoid this by switching to Live Mode for data consistency.
- **Empty Forecast**: Ensure the `gold_scm_features` analytic store is populated via the Phase 1 scripts.
