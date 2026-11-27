from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from app.auth import require_roles
from app.database import get_db
from app.models import Booking, EmergencySosAlert, RiderProfile, SystemSetting, User
from app.schemas import EmergencySosCreate, EmergencySosStatusUpdate
from app.services.finance import resolve_nearest_zone_name, utcnow

router = APIRouter(prefix="/api", tags=["Emergency 1122 & SOS"])


def _get_emergency_numbers(db: Session) -> dict:
    rows = {
        s.key: s.value
        for s in db.query(SystemSetting)
        .filter(SystemSetting.key.in_(["emergency_rescue_number", "emergency_police_number", "support_phone"]))
        .all()
    }
    return {
        "emergency_rescue_number": (rows.get("emergency_rescue_number") or "1122").strip() or "1122",
        "emergency_police_number": (rows.get("emergency_police_number") or "15").strip() or "15",
        "support_phone": (rows.get("support_phone") or "+92 300 1111111").strip(),
    }


def serialize_sos_alert(a: EmergencySosAlert) -> dict:
    u = a.user
    rp = u.rider_profile if u else None
    b = a.booking
    lat = a.lat if a.lat is not None else (rp.current_lat if rp else None)
    lng = a.lng if a.lng is not None else (rp.current_lng if rp else None)
    maps_url = (
        f"https://www.google.com/maps/search/?api=1&query={lat},{lng}"
        if lat is not None and lng is not None
        else None
    )
    return {
        "id": a.id,
        "user_id": a.user_id,
        "user_role": a.user_role,
        "user_name": u.full_name if u else f"User #{a.user_id}",
        "user_phone": u.phone if u else "",
        "vehicle_type": rp.vehicle_type if rp else None,
        "bike_model": rp.bike_model if rp else None,
        "bike_plate": rp.bike_plate if rp else None,
        "rider_photo": rp.rider_photo if rp else None,
        "booking_id": a.booking_id,
        "booking_code": b.booking_code if b else None,
        "service_type": b.service_type if b else None,
        "booking_route": f"{b.pickup_zone} -> {b.drop_zone}" if b else None,
        "customer_name": b.customer.full_name if b and b.customer else None,
        "customer_phone": b.customer.phone if b and b.customer else None,
        "assigned_rider_name": b.rider.full_name if b and b.rider else None,
        "assigned_rider_phone": b.rider.phone if b and b.rider else None,
        "lat": lat,
        "lng": lng,
        "zone_name": a.zone_name or (rp.zone_name if rp else "Mansehra Control"),
        "emergency_type": a.emergency_type,
        "note": a.note,
        "called_number": a.called_number or "1122",
        "status": a.status,
        "resolution_note": a.resolution_note,
        "google_maps_url": maps_url,
        "created_at": a.created_at,
        "resolved_at": a.resolved_at,
    }


@router.post("/sos/trigger", status_code=status.HTTP_201_CREATED)
def trigger_sos_alert(
    payload: EmergencySosCreate,
    current_user: User = Depends(require_roles("rider", "admin", "customer")),
    db: Session = Depends(get_db),
):
    rp: Optional[RiderProfile] = None
    if current_user.role == "rider":
        rp = db.query(RiderProfile).filter(RiderProfile.user_id == current_user.id).first()

    lat = payload.lat if payload.lat is not None else (rp.current_lat if rp else None)
    lng = payload.lng if payload.lng is not None else (rp.current_lng if rp else None)
    zone_name = resolve_nearest_zone_name(db, lat, lng) if (lat is not None and lng is not None) else None
    if not zone_name:
        zone_name = rp.zone_name if rp else "SafarGo Control Desk"

    if rp and lat is not None and lng is not None:
        rp.current_lat = lat
        rp.current_lng = lng
        rp.location_updated_at = utcnow()
        rp.zone_name = zone_name

    booking_id = payload.booking_id
    if booking_id is None and current_user.role == "rider":
        active_b = (
            db.query(Booking)
            .filter(
                Booking.rider_id == current_user.id,
                Booking.status.in_(["assigned", "arrived", "in_progress"]),
            )
            .order_by(Booking.id.desc())
            .first()
        )
        if active_b:
            booking_id = active_b.id
    elif booking_id is None and current_user.role == "customer":
        active_b = (
            db.query(Booking)
            .filter(
                Booking.customer_id == current_user.id,
                Booking.status.in_(["pending", "assigned", "arrived", "in_progress"]),
            )
            .order_by(Booking.id.desc())
            .first()
        )
        if active_b:
            booking_id = active_b.id

    alert = EmergencySosAlert(
        user_id=current_user.id,
        user_role=current_user.role,
        booking_id=booking_id,
        lat=lat,
        lng=lng,
        zone_name=zone_name,
        emergency_type=(payload.emergency_type or "police_15").strip(),
        note=(payload.note or "").strip() or None,
        called_number=(payload.called_number or "15").strip() or "15",
        status="active",
    )
    db.add(alert)
    db.commit()

    saved = (
        db.query(EmergencySosAlert)
        .options(
            joinedload(EmergencySosAlert.user).joinedload(User.rider_profile),
            joinedload(EmergencySosAlert.booking).joinedload(Booking.customer),
            joinedload(EmergencySosAlert.booking).joinedload(Booking.rider),
        )
        .filter(EmergencySosAlert.id == alert.id)
        .first()
    )
    out = serialize_sos_alert(saved)
    out.update(_get_emergency_numbers(db))
    return out


@router.get("/sos/my")
def list_my_sos_alerts(
    current_user: User = Depends(require_roles("rider", "admin", "customer")),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(EmergencySosAlert)
        .options(
            joinedload(EmergencySosAlert.user).joinedload(User.rider_profile),
            joinedload(EmergencySosAlert.booking).joinedload(Booking.customer),
        )
        .filter(EmergencySosAlert.user_id == current_user.id)
        .order_by(EmergencySosAlert.id.desc())
        .limit(15)
        .all()
    )
    return [serialize_sos_alert(r) for r in rows]


@router.get("/admin/sos")
def admin_list_sos_alerts(
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(EmergencySosAlert)
        .options(
            joinedload(EmergencySosAlert.user).joinedload(User.rider_profile),
            joinedload(EmergencySosAlert.booking).joinedload(Booking.customer),
        )
        .order_by(EmergencySosAlert.id.desc())
        .limit(50)
        .all()
    )
    return [serialize_sos_alert(r) for r in rows]


@router.post("/admin/sos/{sos_id}/status")
def admin_update_sos_status(
    sos_id: int,
    payload: EmergencySosStatusUpdate,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    alert = (
        db.query(EmergencySosAlert)
        .options(
            joinedload(EmergencySosAlert.user).joinedload(User.rider_profile),
            joinedload(EmergencySosAlert.booking).joinedload(Booking.customer),
        )
        .filter(EmergencySosAlert.id == sos_id)
        .first()
    )
    if not alert:
        raise HTTPException(status_code=404, detail="SOS alert not found")
    alert.status = payload.status
    if payload.resolution_note is not None:
        alert.resolution_note = payload.resolution_note.strip() or None
    if payload.status in ("acknowledged", "resolved"):
        alert.resolved_by_id = current_user.id
    if payload.status == "resolved":
        alert.resolved_at = utcnow()
    elif payload.status == "active":
        alert.resolved_at = None
    db.commit()
    db.refresh(alert)
    return serialize_sos_alert(alert)
