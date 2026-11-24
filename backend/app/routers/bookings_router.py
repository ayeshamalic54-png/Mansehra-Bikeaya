from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from app.auth import get_current_user, require_roles
from app.database import get_db
from app.models import Booking, MansehraZone, PromoCode, RiderProfile, SupportTicket, User
from app.schemas import BookingCreate, BookingRatingCreate, SupportTicketCreate
from app.services.finance import estimate_booking_fare

router = APIRouter(prefix="/api", tags=["Customer Bookings & Support"])


def generate_booking_code(db: Session) -> str:
    max_id = db.query(func.max(Booking.id)).scalar() or 0
    return f"MNS-{1001 + max_id}"


def serialize_booking(b: Booking) -> dict:
    rider_info = None
    if b.rider:
        rp = b.rider.rider_profile
        rider_info = {
            "id": b.rider.id,
            "full_name": b.rider.full_name,
            "phone": b.rider.phone,
            "vehicle_type": rp.vehicle_type if rp else "bike",
            "bike_model": rp.bike_model if rp else None,
            "bike_plate": rp.bike_plate if rp else None,
            "rating_avg": rp.rating_avg if rp else 5.0,
            "current_lat": rp.current_lat if rp else None,
            "current_lng": rp.current_lng if rp else None,
            "location_updated_at": rp.location_updated_at if rp else None,
        }
    return {
        "id": b.id,
        "booking_code": b.booking_code,
        "customer_id": b.customer_id,
        "customer": {
            "id": b.customer.id,
            "full_name": b.customer.full_name,
            "phone": b.customer.phone,
        }
        if b.customer
        else None,
        "rider_id": b.rider_id,
        "rider": rider_info,
        "service_type": b.service_type,
        "pickup_zone": b.pickup_zone,
        "pickup_address": b.pickup_address,
        "pickup_lat": b.pickup_lat,
        "pickup_lng": b.pickup_lng,
        "drop_zone": b.drop_zone,
        "drop_address": b.drop_address,
        "drop_lat": b.drop_lat,
        "drop_lng": b.drop_lng,
        "distance_km": b.distance_km,
        "estimated_fare": b.estimated_fare,
        "discount_amount": b.discount_amount,
        "promo_code": b.promo_code,
        "wait_minutes": b.wait_minutes,
        "wait_charge": b.wait_charge,
        "final_fare": b.final_fare,
        "commission_type_snapshot": b.commission_type_snapshot,
        "commission_rate_snapshot": b.commission_rate_snapshot,
        "commission_amount": b.commission_amount,
        "rider_earning": b.rider_earning,
        "payment_method": b.payment_method,
        "payment_collector": b.payment_collector,
        "status": b.status,
        "receiver_name": b.receiver_name,
        "receiver_phone": b.receiver_phone,
        "cod_amount": b.cod_amount,
        "customer_notes": b.customer_notes,
        "created_by_admin": b.created_by_admin,
        "customer_rating": b.customer_rating,
        "customer_feedback": b.customer_feedback,
        "cancelled_reason": b.cancelled_reason,
        "created_at": b.created_at,
        "assigned_at": b.assigned_at,
        "arrived_at": b.arrived_at,
        "started_at": b.started_at,
        "completed_at": b.completed_at,
    }


@router.post("/bookings", status_code=status.HTTP_201_CREATED)
def create_customer_booking(
    payload: BookingCreate,
    current_user: User = Depends(require_roles("customer", "admin")),
    db: Session = Depends(get_db),
):
    est = estimate_booking_fare(
        db=db,
        service_type=payload.service_type,
        pickup_zone_name=payload.pickup_zone,
        drop_zone_name=payload.drop_zone,
        distance_km=payload.distance_km,
        promo_code=payload.promo_code,
        wait_minutes=payload.wait_minutes,
    )
    if est["applied_promo"]:
        promo = db.query(PromoCode).filter(PromoCode.code == est["applied_promo"]).first()
        if promo:
            promo.uses_count += 1

    p_zone_row = db.query(MansehraZone).filter(MansehraZone.name == payload.pickup_zone).first()
    d_zone_row = db.query(MansehraZone).filter(MansehraZone.name == payload.drop_zone).first()
    collector = "rider" if payload.payment_method == "cash" else "admin"
    booking = Booking(
        booking_code=generate_booking_code(db),
        customer_id=current_user.id,
        service_type=payload.service_type,
        pickup_zone=payload.pickup_zone,
        pickup_address=payload.pickup_address.strip(),
        pickup_lat=payload.pickup_lat if payload.pickup_lat is not None else (p_zone_row.lat if p_zone_row else None),
        pickup_lng=payload.pickup_lng if payload.pickup_lng is not None else (p_zone_row.lng if p_zone_row else None),
        drop_zone=payload.drop_zone,
        drop_address=payload.drop_address.strip(),
        drop_lat=payload.drop_lat if payload.drop_lat is not None else (d_zone_row.lat if d_zone_row else None),
        drop_lng=payload.drop_lng if payload.drop_lng is not None else (d_zone_row.lng if d_zone_row else None),
        distance_km=payload.distance_km,
        estimated_fare=est["estimated_fare"],
        discount_amount=est["discount_amount"],
        promo_code=est["applied_promo"],
        wait_minutes=est["wait_minutes"],
        wait_charge=est["wait_charge"],
        final_fare=est["estimated_fare"],
        commission_type_snapshot=est["commission_type"],
        commission_rate_snapshot=est["commission_value"],
        commission_amount=est["estimated_commission"],
        rider_earning=est["estimated_rider_earning"],
        payment_method=payload.payment_method,
        payment_collector=collector,
        status="pending",
        receiver_name=payload.receiver_name,
        receiver_phone=payload.receiver_phone,
        cod_amount=payload.cod_amount,
        customer_notes=payload.customer_notes,
        created_by_admin=False,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return serialize_booking(booking)


@router.get("/bookings/my")
def get_my_bookings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Booking).options(
        joinedload(Booking.customer),
        joinedload(Booking.rider).joinedload(User.rider_profile),
    )
    if current_user.role == "customer":
        q = q.filter(Booking.customer_id == current_user.id)
    elif current_user.role == "rider":
        q = q.filter(Booking.rider_id == current_user.id)
    rows = q.order_by(Booking.created_at.desc()).limit(100).all()
    return [serialize_booking(b) for b in rows]


@router.post("/bookings/{booking_id}/cancel")
def cancel_booking(
    booking_id: int,
    reason: str = "Cancelled by user",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if current_user.role == "customer" and booking.customer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your booking")
    if current_user.role == "rider":
        raise HTTPException(status_code=403, detail="Riders cannot cancel bookings directly")
    if booking.status in ("completed", "cancelled"):
        raise HTTPException(status_code=400, detail=f"Booking is already {booking.status}")
    if current_user.role == "customer" and booking.status == "in_progress":
        raise HTTPException(status_code=400, detail="Cannot cancel a ride already in progress; contact support")

    booking.status = "cancelled"
    booking.cancelled_reason = reason
    db.commit()
    db.refresh(booking)
    return serialize_booking(booking)


@router.post("/bookings/{booking_id}/rate")
def rate_booking(
    booking_id: int,
    payload: BookingRatingCreate,
    current_user: User = Depends(require_roles("customer")),
    db: Session = Depends(get_db),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking or booking.customer_id != current_user.id:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status != "completed":
        raise HTTPException(status_code=400, detail="Only completed rides can be rated")
    if booking.customer_rating is not None:
        raise HTTPException(status_code=400, detail="You already rated this ride")

    booking.customer_rating = payload.rating
    booking.customer_feedback = payload.feedback

    if booking.rider_id:
        rp = db.query(RiderProfile).filter(RiderProfile.user_id == booking.rider_id).first()
        if rp:
            total_score = rp.rating_avg * rp.rating_count + payload.rating
            rp.rating_count += 1
            rp.rating_avg = round(total_score / rp.rating_count, 2)

    db.commit()
    db.refresh(booking)
    return serialize_booking(booking)


def _serialize_ticket(t: SupportTicket) -> dict:
    return {
        "id": t.id,
        "booking_id": t.booking_id,
        "booking_code": t.booking.booking_code if t.booking else None,
        "subject": t.subject,
        "category": t.category,
        "message": t.message,
        "status": t.status,
        "admin_reply": t.admin_reply,
        "created_at": t.created_at,
    }


@router.post("/support/tickets", status_code=status.HTTP_201_CREATED)
def create_support_ticket(
    payload: SupportTicketCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    linked_booking = None
    if payload.booking_id is not None:
        linked_booking = db.query(Booking).filter(Booking.id == payload.booking_id).first()
        if not linked_booking:
            raise HTTPException(status_code=404, detail="Selected booking not found")
        if (
            current_user.role != "admin"
            and linked_booking.customer_id != current_user.id
            and linked_booking.rider_id != current_user.id
        ):
            raise HTTPException(status_code=403, detail="Cannot link a booking that does not belong to you")

    ticket = SupportTicket(
        user_id=current_user.id,
        booking_id=payload.booking_id,
        subject=payload.subject.strip(),
        category=(payload.category or "general").strip().lower()[:40],
        message=payload.message.strip(),
        status="open",
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    res = _serialize_ticket(ticket)
    if linked_booking and not res["booking_code"]:
        res["booking_code"] = linked_booking.booking_code
    return res


@router.get("/support/tickets/my")
def my_support_tickets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(SupportTicket)
        .options(joinedload(SupportTicket.booking))
        .filter(SupportTicket.user_id == current_user.id)
        .order_by(SupportTicket.created_at.desc())
        .all()
    )
    return [_serialize_ticket(t) for t in rows]
