import asyncio
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from app.config import CORS_ORIGINS, FRONTEND_DIST_DIR
from app.database import Base, SessionLocal, engine
from app.routers import (
    admin_router,
    auth_router,
    bookings_router,
    finance_router,
    public_router,
    reports_router,
    riders_router,
)
from app.seed import seed_initial_data
from app.services.backup import (
    BACKUP_HOUR_PKT,
    create_full_database_backup,
    has_todays_scheduled_pkt_backup,
    pkt_now,
)


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
    now_p = pkt_now()
    if now_p.hour < BACKUP_HOUR_PKT:
        return
    db = SessionLocal()
    try:
        if not has_todays_scheduled_pkt_backup(db, now_p):
            create_full_database_backup(db, trigger_type="scheduled_pkt", write_local_file=True, send_email=True)
    except Exception:
        # Background backup errors must never crash web requests.
        pass
    finally:
        db.close()


async def _daily_pkt_backup_loop() -> None:
    await asyncio.sleep(5)
    while True:
        await asyncio.to_thread(_run_scheduled_pkt_backup_if_due)
        await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_schema_migrations()
    db = SessionLocal()
    try:
        seed_initial_data(db)
    finally:
        db.close()

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


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "safargo"}


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
