from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import AppRelease, MansehraZone, PricingRule, SystemSetting
from app.schemas import FareEstimateRequest
from app.services.finance import estimate_booking_fare

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
    )


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
