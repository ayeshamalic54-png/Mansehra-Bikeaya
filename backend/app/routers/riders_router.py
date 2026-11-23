from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.auth import require_roles
from app.database import get_db
from app.models import Booking, LedgerEntry, PricingRule, RiderProfile, User
from app.routers.bookings_router import serialize_booking
from app.schemas import BookingStatusUpdate
from app.services.finance import complete_booking_and_post_ledger, compute_commission, utcnow

router = APIRouter(prefix="/api/riders", tags=["Rider Captain"])


@router.post("/toggle-online")
def toggle_online(
    current_user: User = Depends(require_roles("rider")),
    db: Session = Depends(get_db),
):
    rp = db.query(RiderProfile).filter(RiderProfile.user_id == current_user.id).first()
    if not rp:
        raise HTTPException(status_code=404, detail="Rider profile not found")

    if not rp.is_online:
        if not rp.is_verified:
            raise HTTPException(
                status_code=403,
                detail="Your account is pending Admin verification before you can go online.",
            )
        if rp.balance_due_to_admin > rp.credit_limit:
            raise HTTPException(
                status_code=403,
                detail=(
                    f"Unpaid commission due (Rs. {rp.balance_due_to_admin:.0f}) exceeds "
                    f"your limit (Rs. {rp.credit_limit:.0f}). Please settle with Admin first."
                ),
            )
        rp.is_online = True
    else:
        rp.is_online = False

    db.commit()
    return {"is_online": rp.is_online, "balance_due_to_admin": rp.balance_due_to_admin}


@router.get("/available-jobs")
def get_available_jobs(
    current_user: User = Depends(require_roles("rider")),
    db: Session = Depends(get_db),
):
    rp = db.query(RiderProfile).filter(RiderProfile.user_id == current_user.id).first()
    if not rp:
        raise HTTPException(status_code=404, detail="Rider profile not found")
    if not rp.is_verified:
        return []

    rules = {r.service_type: r for r in db.query(PricingRule).all()}
    jobs = (
        db.query(Booking)
        .options(joinedload(Booking.customer))
        .filter(Booking.status == "pending", Booking.rider_id.is_(None))
        .order_by(Booking.created_at.desc())
        .all()
    )
    out = []
    for job in jobs:
        data = serialize_booking(job)
        rule = rules.get(job.service_type)
        if rule:
            _, _, comm, net = compute_commission(job.final_fare, rule, rp)
            data["commission_amount"] = comm
            data["rider_earning"] = net
        out.append(data)
    return out


@router.post("/jobs/{booking_id}/accept")
def accept_job(
    booking_id: int,
    current_user: User = Depends(require_roles("rider")),
    db: Session = Depends(get_db),
):
    rp = db.query(RiderProfile).filter(RiderProfile.user_id == current_user.id).first()
    if not rp or not rp.is_verified:
        raise HTTPException(status_code=403, detail="Rider must be verified by Admin to accept rides")
    if rp.balance_due_to_admin > rp.credit_limit:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Commission due (Rs. {rp.balance_due_to_admin:.0f}) exceeds credit cap "
                f"(Rs. {rp.credit_limit:.0f}). Settle with Admin to continue."
            ),
        )

    booking = (
        db.query(Booking)
        .options(joinedload(Booking.customer))
        .filter(Booking.id == booking_id)
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status != "pending" or booking.rider_id is not None:
        raise HTTPException(status_code=409, detail="This ride was already taken or is no longer available")

    rule = db.query(PricingRule).filter(PricingRule.service_type == booking.service_type).first()
    if rule:
        c_type, c_val, comm, net = compute_commission(booking.final_fare, rule, rp)
        booking.commission_type_snapshot = c_type
        booking.commission_rate_snapshot = c_val
        booking.commission_amount = comm
        booking.rider_earning = net

    booking.rider_id = current_user.id
    booking.status = "assigned"
    booking.assigned_at = utcnow()
    rp.is_online = True
    db.commit()
    db.refresh(booking)
    return serialize_booking(booking)


@router.post("/jobs/{booking_id}/status")
def update_rider_job_status(
    booking_id: int,
    payload: BookingStatusUpdate,
    current_user: User = Depends(require_roles("rider")),
    db: Session = Depends(get_db),
):
    booking = (
        db.query(Booking)
        .options(joinedload(Booking.customer), joinedload(Booking.rider).joinedload(User.rider_profile))
        .filter(Booking.id == booking_id)
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.rider_id != current_user.id:
        raise HTTPException(status_code=403, detail="This booking is not assigned to you")
    if payload.status == "cancelled":
        raise HTTPException(status_code=403, detail="Please contact Admin to cancel an assigned ride")

    allowed = {
        "assigned": ("arrived", "in_progress", "completed"),
        "arrived": ("in_progress", "completed"),
        "in_progress": ("completed",),
    }
    if payload.status not in allowed.get(booking.status, ()):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from {booking.status} to {payload.status}",
        )

    if payload.status == "arrived":
        booking.status = "arrived"
        db.commit()
    elif payload.status == "in_progress":
        booking.status = "in_progress"
        booking.started_at = utcnow()
        db.commit()
    elif payload.status == "completed":
        booking = complete_booking_and_post_ledger(
            db=db,
            booking=booking,
            actor=current_user,
            final_fare_override=payload.final_fare_override,
            payment_collector_override=payload.payment_collector,
        )

    db.refresh(booking)
    return serialize_booking(booking)


@router.get("/ledger")
def get_my_rider_ledger(
    current_user: User = Depends(require_roles("rider")),
    db: Session = Depends(get_db),
):
    rp = db.query(RiderProfile).filter(RiderProfile.user_id == current_user.id).first()
    if not rp:
        raise HTTPException(status_code=404, detail="Rider profile not found")
    entries = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.rider_id == current_user.id)
        .order_by(LedgerEntry.created_at.desc())
        .limit(100)
        .all()
    )
    return {
        "summary": {
            "balance_due_to_admin": rp.balance_due_to_admin,
            "credit_limit": rp.credit_limit,
            "is_over_limit": rp.balance_due_to_admin > rp.credit_limit,
            "total_trips": rp.total_trips,
            "total_gross_collected": rp.total_gross_collected,
            "total_net_earned": rp.total_net_earned,
            "total_commission_generated": rp.total_commission_generated,
            "total_settled_to_admin": rp.total_settled_to_admin,
            "rating_avg": rp.rating_avg,
        },
        "entries": [
            {
                "id": e.id,
                "booking_id": e.booking_id,
                "entry_type": e.entry_type,
                "amount": e.amount,
                "signed_delta": e.signed_delta,
                "balance_after": e.balance_after,
                "payment_channel": e.payment_channel,
                "reference_no": e.reference_no,
                "note": e.note,
                "created_at": e.created_at,
            }
            for e in entries
        ],
    }
