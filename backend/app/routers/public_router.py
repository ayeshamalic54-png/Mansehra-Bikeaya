import os
import threading
import time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session, defer, joinedload
from app.database import get_db
from app.models import AppRelease, MansehraZone, PricingRule, RiderProfile, SystemSetting, User
from app.schemas import FareEstimateRequest
from app.services.finance import estimate_booking_fare, get_topup_policy, haversine_km

router = APIRouter(prefix="/api/public", tags=["Public"])

_CACHE_LOCK = threading.Lock()
_BOOTSTRAP_CACHE: dict = {"expires_at": 0.0, "data": None}
_NEARBY_CACHE: dict = {"expires_at": 0.0, "data": None}
_BOOTSTRAP_TTL_SEC = 20.0
_NEARBY_TTL_SEC = 8.0


def invalidate_public_bootstrap_cache() -> None:
    with _CACHE_LOCK:
        _BOOTSTRAP_CACHE["expires_at"] = 0.0
        _BOOTSTRAP_CACHE["data"] = None


def invalidate_nearby_captains_cache() -> None:
    with _CACHE_LOCK:
        _NEARBY_CACHE["expires_at"] = 0.0
        _NEARBY_CACHE["data"] = None


def _use_public_cache() -> bool:
    return not bool(os.getenv("PYTEST_CURRENT_TEST"))


@router.get("/bootstrap")
def get_public_bootstrap(db: Session = Depends(get_db)):
    if _use_public_cache():
        now = time.monotonic()
        with _CACHE_LOCK:
            if _BOOTSTRAP_CACHE["data"] is not None and now < _BOOTSTRAP_CACHE["expires_at"]:
                return _BOOTSTRAP_CACHE["data"]

    zones = (
        db.query(MansehraZone)
        .filter(MansehraZone.is_active.is_(True))
        .order_by(MansehraZone.name.asc())
        .all()
    )
    rules = (
        db.query(PricingRule)
        .filter(PricingRule.is_active.is_(True))
        .order_by(PricingRule.id.asc())
        .all()
    )
    settings_rows = db.query(SystemSetting).all()
    releases = (
        db.query(AppRelease)
        .filter(AppRelease.is_latest.is_(True))
        .order_by(AppRelease.created_at.desc())
        .all()
    )
    payload = {
        "zones": [
            {
                "id": z.id,
                "name": z.name,
                "area_tag": z.area_tag,
                "approx_km_from_center": z.approx_km_from_center,
                "surcharge": z.surcharge,
                "lat": z.lat,
                "lng": z.lng,
            }
            for z in zones
        ],
        "pricing_rules": [
            {
                "service_type": r.service_type,
                "display_name": r.display_name,
                "base_fare": r.base_fare,
                "per_km_rate": r.per_km_rate,
                "min_fare": r.min_fare,
                "commission_type": r.commission_type,
                "commission_value": r.commission_value,
                "peak_multiplier": r.peak_multiplier,
                "city_flat_km": r.city_flat_km,
                "city_flat_fare": r.city_flat_fare,
                "wait_free_minutes": r.wait_free_minutes,
                "wait_charge_per_min": r.wait_charge_per_min,
            }
            for r in rules
        ],
        "settings": {
            s.key: s.value
            for s in settings_rows
            if not any(tok in s.key.lower() for tok in ("secret", "pass", "smtp", "token", "private", "webhook", "resend", "key"))
        },
        "releases": [
            {
                "id": rel.id,
                "platform": rel.platform,
                "version": rel.version,
                "file_name": rel.file_name,
                "download_url": rel.download_url,
                "file_size_mb": rel.file_size_mb,
                "release_notes": rel.release_notes,
                "download_count": rel.download_count,
                "created_at": rel.created_at,
            }
            for rel in releases
        ],
    }
    if _use_public_cache():
        with _CACHE_LOCK:
            _BOOTSTRAP_CACHE["data"] = payload
            _BOOTSTRAP_CACHE["expires_at"] = time.monotonic() + _BOOTSTRAP_TTL_SEC
    return payload


@router.post("/estimate")
def estimate_fare(payload: FareEstimateRequest, db: Session = Depends(get_db)):
    return estimate_booking_fare(
        db=db,
        service_type=payload.service_type,
        pickup_zone_name=payload.pickup_zone,
        drop_zone_name=payload.drop_zone,
        distance_km=payload.distance_km,
        promo_code=payload.promo_code,
        wait_minutes=payload.wait_minutes,
    )


def _load_eligible_online_captains(db: Session) -> list[dict]:
    if _use_public_cache():
        now = time.monotonic()
        with _CACHE_LOCK:
            if _NEARBY_CACHE["data"] is not None and now < _NEARBY_CACHE["expires_at"]:
                return _NEARBY_CACHE["data"]

    rows = (
        db.query(RiderProfile)
        .join(User, RiderProfile.user_id == User.id)
        .options(
            joinedload(RiderProfile.user),
            defer(RiderProfile.cnic_front_photo),
            defer(RiderProfile.cnic_back_photo),
        )
        .filter(
            User.role == "rider",
            User.is_active.is_(True),
            RiderProfile.is_verified.is_(True),
            RiderProfile.is_online.is_(True),
            RiderProfile.current_lat.isnot(None),
            RiderProfile.current_lng.isnot(None),
        )
        .all()
    )
    bike_policy = get_topup_policy(db, "bike")
    car_policy = get_topup_policy(db, "car")
    snapshot = []
    for rp in rows:
        u = rp.user
        if not u:
            continue
        vtype = (rp.vehicle_type or "bike").lower()
        pol = car_policy if vtype == "car" else bike_policy
        if pol["required"] and int(rp.remaining_paid_rides or 0) <= 0:
            continue
        if not pol["required"] and float(rp.balance_due_to_admin or 0.0) > float(rp.credit_limit or 0.0):
            continue
        first_name = (u.full_name or "Captain").split()[0]
        snapshot.append(
            {
                "rider_id": u.id,
                "display_name": f"Capt. {first_name}",
                "vehicle_type": rp.vehicle_type or "bike",
                "bike_model": rp.bike_model,
                "zone_name": rp.zone_name,
                "lat": rp.current_lat,
                "lng": rp.current_lng,
                "rating_avg": rp.rating_avg,
                "rider_photo": getattr(rp, "rider_photo", None),
                "vehicle_photo": getattr(rp, "vehicle_photo", None),
                "location_updated_at": rp.location_updated_at,
            }
        )
    if _use_public_cache():
        with _CACHE_LOCK:
            _NEARBY_CACHE["data"] = snapshot
            _NEARBY_CACHE["expires_at"] = time.monotonic() + _NEARBY_TTL_SEC
    return snapshot


@router.get("/nearby-captains")
def get_nearby_captains(
    lat: float = Query(34.3335, ge=-90.0, le=90.0),
    lng: float = Query(73.1995, ge=-180.0, le=180.0),
    service_type: Optional[str] = None,
    radius_km: float = Query(50.0, ge=1.0, le=250.0),
    db: Session = Depends(get_db),
):
    snapshot = _load_eligible_online_captains(db)
    out = []
    for item in snapshot:
        if service_type == "car_ride" and item["vehicle_type"] != "car":
            continue
        if service_type == "bike_ride" and item["vehicle_type"] != "bike":
            continue
        dist = haversine_km(lat, lng, item["lat"], item["lng"])
        if dist <= radius_km:
            out.append(
                {
                    **item,
                    "distance_km": dist,
                    "eta_min": max(2, int(round(dist / 0.45))),
                }
            )
    out.sort(key=lambda item: item["distance_km"])
    return out


@router.get("/releases")
def list_public_releases(db: Session = Depends(get_db)):
    releases = db.query(AppRelease).order_by(AppRelease.created_at.desc()).all()
    return [
        {
            "id": rel.id,
            "platform": rel.platform,
            "version": rel.version,
            "file_name": rel.file_name,
            "download_url": rel.download_url,
            "file_size_mb": rel.file_size_mb,
            "release_notes": rel.release_notes,
            "is_latest": rel.is_latest,
            "download_count": rel.download_count,
            "created_at": rel.created_at,
        }
        for rel in releases
    ]


@router.post("/releases/{release_id}/track-download")
def track_release_download(release_id: int, db: Session = Depends(get_db)):
    rel = db.query(AppRelease).filter(AppRelease.id == release_id).first()
    if not rel:
        raise HTTPException(status_code=404, detail="Release not found")
    rel.download_count += 1
    db.commit()
    return {"id": rel.id, "download_count": rel.download_count, "download_url": rel.download_url}


@router.get("/download/{platform}")
def direct_platform_download(platform: str, db: Session = Depends(get_db)):
    rel = (
        db.query(AppRelease)
        .filter(AppRelease.platform == platform, AppRelease.is_latest.is_(True))
        .order_by(AppRelease.created_at.desc())
        .first()
    )
    if not rel or not rel.download_url or rel.download_url.startswith("#"):
        raise HTTPException(status_code=404, detail="Installer package not published yet")
    rel.download_count += 1
    db.commit()
    return RedirectResponse(url=rel.download_url, status_code=302)
