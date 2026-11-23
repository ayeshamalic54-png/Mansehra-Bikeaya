import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[2]
ENV_PATH = ROOT_DIR / ".env"

if ENV_PATH.exists():
    load_dotenv(dotenv_path=ENV_PATH)

def _normalize_db_url(raw: str) -> str:
    if raw.startswith("postgres://"):
        return raw.replace("postgres://", "postgresql+psycopg2://", 1)
    if raw.startswith("postgresql://"):
        return raw.replace("postgresql://", "postgresql+psycopg2://", 1)
    return raw

DATABASE_URL: str = _normalize_db_url(os.getenv("DATABASE_URL", ""))
if not DATABASE_URL:
    db_txt = ROOT_DIR / "my db kips zulqarnan account .txt"
    if db_txt.exists():
        DATABASE_URL = _normalize_db_url(db_txt.read_text(encoding="utf-8").strip())

JWT_SECRET: str = os.getenv("JWT_SECRET", "dev-insecure-change-in-production")
JWT_ALGORITHM: str = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_HOURS", "72"))
APP_ENV: str = os.getenv("APP_ENV", "development")

_raw_cors = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000",
)
CORS_ORIGINS: list[str] = [o.strip() for o in _raw_cors.split(",") if o.strip()]

FRONTEND_DIST_DIR: Path = ROOT_DIR / "frontend" / "dist"
