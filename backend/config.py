"""
NEXUS-SCM | Centralized Settings
All config read from .env file via pydantic-settings.
"""
from pydantic_settings import BaseSettings
from pydantic import Field
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    # ── Application ───────────────────────────────
    APP_NAME: str = "NEXUS-SCM"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    API_PREFIX: str = "/api/v1"

    # ── Database ──────────────────────────────────
    DATABASE_URL: str = Field(
        default="postgresql://postgres:saharsha@localhost:5432/nexus_scm"
    )

    # ── Intelligence API Keys ─────────────────────
    GROQ_API_KEY: str = Field(default="")

    # ── Kafka ─────────────────────────────────────
    KAFKA_BOOTSTRAP_SERVERS: str = "localhost:9093"
    KAFKA_GROUP_ID: str = "nexus-scm-consumer"
    ENABLE_KAFKA: bool = True

    # ── Kafka Topics ──────────────────────────────
    TOPIC_DEMAND: str = "ev.demand.signals"
    TOPIC_SUPPLY: str = "ev.supply.events"
    TOPIC_SHIPMENT: str = "ev.shipment.events"
    TOPIC_PRICE: str = "ev.price.events"

    # ── Data Paths ────────────────────────────────
    DATA_DIR: str = "../"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


settings = Settings()
