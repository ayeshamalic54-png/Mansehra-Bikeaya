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


def ensure_schema_migrations() -> None:
    """Add newly introduced columns idempotently on existing SQLite/PostgreSQL databases."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    is_pg = engine.dialect.name == "postgresql"
    ts_type = "TIMESTAMPTZ" if is_pg else "DATETIME"
    column_specs = {
        "pricing_rules": [
            ("city_flat_km", "FLOAT NOT NULL DEFAULT 0.0"),
            ("city_flat_fare", "FLOAT NOT NULL DEFAULT 0.0"),
            ("wait_free_minutes", "INTEGER NOT NULL DEFAULT 5"),
            ("wait_charge_per_min", "FLOAT NOT NULL DEFAULT 10.0"),
        ],
        "bookings": [
            ("wait_minutes", "INTEGER NOT NULL DEFAULT 0"),
            ("wait_charge", "FLOAT NOT NULL DEFAULT 0.0"),
            ("arrived_at", ts_type),
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_schema_migrations()
    db = SessionLocal()
    try:
        seed_initial_data(db)
    finally:
        db.close()
    yield


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
