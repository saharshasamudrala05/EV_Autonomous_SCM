"""
NEXUS-SCM | Titan V4 SOVEREIGN HUB [REL_4.2_STABLE]
Application Entry Point - TITAN V4 SOVEREIGN ALIGNMENT
"""
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from backend.config import settings
from backend.core.database import create_all_tables, check_connection
from backend.api.routes_dashboard import router as dashboard_router
from backend.api.routes_suppliers import router as suppliers_router
from backend.api.routes_inventory import router as inventory_router
from backend.api.routes_shipments import router as shipments_router
from backend.api.routes_forecast import router as forecast_router
from backend.api.routes_risk import router as risk_router
from backend.api.routes_automation import router as automation_router
from backend.api.routes_logistics import router as logistics_router
from backend.api.routes_ingestion import router as ingestion_router
from backend.api.routes_agentic import router as agentic_router
from backend.api.routes_reports import router as reports_router
from backend.api.routes_analytics import router as analytics_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Runs on startup and shutdown."""
    print(f"\n>>> NEXUS-SCM v{settings.APP_VERSION} Starting...")
    if check_connection():
        print("[OK] PostgreSQL connected")
        create_all_tables()
        print("[OK] Digital Twin tables ready")
    else:
        print("[X] PostgreSQL not available -- check .env DATABASE_URL")
    print(f">>> API docs: http://localhost:8000/docs\n")
    yield
    print("\nNEXUS-SCM shutting down...")


# ─── Application ───────────────────────────────────────────────
app = FastAPI(
    title="NEXUS-SCM API",
    description="Autonomous AI-Driven Supply Chain Management System.",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print(f"\n[Ingestion Error] Payload validation failed for {request.url}: {exc.errors()}\n")
    return JSONResponse(
        status_code=422,
        content={"detail": "Payload validation failed", "errors": exc.errors()},
    )

# ─── CORS ──────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ───────────────────────────────────────────────────
PREFIX = settings.API_PREFIX
app.include_router(dashboard_router, prefix=PREFIX)
app.include_router(suppliers_router, prefix=PREFIX)
app.include_router(inventory_router, prefix=PREFIX)
app.include_router(shipments_router, prefix=PREFIX)
app.include_router(automation_router, prefix=PREFIX)
app.include_router(logistics_router, prefix=PREFIX)
app.include_router(ingestion_router, prefix=PREFIX)

# Intelligence & Analysis Anchors (Explicitly mapped for Nexu-UI)
app.include_router(forecast_router, prefix=PREFIX)
app.include_router(risk_router, prefix=PREFIX)
app.include_router(agentic_router, prefix=PREFIX, tags=["Agentic Brain"])
app.include_router(reports_router, prefix=PREFIX, tags=["Executive Summary"])
app.include_router(analytics_router, prefix=PREFIX)


# ─── Health Check ──────────────────────────────────────────────
@app.get("/health", tags=["System"])
def health_check():
    db_ok = check_connection()
    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "disconnected",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


@app.get("/", tags=["System"])
def root():
    return {
        "message": "NEXUS-SCM API is running",
        "docs": "/docs",
        "version": settings.APP_VERSION,
    }
