from typing import Callable, Optional
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import DATABASE_URL

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not configured. Check .env or environment variables.")

_engine_kwargs: dict = {
    "pool_pre_ping": True,
    "pool_recycle": 300,
    "pool_size": 5,
    "max_overflow": 10,
}
if DATABASE_URL.startswith("postgresql"):
    _engine_kwargs["connect_args"] = {"connect_timeout": 8}

engine = create_engine(DATABASE_URL, **_engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class DatabaseUnavailableError(RuntimeError):
    def __init__(self, status: str, detail: str):
        super().__init__(detail)
        self.status = status
        self.detail = detail


_db_init_hook: Optional[Callable[[], None]] = None


def register_db_init_hook(hook: Callable[[], None]) -> None:
    global _db_init_hook
    _db_init_hook = hook


def get_db():
    if _db_init_hook is not None:
        _db_init_hook()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
