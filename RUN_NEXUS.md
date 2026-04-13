# NEXUS-SCM Execution Guide (Phase 3)

Follow these steps to start the full Agentic Supply Chain platform.

## 1. Database & Infrastructure
Ensure PostgreSQL is active. If using Docker:
```powershell
docker-compose up -d
```

## 2. Start the Sovereign Brain API (Unified Backend)
Open a new terminal and run the unified orchestrator:
```powershell
# Run from the project root
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
*   **API URL**: `http://localhost:8000`
*   **Integrated Services**: This command automatically boots the **ERP Simulator (8001)** and the **Integrity Auditor** in the background.

## 3. Start the Holographic UI (Frontend)
Open another terminal, navigate to the UI directory, and start the Vite development server:
```powershell
cd nexus-ui-v2
npm run dev
```
*   **UI URL**: `http://localhost:5173`

## 4. Triggering the Reasoning Loop
Once the UI is open:
1.  Navigate to the **Agentic Hub** via the sidebar.
2.  Click **"INITIATE SENSE-PLAN-ACT"** to run the global demand sensing and risk simulation.
3.  Audit the generated **Decision Cards** and approve actions natively.

---
**Core Files**:
- `agentic_brain.py`: The analytical engine (Sensing/Simulation/Optimization).
- `nexus_brain_api.py`: The FastAPI server.
- `nexus-ui-v2/src/App.jsx`: The holographic interface.
