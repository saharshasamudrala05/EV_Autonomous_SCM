"""NEXUS-SCM | Core Database Engine & Session Factory"""
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator
from backend.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,       # Reconnect on stale connections
    pool_size=20,
    max_overflow=10,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a DB session and closes it after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_all_tables() -> None:
    """Creates all database tables from SQLAlchemy models."""
    # This is needed to register models for create_all()
    from backend.models.base import Base
    import backend.models.supplier
    import backend.models.product_sku
    import backend.models.warehouse
    import backend.models.shipment
    import backend.models.demand_signal
    import backend.models.alert
    import backend.models.autonomous_decision
    import backend.models.network
    # Models are already imported above with backend. prefix
    Base.metadata.create_all(bind=engine)
    print("[OK] All tables created successfully.")


def check_connection() -> bool:
    """Returns True if the database is reachable."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        print(f"[X] DB connection failed: {e}")
        return False
