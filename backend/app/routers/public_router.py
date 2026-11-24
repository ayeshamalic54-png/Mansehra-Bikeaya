from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import AppRelease, MansehraZone, PricingRule, RiderProfile, SystemSetting, User
from app.schemas import FareEstimateRequest
from app.services.finance import estimate_booking_fare, haversine_km

router = APIRouter(prefix="/api/public", tags=["Public"])


@router.get("/bootstrap")
def get_public_bootstrap(db: Session = Depends(get_db)):
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
    return {
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
        "settings": {s.key: s.value for s in settings_rows},
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


@router.get("/nearby-captains")
def get_nearby_captains(
    lat: float = Query(34.3335, ge=-90.0, le=90.0),
    lng: float = Query(73.1995, ge=-180.0, le=180.0),
    service_type: Optional[str] = None,
    radius_km: float = Query(50.0, ge=1.0, le=250.0),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(User)
        .options(joinedload(User.rider_profile))
        .filter(User.role == "rider", User.is_active.is_(True))
        .all()
    )
    out = []
    for u in rows:
        rp = u.rider_profile
        if not rp or not rp.is_verified or not rp.is_online:
            continue
        if rp.current_lat is None or rp.current_lng is None:
            continue
        if service_type == "car_ride" and rp.vehicle_type != "car":
            continue
        dist = haversine_km(lat, lng, rp.current_lat, rp.current_lng)
        if dist <= radius_km:
            first_name = (u.full_name or "Captain").split()[0]
            out.append(
                {
                    "rider_id": u.id,
                    "display_name": f"Capt. {first_name}",
                    "vehicle_type": rp.vehicle_type or "bike",
                    "bike_model": rp.bike_model,
                    "zone_name": rp.zone_name,
                    "lat": rp.current_lat,
                    "lng": rp.current_lng,
                    "distance_km": dist,
                    "eta_min": max(2, int(round(dist / 0.45))),
                    "rating_avg": rp.rating_avg,
                    "location_updated_at": rp.location_updated_at,
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
