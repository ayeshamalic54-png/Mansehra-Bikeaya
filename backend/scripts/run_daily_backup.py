import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database import Base, SessionLocal, engine
from app.services.backup import (
    BACKUP_DIR,
    create_full_database_backup,
    has_todays_scheduled_pkt_backup,
    pkt_now,
    to_pkt_iso,
)


def main() -> int:
    force = "--force" in sys.argv
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        now_p = pkt_now()
        if not force and has_todays_scheduled_pkt_backup(db, now_p):
            existing = (
                sorted(BACKUP_DIR.glob("safargo-full-backup-*.json.gz"), reverse=True)[0]
                if BACKUP_DIR.exists()
                else None
            )
            if existing is not None:
                print(
                    f"[SafarGo Backup] Already completed for {now_p.strftime('%Y-%m-%d')} PKT "
                    f"(latest file: {existing.name}). Pass --force to take another snapshot."
                )
                return 0

        rec, out_path = create_full_database_backup(
            db,
            trigger_type="manual" if force else "scheduled_pkt",
            write_local_file=True,
        )
        print(
            f"[SafarGo Backup OK] {to_pkt_iso(rec.created_at)} | "
            f"Rows: {rec.total_rows} | Compressed Size: {rec.size_bytes} bytes | "
            f"File: {out_path}"
        )
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
