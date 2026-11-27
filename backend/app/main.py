import asyncio
import logging
import os
import threading
import time
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from sqlalchemy.exc import OperationalError
from app.config import CORS_ORIGINS, FRONTEND_DIST_DIR
from app.database import Base, DatabaseUnavailableError, SessionLocal, engine, register_db_init_hook
from app.routers import (
    admin_router,
    auth_router,
    bookings_router,
    finance_router,
    public_router,
    reports_router,
    riders_router,
    sos_router,
)
from app.seed import seed_initial_data
from app.services.backup import (
    BACKUP_HOUR_PKT,
    create_full_database_backup,
    has_todays_scheduled_pkt_backup,
    pkt_now,
)

logger = logging.getLogger("safargo")

_db_init_lock = threading.Lock()
_db_state: dict = {
    "ready": False,
    "status": "initializing",
    "error": None,
    "last_attempt_ts": 0.0,
}
_LAST_SCHEDULED_BACKUP_DATE_PKT: Optional[str] = None
_DB_RETRY_COOLDOWN_SEC = 15.0


def _classify_db_error(exc: Exception) -> tuple[str, str]:
    msg = str(exc).strip()
    lower = msg.lower()
    if "quota" in lower or "exceeded" in lower:
        return (
            "quota_exceeded",
            "Live PostgreSQL database (Neon) quota exceeded. Upgrade Neon plan or update DATABASE_URL in Render Environment & restore the saved backup.",
        )
    return (
        "unavailable",
        f"Database temporarily unavailable: {msg[:180]}",
    )


def reset_db_runtime_state() -> None:
    """Allow test harnesses or recovery handlers to force re-verification of DB state."""
    _db_state["ready"] = False
    _db_state["status"] = "initializing"
    _db_state["error"] = None
    _db_state["last_attempt_ts"] = 0.0


def initialize_database_once(force: bool = False) -> bool:
    """Idempotently create tables, migrate columns, and seed initial data without crashing HTTP boot."""
    if _db_state["ready"] and not force:
        return True
    now = time.monotonic()
    if not force and _db_state["last_attempt_ts"] > 0 and (now - _db_state["last_attempt_ts"]) < _DB_RETRY_COOLDOWN_SEC:
        return False
    with _db_init_lock:
        if _db_state["ready"] and not force:
            return True
        now_locked = time.monotonic()
        if (
            not force
            and _db_state["last_attempt_ts"] > 0
            and (now_locked - _db_state["last_attempt_ts"]) < _DB_RETRY_COOLDOWN_SEC
        ):
            return False
        _db_state["last_attempt_ts"] = now_locked
        try:
            Base.metadata.create_all(bind=engine)
            ensure_schema_migrations()
            db = SessionLocal()
            try:
                seed_initial_data(db)
            finally:
                db.close()
            _db_state["ready"] = True
            _db_state["status"] = "connected"
            _db_state["error"] = None
            return True
        except Exception as exc:
            status_code, clean_msg = _classify_db_error(exc)
            _db_state["ready"] = False
            _db_state["status"] = status_code
            _db_state["error"] = clean_msg
            logger.warning("Database initialization deferred (%s): %s", status_code, clean_msg)
            return False


def _ensure_db_ready_or_raise() -> None:
    if not initialize_database_once(force=False):
        raise DatabaseUnavailableError(
            status=str(_db_state.get("status") or "unavailable"),
            detail=str(_db_state.get("error") or "Database temporarily unavailable."),
        )


register_db_init_hook(_ensure_db_ready_or_raise)


def ensure_schema_migrations() -> None:
    """Add newly introduced columns idempotently on existing SQLite/PostgreSQL databases."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    is_pg = engine.dialect.name == "postgresql"
    ts_type = "TIMESTAMPTZ" if is_pg else "DATETIME"
    column_specs = {
        "rider_profiles": [
            ("vehicle_type", "VARCHAR(20) NOT NULL DEFAULT 'bike'"),
            ("current_lat", "FLOAT"),
            ("current_lng", "FLOAT"),
            ("location_updated_at", ts_type),
            ("rider_photo", "TEXT"),
            ("vehicle_photo", "TEXT"),
            ("cnic_front_photo", "TEXT"),
            ("cnic_back_photo", "TEXT"),
            ("verification_status", "VARCHAR(24) NOT NULL DEFAULT 'pending'"),
            ("verification_note", "VARCHAR(255)"),
            ("docs_submitted_at", ts_type),
            ("topup_wallet_balance", "FLOAT NOT NULL DEFAULT 0.0"),
            ("remaining_paid_rides", "INTEGER NOT NULL DEFAULT 0"),
            ("topup_per_ride_fee", "FLOAT NOT NULL DEFAULT 10.0"),
            ("total_topups_paid", "FLOAT NOT NULL DEFAULT 0.0"),
        ],
        "mansehra_zones": [
            ("lat", "FLOAT"),
            ("lng", "FLOAT"),
        ],
        "pricing_rules": [
            ("city_flat_km", "FLOAT NOT NULL DEFAULT 0.0"),
            ("city_flat_fare", "FLOAT NOT NULL DEFAULT 0.0"),
            ("wait_free_minutes", "INTEGER NOT NULL DEFAULT 5"),
            ("wait_charge_per_min", "FLOAT NOT NULL DEFAULT 10.0"),
        ],
        "bookings": [
            ("pickup_lat", "FLOAT"),
            ("pickup_lng", "FLOAT"),
            ("drop_lat", "FLOAT"),
            ("drop_lng", "FLOAT"),
            ("recommended_fare", "FLOAT"),
            ("wait_minutes", "INTEGER NOT NULL DEFAULT 0"),
            ("wait_charge", "FLOAT NOT NULL DEFAULT 0.0"),
            ("arrived_at", ts_type),
            ("payment_status", "VARCHAR(24) NOT NULL DEFAULT 'pending'"),
            ("payment_reference", "VARCHAR(80)"),
        ],
        "database_backups": [
            ("emailed_to", "VARCHAR(180)"),
            ("email_status", "VARCHAR(32) NOT NULL DEFAULT 'pending'"),
            ("email_error", "VARCHAR(255)"),
        ],
    }
    with engine.begin() as conn:
        for table_name, cols in column_specs.items():
            if table_name not in tables:
                continue
            existing = {c["name"] for c in inspector.get_columns(table_name)}
            for col_name, col_def in cols:
                if col_name not in existing:
                    conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_def}"))
        if "bookings" in tables:
            conn.execute(
                text(
                    "UPDATE bookings SET payment_status = 'paid' "
                    "WHERE status = 'completed' AND payment_status = 'pending' AND payment_collector = 'rider'"
                )
            )
        if "rider_profiles" in tables:
            conn.execute(
                text(
                    "UPDATE rider_profiles SET verification_status = 'verified' "
                    "WHERE is_verified = TRUE AND verification_status != 'verified'"
                )
            )


def _run_scheduled_pkt_backup_if_due() -> None:
    global _LAST_SCHEDULED_BACKUP_DATE_PKT
    if not _db_state["ready"]:
        return
    now_p = pkt_now()
    today_pkt = now_p.strftime("%Y-%m-%d")
    if now_p.hour < BACKUP_HOUR_PKT or _LAST_SCHEDULED_BACKUP_DATE_PKT == today_pkt:
        return
    db = SessionLocal()
    try:
        if has_todays_scheduled_pkt_backup(db, now_p):
            _LAST_SCHEDULED_BACKUP_DATE_PKT = today_pkt
            return
        create_full_database_backup(db, trigger_type="scheduled_pkt", write_local_file=True, send_email=True)
        _LAST_SCHEDULED_BACKUP_DATE_PKT = today_pkt
    except Exception:
        # Background backup errors must never crash web requests or keep Neon awake.
        pass
    finally:
        db.close()


async def _daily_pkt_backup_loop() -> None:
    await asyncio.sleep(15)
    while True:
        await asyncio.to_thread(_run_scheduled_pkt_backup_if_due)
        # Sleep 15 minutes and avoid waking serverless Postgres after today's backup is done.
        await asyncio.sleep(900)


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database_once(force=True)

    backup_task = None
    if not os.getenv("PYTEST_CURRENT_TEST"):
        backup_task = asyncio.create_task(_daily_pkt_backup_loop())
    try:
        yield
    finally:
        if backup_task is not None:
            backup_task.cancel()
            try:
                await backup_task
            except asyncio.CancelledError:
                pass


app = FastAPI(
    title="SafarGo API",
    description="Multi-City Bike Rides, Cars, Parcel Delivery, Rider Settlement & Owner Profit System",
    version="1.0.0",
    lifespan=lifespan,
)


@app.exception_handler(DatabaseUnavailableError)
async def handle_db_unavailable_error(_request, exc: DatabaseUnavailableError):
    return JSONResponse(
        status_code=503,
        content={
            "detail": exc.detail,
            "code": f"db_{exc.status}",
            "database": exc.status,
        },
    )


@app.exception_handler(OperationalError)
async def handle_db_operational_error(_request, exc: OperationalError):
    status_code, clean_msg = _classify_db_error(exc)
    _db_state["ready"] = False
    _db_state["status"] = status_code
    _db_state["error"] = clean_msg
    return JSONResponse(
        status_code=503,
        content={
            "detail": clean_msg,
            "code": f"db_{status_code}",
            "database": status_code,
        },
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(public_router.router)
app.include_router(bookings_router.router)
app.include_router(riders_router.router)
app.include_router(admin_router.router)
app.include_router(finance_router.router)
app.include_router(reports_router.router)
app.include_router(sos_router.router)


@app.api_route("/api/health", methods=["GET", "HEAD"])
def health_check(verify_db: bool = Query(default=False)):
    if verify_db or not _db_state["ready"]:
        if verify_db:
            initialize_database_once(force=True)
    return {
        "status": "ok",
        "service": "safargo",
        "database": _db_state["status"],
        "database_ready": bool(_db_state["ready"]),
        "database_error": _db_state["error"],
    }


# Serve built React SPA when frontend/dist exists (used in local prod preview & Render)
if FRONTEND_DIST_DIR.exists():
    assets_dir = FRONTEND_DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path == "api":
            raise HTTPException(status_code=404, detail="API endpoint not found")
        dist_root = FRONTEND_DIST_DIR.resolve()
        candidate = (dist_root / full_path).resolve()
        if full_path and candidate.is_relative_to(dist_root) and candidate.is_file():
            return FileResponse(str(candidate))
        return FileResponse(str(dist_root / "index.html"))
