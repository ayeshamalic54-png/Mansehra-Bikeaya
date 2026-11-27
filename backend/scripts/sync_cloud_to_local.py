import gzip
import hashlib
import json
import os
import socket
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

load_dotenv(dotenv_path=ROOT_DIR / ".env")

PG_ROOT = Path(r"C:\SafarGoDB")
PG_BIN = PG_ROOT / "pgsql" / "bin"
PG_DATA = PG_ROOT / "pgdata"
PG_LOG = PG_ROOT / "logs" / "postgres.log"
LOCAL_BACKUP_DIR = PG_ROOT / "backups"
WATERMARK_FILE = PG_ROOT / "last_cloud_watermark.json"
SYNC_LOG_FILE = PG_ROOT / "logs" / "sync.log"

DEFAULT_LOCAL_DB = "postgresql+psycopg2://safargo_user:SafarGoLocal2026!@127.0.0.1:5432/safargo"


def _norm_pg(url: str) -> str:
    raw = (url or "").strip()
    if raw.startswith("postgres://"):
        return raw.replace("postgres://", "postgresql+psycopg2://", 1)
    if raw.startswith("postgresql://"):
        return raw.replace("postgresql://", "postgresql+psycopg2://", 1)
    return raw


def _log(msg: str) -> None:
    SYNC_LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    line = f"[{ts}] {msg}"
    print(line)
    with SYNC_LOG_FILE.open("a", encoding="utf-8") as fh:
        fh.write(line + "\n")


def _port_open(host: str = "127.0.0.1", port: int = 5432) -> bool:
    try:
        with socket.create_connection((host, port), timeout=1.5):
            return True
    except OSError:
        return False


def ensure_local_postgres_running() -> None:
    if _port_open("127.0.0.1", 5432):
        return
    pg_ctl = PG_BIN / "pg_ctl.exe"
    if not pg_ctl.exists() or not PG_DATA.exists():
        raise RuntimeError(f"Local PostgreSQL not initialized at {PG_DATA}")
    PG_LOG.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [str(pg_ctl), "-D", str(PG_DATA), "-l", str(PG_LOG), "-w", "start"],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    for _ in range(15):
        if _port_open("127.0.0.1", 5432):
            return
        time.sleep(0.5)
    raise RuntimeError("Local PostgreSQL did not listen on 127.0.0.1:5432 after pg_ctl start")


def _compute_cloud_watermark(cloud_db) -> dict:
    checks = {
        "users": "SELECT COUNT(*), COALESCE(MAX(id), 0) FROM users",
        "rider_profiles": (
            "SELECT COUNT(*), COALESCE(MAX(id), 0), COALESCE(SUM(remaining_paid_rides), 0), "
            "SUM(CASE WHEN is_verified THEN 1 ELSE 0 END), "
            "COALESCE(MAX(location_updated_at)::text, '') FROM rider_profiles"
        ),
        "bookings": (
            "SELECT COUNT(*), COALESCE(MAX(id), 0), "
            "SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), "
            "COALESCE(SUM(final_fare), 0) FROM bookings"
        ),
        "ride_offers": "SELECT COUNT(*), COALESCE(MAX(id), 0), COALESCE(SUM(offered_fare), 0) FROM ride_offers",
        "rider_topup_requests": (
            "SELECT COUNT(*), COALESCE(MAX(id), 0), "
            "SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) FROM rider_topup_requests"
        ),
        "ledger_entries": "SELECT COUNT(*), COALESCE(MAX(id), 0) FROM ledger_entries",
        "support_tickets": "SELECT COUNT(*), COALESCE(MAX(id), 0), COALESCE(MAX(updated_at)::text, '') FROM support_tickets",
        "admin_expenses": "SELECT COUNT(*), COALESCE(MAX(id), 0) FROM admin_expenses",
        "sos_alerts": "SELECT COUNT(*), COALESCE(MAX(id), 0) FROM sos_alerts",
        "system_settings": "SELECT COUNT(*), COALESCE(MAX(updated_at)::text, '') FROM system_settings",
        "pricing_rules": "SELECT COUNT(*), COALESCE(MAX(updated_at)::text, '') FROM pricing_rules",
    }
    mark = {}
    for tbl, sql in checks.items():
        try:
            row = cloud_db.execute(text(sql)).fetchone()
            mark[tbl] = list(row) if row else [0]
        except Exception:
            mark[tbl] = ["err"]
    return mark


def main() -> int:
    force = "--force" in sys.argv
    cloud_url = _norm_pg(os.getenv("CLOUD_DATABASE_URL", ""))
    local_url = _norm_pg(os.getenv("LOCAL_DATABASE_URL", DEFAULT_LOCAL_DB))

    if not cloud_url or cloud_url == local_url:
        _log("Skipped sync: CLOUD_DATABASE_URL is not configured separately.")
        return 0

    ensure_local_postgres_running()

    cloud_engine = create_engine(cloud_url, pool_pre_ping=True, connect_args={"connect_timeout": 10})
    CloudSession = sessionmaker(autocommit=False, autoflush=False, bind=cloud_engine)

    # Set temporary DATABASE_URL check safely: we only import app.database after check if needed,
    # or ensure DATABASE_URL in os.environ works cleanly when importing models/backup.
    os.environ.setdefault("DATABASE_URL", local_url)
    from app.database import Base
    from app.services.backup import (
        BACKUP_DIR,
        _coerce_column_value,
        _json_default,
        export_full_database_payload,
        pkt_now,
    )

    cloud_db = CloudSession()
    try:
        mark = _compute_cloud_watermark(cloud_db)
        prev_mark = {}
        if WATERMARK_FILE.exists():
            try:
                prev_mark = json.loads(WATERMARK_FILE.read_text(encoding="utf-8"))
            except Exception:
                prev_mark = {}

        if not force and mark == prev_mark:
            _log("Cloud DB unchanged since last sync — skipped full download (0 KB egress).")
            return 0

        payload, row_counts = export_full_database_payload(cloud_db)
    finally:
        cloud_db.close()
        cloud_engine.dispose()

    raw_json = json.dumps(payload, default=_json_default, ensure_ascii=False).encode("utf-8")
    gz_bytes = gzip.compress(raw_json, compresslevel=9)
    digest = hashlib.sha256(gz_bytes).hexdigest()

    now_p = pkt_now()
    stamp = now_p.strftime("%Y%m%d-%H%M%S")
    LOCAL_BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    mirror_file = LOCAL_BACKUP_DIR / f"safargo-cloud-sync-{stamp}-PKT.json.gz"
    mirror_file.write_bytes(gz_bytes)

    # Prune old mirror files beyond latest 30
    old_mirrors = sorted(LOCAL_BACKUP_DIR.glob("safargo-cloud-sync-*.json.gz"), reverse=True)
    for f in old_mirrors[30:]:
        f.unlink(missing_ok=True)

    # Also update a single stable latest archive in repo backups/
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    (BACKUP_DIR / "safargo-latest-cloud-sync-PKT.json.gz").write_bytes(gz_bytes)

    local_engine = create_engine(local_url, pool_pre_ping=True, connect_args={"connect_timeout": 8})
    Base.metadata.create_all(bind=local_engine)
    LocalSession = sessionmaker(autocommit=False, autoflush=False, bind=local_engine)
    local_db = LocalSession()
    try:
        tables_data = payload.get("tables") or {}
        ordered_tables = [t for t in Base.metadata.sorted_tables if t.name != "database_backups"]
        for table in reversed(ordered_tables):
            local_db.execute(table.delete())
        for table in ordered_tables:
            raw_rows = tables_data.get(table.name) or []
            if not raw_rows:
                continue
            col_map = {c.name: c for c in table.columns}
            clean_rows = []
            for row in raw_rows:
                item = {k: _coerce_column_value(col_map[k], v) for k, v in row.items() if k in col_map}
                if item:
                    clean_rows.append(item)
            if clean_rows:
                local_db.execute(table.insert(), clean_rows)
        for table in ordered_tables:
            if "id" in table.c:
                local_db.execute(
                    text(
                        f"SELECT setval(pg_get_serial_sequence('{table.name}', 'id'), "
                        f"COALESCE((SELECT MAX(id) FROM {table.name}), 1), true)"
                    )
                )
        local_db.commit()
    except Exception:
        local_db.rollback()
        raise
    finally:
        local_db.close()
        local_engine.dispose()

    WATERMARK_FILE.write_text(json.dumps(mark, ensure_ascii=False, indent=2), encoding="utf-8")
    _log(
        f"Synced OK | rows={payload.get('total_rows')} | gz={len(gz_bytes)}B | "
        f"sha256={digest[:12]} | file={mirror_file.name}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
