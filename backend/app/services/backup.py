import base64
import gzip
import hashlib
import json
import os
import smtplib
import socket
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from email.message import EmailMessage
from pathlib import Path
from typing import Optional
import httpx
from sqlalchemy import Date, DateTime, text
from sqlalchemy.orm import Session
from app.config import ROOT_DIR
from app.database import Base
from app.models import DatabaseBackup, SystemSetting

PKT_TZ = timezone(timedelta(hours=5), name="PKT")
BACKUP_HOUR_PKT = 4  # 04:00 AM Pakistan Standard Time (off-peak daily window)
BACKUP_DIR = ROOT_DIR / "backups"
DEFAULT_BACKUP_EMAIL = "gosafar4@gmail.com"


def pkt_now() -> datetime:
    return datetime.now(PKT_TZ)


def to_pkt_iso(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    aware = dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    return aware.astimezone(PKT_TZ).strftime("%Y-%m-%d %I:%M:%S %p PKT")


def _json_default(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, bytes):
        return base64.b64encode(obj).decode("ascii")
    return str(obj)


def _get_setting(db: Session, key: str, default: str = "") -> str:
    row = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    return (row.value or "").strip() if row and row.value else default


def resolve_backup_email_config(db: Session) -> dict:
    recipient = (
        os.getenv("BACKUP_EMAIL_TO")
        or _get_setting(db, "backup_email", DEFAULT_BACKUP_EMAIL)
        or DEFAULT_BACKUP_EMAIL
    ).strip()
    webhook_url = (os.getenv("BACKUP_WEBHOOK_URL") or _get_setting(db, "backup_webhook_url", "")).strip()
    resend_key = (os.getenv("RESEND_API_KEY") or _get_setting(db, "backup_resend_key", "")).strip()
    smtp_host = (os.getenv("SMTP_HOST") or _get_setting(db, "backup_smtp_host", "smtp.gmail.com")).strip()
    smtp_port = int((os.getenv("SMTP_PORT") or _get_setting(db, "backup_smtp_port", "465")).strip() or "465")
    smtp_user = (os.getenv("SMTP_USER") or _get_setting(db, "backup_smtp_user", recipient) or recipient).strip()
    raw_pass = os.getenv("SMTP_PASS") or _get_setting(db, "backup_smtp_pass", "")
    smtp_pass = "".join(raw_pass.split())
    return {
        "recipient": recipient,
        "webhook_url": webhook_url,
        "resend_key": resend_key,
        "smtp_host": smtp_host,
        "smtp_port": smtp_port,
        "smtp_user": smtp_user,
        "smtp_pass": smtp_pass,
        "smtp_configured": bool(recipient and smtp_user and smtp_pass),
        "https_relay_configured": bool(webhook_url or resend_key),
        "email_configured": bool(webhook_url or resend_key or (recipient and smtp_user and smtp_pass)),
    }


def _resolve_ipv4_host(hostname: str, port: int) -> str:
    """Resolve IPv4 address explicitly so hosts without IPv6 routing avoid [Errno 101]."""
    try:
        infos = socket.getaddrinfo(hostname, port, socket.AF_INET, socket.SOCK_STREAM)
        if infos:
            return infos[0][4][0]
    except OSError:
        pass
    return hostname


def send_backup_email(db: Session, rec: DatabaseBackup, gz_bytes: bytes) -> tuple[str, str, Optional[str]]:
    cfg = resolve_backup_email_config(db)
    recipient = cfg["recipient"]
    if os.getenv("PYTEST_CURRENT_TEST"):
        return "skipped", recipient, "Skipped external email send during automated tests"

    subject = (
        f"[SafarGo Backup] {rec.backup_date_pkt} ({rec.trigger_type}) — "
        f"{rec.total_rows} rows ({round(rec.size_bytes / 1024.0, 1)} KB)"
    )
    body_text = (
        f"SafarGo Full Database Backup Summary\n"
        f"----------------------------------\n"
        f"Time (PKT): {to_pkt_iso(rec.created_at) or rec.backup_date_pkt}\n"
        f"Schedule: Daily 04:00 AM Pakistan Time (PKT, UTC+5)\n"
        f"Trigger: {rec.trigger_type}\n"
        f"Total Rows: {rec.total_rows}\n"
        f"File: {rec.file_name} ({round(rec.size_bytes / 1024.0, 2)} KB)\n"
        f"SHA-256: {rec.sha256}\n"
        f"Local App Directory Copy: {BACKUP_DIR / rec.file_name}\n\n"
        f"The compressed full database JSON archive is attached to this email.\n"
    )
    b64_data = base64.b64encode(gz_bytes).decode("ascii")

    # 1. Preferred on Render/Cloud: HTTPS port 443 Google Apps Script Gmail Relay Webhook
    if cfg["webhook_url"]:
        try:
            r = httpx.post(
                cfg["webhook_url"],
                json={
                    "to": recipient,
                    "subject": subject,
                    "body": body_text,
                    "filename": rec.file_name,
                    "mimeType": "application/gzip",
                    "contentBase64": b64_data,
                },
                timeout=30.0,
                follow_redirects=True,
            )
            if 200 <= r.status_code < 300:
                return "sent", recipient, None
            return "failed", recipient, f"Webhook HTTP {r.status_code}: {r.text[:160]}"
        except Exception as exc:
            return "failed", recipient, f"HTTPS Webhook failed: {str(exc)[:180]}"

    # 2. Alternative HTTPS Port 443: Resend Email API
    if cfg["resend_key"]:
        try:
            r = httpx.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {cfg['resend_key']}"},
                json={
                    "from": "SafarGo Backups <onboarding@resend.dev>",
                    "to": [recipient],
                    "subject": subject,
                    "text": body_text,
                    "attachments": [{"filename": rec.file_name, "content": b64_data}],
                },
                timeout=30.0,
            )
            if 200 <= r.status_code < 300:
                return "sent", recipient, None
            return "failed", recipient, f"Resend HTTP {r.status_code}: {r.text[:160]}"
        except Exception as exc:
            return "failed", recipient, f"Resend API failed: {str(exc)[:180]}"

    # 3. Direct SMTP fallback (works on local Windows PC / VPS; Render Free blocks SMTP 465/587)
    if not cfg["smtp_configured"]:
        return (
            "smtp_not_configured",
            recipient,
            "Configure HTTPS Gmail Script URL / Resend Key (for Render) or Gmail App Password (for local PC).",
        )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"SafarGo Backups <{cfg['smtp_user']}>"
    msg["To"] = recipient
    msg.set_content(body_text)
    msg.add_attachment(gz_bytes, maintype="application", subtype="gzip", filename=rec.file_name)

    try:
        host = cfg["smtp_host"]
        port = cfg["smtp_port"]
        # Connect using IPv4 if DNS returns unreachable IPv6, while preserving SNI hostname for TLS
        ipv4_host = _resolve_ipv4_host(host, port)
        try:
            if port == 465:
                with smtplib.SMTP_SSL(host, port, timeout=20) as server:
                    server.login(cfg["smtp_user"], cfg["smtp_pass"])
                    server.send_message(msg)
            else:
                with smtplib.SMTP(host, port, timeout=20) as server:
                    server.starttls()
                    server.login(cfg["smtp_user"], cfg["smtp_pass"])
                    server.send_message(msg)
            return "sent", recipient, None
        except OSError as net_err:
            if ipv4_host != host:
                if port == 465:
                    with smtplib.SMTP_SSL(ipv4_host, port, timeout=20) as server:
                        server.login(cfg["smtp_user"], cfg["smtp_pass"])
                        server.send_message(msg)
                else:
                    with smtplib.SMTP(ipv4_host, port, timeout=20) as server:
                        server.starttls()
                        server.login(cfg["smtp_user"], cfg["smtp_pass"])
                        server.send_message(msg)
                return "sent", recipient, None
            raise net_err
    except OSError as exc:
        if getattr(exc, "errno", None) in (101, 110, 111) or "unreachable" in str(exc).lower():
            return (
                "failed",
                recipient,
                f"Cloud host blocks SMTP port {cfg['smtp_port']} ({exc}). Paste a free HTTPS Gmail Script URL or Resend Key below to send from Render, OR run from local Windows 4 AM scheduler.",
            )
        return "failed", recipient, str(exc)[:240]
    except Exception as exc:
        return "failed", recipient, str(exc)[:240]


def export_full_database_payload(db: Session) -> tuple[dict, dict[str, int]]:
    """Serialize all application tables in foreign-key dependency order."""
    tables_dump: dict[str, list[dict]] = {}
    row_counts: dict[str, int] = {}

    bind = db.get_bind()
    for table in Base.metadata.sorted_tables:
        if table.name == "database_backups":
            continue
        rows = db.execute(table.select()).mappings().all()
        serial_rows = [dict(r) for r in rows]
        tables_dump[table.name] = serial_rows
        row_counts[table.name] = len(serial_rows)

    now_p = pkt_now()
    payload = {
        "service": "SafarGo",
        "format_version": "1.0",
        "timezone": "Asia/Karachi (PKT, UTC+5)",
        "scheduled_time_pkt": f"{BACKUP_HOUR_PKT:02d}:00 AM PKT",
        "dialect": bind.dialect.name if bind is not None else "unknown",
        "created_at_pkt": now_p.isoformat(),
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "row_counts": row_counts,
        "total_rows": sum(row_counts.values()),
        "tables": tables_dump,
    }
    return payload, row_counts


def create_full_database_backup(
    db: Session,
    trigger_type: str = "manual",
    write_local_file: bool = True,
    send_email: bool = True,
    keep_db_blobs: int = 7,
    keep_local_files: int = 30,
) -> tuple[DatabaseBackup, Optional[Path]]:
    """Save compressed full-DB backup to App Directory backups/, DB table, and email recipient simultaneously."""
    now_p = pkt_now()
    date_pkt = now_p.strftime("%Y-%m-%d")
    stamp_pkt = now_p.strftime("%Y%m%d-%H%M%S")
    file_name = f"safargo-full-backup-{stamp_pkt}-PKT.json.gz"

    payload, row_counts = export_full_database_payload(db)
    raw_json = json.dumps(payload, default=_json_default, ensure_ascii=False).encode("utf-8")
    gz_bytes = gzip.compress(raw_json, compresslevel=9)
    digest = hashlib.sha256(gz_bytes).hexdigest()
    gz_b64 = base64.b64encode(gz_bytes).decode("ascii")

    out_path: Optional[Path] = None
    if write_local_file:
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        out_path = BACKUP_DIR / file_name
        out_path.write_bytes(gz_bytes)
        meta_path = BACKUP_DIR / f"safargo-full-backup-{stamp_pkt}-PKT.meta.json"
        meta_path.write_text(
            json.dumps(
                {
                    "file_name": file_name,
                    "backup_date_pkt": date_pkt,
                    "created_at_pkt": to_pkt_iso(now_p),
                    "trigger_type": trigger_type,
                    "total_rows": sum(row_counts.values()),
                    "row_counts": row_counts,
                    "size_bytes": len(gz_bytes),
                    "sha256": digest,
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        gz_files = sorted(BACKUP_DIR.glob("safargo-full-backup-*.json.gz"), reverse=True)
        for stale in gz_files[keep_local_files:]:
            stale.unlink(missing_ok=True)
            stale_meta = stale.with_name(stale.name.replace(".json.gz", ".meta.json"))
            stale_meta.unlink(missing_ok=True)

    rec = DatabaseBackup(
        backup_date_pkt=date_pkt,
        file_name=file_name,
        trigger_type=trigger_type,
        status="completed",
        total_rows=sum(row_counts.values()),
        row_counts_json=json.dumps(row_counts),
        size_bytes=len(gz_bytes),
        sha256=digest,
        email_status="local_only" if not send_email else "pending",
        payload_gz_b64=gz_b64,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)

    if send_email:
        e_status, e_to, e_err = send_backup_email(db, rec, gz_bytes)
        rec.email_status = e_status
        rec.emailed_to = e_to
        rec.email_error = e_err
        db.commit()
        db.refresh(rec)

    all_with_blob = (
        db.query(DatabaseBackup)
        .filter(DatabaseBackup.payload_gz_b64.isnot(None))
        .order_by(DatabaseBackup.id.desc())
        .all()
    )
    for stale_rec in all_with_blob[keep_db_blobs:]:
        stale_rec.payload_gz_b64 = None
    if len(all_with_blob) > keep_db_blobs:
        db.commit()

    return rec, out_path


def retry_send_backup_email(db: Session, rec: DatabaseBackup) -> DatabaseBackup:
    gz_bytes = get_backup_gz_bytes(rec)
    if not gz_bytes:
        raise ValueError("Compressed backup payload is no longer available for re-send")
    e_status, e_to, e_err = send_backup_email(db, rec, gz_bytes)
    rec.email_status = e_status
    rec.emailed_to = e_to
    rec.email_error = e_err
    db.commit()
    db.refresh(rec)
    return rec


def has_todays_scheduled_pkt_backup(db: Session, now_p: Optional[datetime] = None) -> bool:
    cur = now_p or pkt_now()
    date_pkt = cur.strftime("%Y-%m-%d")
    exists = (
        db.query(DatabaseBackup.id)
        .filter(
            DatabaseBackup.backup_date_pkt == date_pkt,
            DatabaseBackup.trigger_type == "scheduled_pkt",
            DatabaseBackup.status == "completed",
        )
        .first()
    )
    return exists is not None


def serialize_backup_summary(rec: DatabaseBackup) -> dict:
    try:
        counts = json.loads(rec.row_counts_json or "{}")
    except json.JSONDecodeError:
        counts = {}
    email_status = rec.email_status
    if rec.trigger_type == "pre_restore" and email_status == "pending":
        email_status = "local_only"
    return {
        "id": rec.id,
        "backup_date_pkt": rec.backup_date_pkt,
        "file_name": rec.file_name,
        "trigger_type": rec.trigger_type,
        "status": rec.status,
        "total_rows": rec.total_rows,
        "row_counts": counts,
        "size_bytes": rec.size_bytes,
        "size_kb": round(rec.size_bytes / 1024.0, 2),
        "sha256": rec.sha256,
        "emailed_to": rec.emailed_to,
        "email_status": email_status,
        "email_error": rec.email_error,
        "has_download": bool(rec.payload_gz_b64 or (BACKUP_DIR / rec.file_name).exists()),
        "local_path": str(BACKUP_DIR / rec.file_name) if (BACKUP_DIR / rec.file_name).exists() else None,
        "created_at": rec.created_at,
        "created_at_pkt": to_pkt_iso(rec.created_at),
    }


def get_backup_gz_bytes(rec: DatabaseBackup) -> Optional[bytes]:
    if rec.payload_gz_b64:
        return base64.b64decode(rec.payload_gz_b64.encode("ascii"))
    local_file = BACKUP_DIR / rec.file_name
    if local_file.exists():
        return local_file.read_bytes()
    return None


def parse_backup_bytes(raw_bytes: bytes) -> dict:
    """Parse uploaded or stored .json.gz / .json SafarGo backup bytes safely."""
    if raw_bytes[:2] == b"\x1f\x8b":
        raw_bytes = gzip.decompress(raw_bytes)
    payload = json.loads(raw_bytes.decode("utf-8"))
    if not isinstance(payload, dict) or payload.get("service") != "SafarGo" or not isinstance(payload.get("tables"), dict):
        raise ValueError("Invalid SafarGo backup archive format.")
    users_rows = payload["tables"].get("users")
    if not isinstance(users_rows, list) or len(users_rows) == 0:
        raise ValueError("Backup contains no users table data — restore aborted.")
    return payload


def _coerce_column_value(col, val):
    if val is None:
        return None
    if isinstance(col.type, DateTime) and isinstance(val, str):
        parsed = datetime.fromisoformat(val)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    if isinstance(col.type, Date) and not isinstance(col.type, DateTime) and isinstance(val, str):
        return date.fromisoformat(val[:10])
    return val


def restore_database_from_payload(db: Session, payload: dict) -> dict:
    """Safely restore full database tables from parsed SafarGo backup payload."""
    tables_data: dict = payload.get("tables") or {}
    safety_rec, _ = create_full_database_backup(
        db,
        trigger_type="pre_restore",
        write_local_file=True,
        send_email=False,
    )

    ordered_tables = [t for t in Base.metadata.sorted_tables if t.name != "database_backups"]
    restored_counts: dict[str, int] = {}

    try:
        for table in reversed(ordered_tables):
            db.execute(table.delete())

        for table in ordered_tables:
            raw_rows = tables_data.get(table.name) or []
            if not raw_rows:
                restored_counts[table.name] = 0
                continue
            col_map = {c.name: c for c in table.columns}
            clean_rows = []
            for row in raw_rows:
                item = {}
                for k, v in row.items():
                    if k in col_map:
                        item[k] = _coerce_column_value(col_map[k], v)
                if item:
                    clean_rows.append(item)
            if clean_rows:
                db.execute(table.insert(), clean_rows)
            restored_counts[table.name] = len(clean_rows)

        bind = db.get_bind()
        if bind is not None and bind.dialect.name == "postgresql":
            for table in ordered_tables:
                if "id" in table.c:
                    db.execute(
                        text(
                            f"SELECT setval(pg_get_serial_sequence('{table.name}', 'id'), "
                            f"COALESCE((SELECT MAX(id) FROM {table.name}), 1), true)"
                        )
                    )

        # Ensure emergency helpline keys exist when restoring older backups
        emergency_defaults = [
            ("emergency_rescue_number", "1122"),
            ("emergency_police_number", "15"),
        ]
        for key, val in emergency_defaults:
            if not db.query(SystemSetting).filter(SystemSetting.key == key).first():
                db.add(SystemSetting(key=key, value=val))

        db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "status": "restored",
        "source_backup_pkt": payload.get("created_at_pkt") or "",
        "safety_backup_id": safety_rec.id,
        "safety_backup_file": safety_rec.file_name,
        "safety_backup_status": safety_rec.email_status,
        "total_restored_rows": sum(restored_counts.values()),
        "restored_counts": restored_counts,
        "restored_at_pkt": to_pkt_iso(pkt_now()),
    }
