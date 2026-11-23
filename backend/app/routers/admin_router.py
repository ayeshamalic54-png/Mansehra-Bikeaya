from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from app.auth import hash_password, require_roles
from app.database import get_db
from app.models import (
    AdminExpense,
    AppRelease,
    Booking,
    LedgerEntry,
    MansehraZone,
    PricingRule,
    PromoCode,
    RiderProfile,
    SupportTicket,
    SystemSetting,
    User,
)
from app.routers.bookings_router import generate_booking_code, serialize_booking
from app.schemas import (
    AdminBookingUpdate,
    AdminCreateRider,
    AdminCustomerCreate,
    AdminCustomerUpdate,
    AdminManualBookingCreate,
    AdminPasswordReset,
    AdminSelfUpdate,
    BookingAssignRider,
    BookingStatusUpdate,
    PricingRuleUpdate,
    PromoCreate,
    PromoUpdate,
    ReleaseCreate,
    ReleaseUpdate,
    RiderConfigUpdate,
    SupportTicketReply,
    SystemSettingUpdate,
    ZoneCreate,
    ZoneUpdate,
)
from app.services.finance import (
    complete_booking_and_post_ledger,
    compute_commission,
    estimate_booking_fare,
    recalculate_rider_ledger_balances,
    utcnow,
)

router = APIRouter(prefix="/api/admin", tags=["Admin Command Center"])


@router.get("/overview")
def admin_overview(
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    all_bookings = db.query(Booking).all()
    today_bookings = [b for b in all_bookings if b.created_at >= today_start]
    completed_all = [b for b in all_bookings if b.status == "completed"]
    completed_today = [b for b in today_bookings if b.status == "completed"]

    pending_count = sum(1 for b in all_bookings if b.status == "pending")
    active_count = sum(1 for b in all_bookings if b.status in ("assigned", "arrived", "in_progress"))

    riders = db.query(RiderProfile).options(joinedload(RiderProfile.user)).all()
    online_riders = sum(1 for r in riders if r.is_online and r.is_verified)
    pending_verification = sum(1 for r in riders if not r.is_verified)

    receivable_from_riders = round(sum(max(r.balance_due_to_admin, 0.0) for r in riders), 2)
    payable_to_riders = round(sum(abs(min(r.balance_due_to_admin, 0.0)) for r in riders), 2)
    over_limit_riders = [
        {
            "rider_id": r.user_id,
            "full_name": r.user.full_name if r.user else "",
            "bike_plate": r.bike_plate,
            "balance_due": r.balance_due_to_admin,
            "credit_limit": r.credit_limit,
        }
        for r in riders
        if r.balance_due_to_admin > r.credit_limit
    ]

    total_expenses = round(db.query(func.coalesce(func.sum(AdminExpense.amount), 0.0)).scalar() or 0.0, 2)
    total_commission = round(sum(b.commission_amount for b in completed_all), 2)
    total_gross = round(sum(b.final_fare for b in completed_all), 2)
    today_gross = round(sum(b.final_fare for b in completed_today), 2)
    today_commission = round(sum(b.commission_amount for b in completed_today), 2)
    net_profit = round(total_commission - total_expenses, 2)

    recent_rows = (
        db.query(Booking)
        .options(joinedload(Booking.customer), joinedload(Booking.rider).joinedload(User.rider_profile))
        .order_by(Booking.created_at.desc())
        .limit(10)
        .all()
    )

    return {
        "kpis": {
            "today_total_rides": len(today_bookings),
            "today_completed_rides": len(completed_today),
            "today_gross_fare": today_gross,
            "today_admin_profit": today_commission,
            "all_time_completed_rides": len(completed_all),
            "all_time_gross_fare": total_gross,
            "all_time_admin_commission": total_commission,
            "all_time_expenses": total_expenses,
            "all_time_net_profit": net_profit,
            "pending_dispatch_count": pending_count,
            "active_rides_count": active_count,
            "online_riders_count": online_riders,
            "total_riders_count": len(riders),
            "pending_verification_count": pending_verification,
            "receivable_from_riders": receivable_from_riders,
            "payable_to_riders": payable_to_riders,
        },
        "over_limit_riders": over_limit_riders,
        "recent_bookings": [serialize_booking(b) for b in recent_rows],
    }


@router.get("/bookings")
def list_all_bookings(
    status_filter: Optional[str] = Query(None, alias="status"),
    service_type: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    q = db.query(Booking).options(
        joinedload(Booking.customer),
        joinedload(Booking.rider).joinedload(User.rider_profile),
    )
    if status_filter:
        q = q.filter(Booking.status == status_filter)
    if service_type:
        q = q.filter(Booking.service_type == service_type)
    if search:
        s = f"%{search.strip()}%"
        q = q.filter(
            (Booking.booking_code.ilike(s))
            | (Booking.pickup_address.ilike(s))
            | (Booking.drop_address.ilike(s))
        )
    rows = q.order_by(Booking.created_at.desc()).limit(200).all()
    return [serialize_booking(b) for b in rows]


@router.post("/bookings/manual", status_code=status.HTTP_201_CREATED)
def create_manual_booking(
    payload: AdminManualBookingCreate,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    clean_phone = payload.customer_phone.strip()
    customer = db.query(User).filter(User.phone == clean_phone).first()
    if not customer:
        customer = User(
            full_name=(payload.customer_name or "Walk-in Customer").strip(),
            phone=clean_phone,
            password_hash=hash_password("user123"),
            role="customer",
            is_active=True,
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)

    est = estimate_booking_fare(
        db=db,
        service_type=payload.service_type,
        pickup_zone_name=payload.pickup_zone,
        drop_zone_name=payload.drop_zone,
        distance_km=payload.distance_km,
        promo_code=payload.promo_code,
    )
    fare = float(round(payload.custom_fare)) if payload.custom_fare else est["estimated_fare"]

    rider_rp = None
    initial_status = "pending"
    assigned_at = None
    if payload.rider_id:
        rider = db.query(User).filter(User.id == payload.rider_id, User.role == "rider").first()
        if not rider or not rider.rider_profile:
            raise HTTPException(status_code=404, detail="Selected rider not found")
        rider_rp = rider.rider_profile
        initial_status = "assigned"
        assigned_at = utcnow()

    rule = db.query(PricingRule).filter(PricingRule.service_type == payload.service_type).first()
    c_type, c_val, comm, net = compute_commission(fare, rule, rider_rp)

    booking = Booking(
        booking_code=generate_booking_code(db),
        customer_id=customer.id,
        rider_id=payload.rider_id,
        service_type=payload.service_type,
        pickup_zone=payload.pickup_zone,
        pickup_address=payload.pickup_address.strip(),
        drop_zone=payload.drop_zone,
        drop_address=payload.drop_address.strip(),
        distance_km=payload.distance_km,
        estimated_fare=est["estimated_fare"],
        discount_amount=est["discount_amount"],
        promo_code=est["applied_promo"],
        final_fare=fare,
        commission_type_snapshot=c_type,
        commission_rate_snapshot=c_val,
        commission_amount=comm,
        rider_earning=net,
        payment_method=payload.payment_method,
        payment_collector="rider" if payload.payment_method == "cash" else "admin",
        status=initial_status,
        receiver_name=payload.receiver_name,
        receiver_phone=payload.receiver_phone,
        cod_amount=payload.cod_amount,
        customer_notes=payload.customer_notes,
        created_by_admin=True,
        assigned_at=assigned_at,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return serialize_booking(booking)


@router.post("/bookings/{booking_id}/assign")
def assign_rider_to_booking(
    booking_id: int,
    payload: BookingAssignRider,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status in ("completed", "cancelled"):
        raise HTTPException(status_code=400, detail="Cannot assign rider to completed/cancelled ride")

    rider = db.query(User).filter(User.id == payload.rider_id, User.role == "rider").first()
    if not rider or not rider.rider_profile:
        raise HTTPException(status_code=404, detail="Rider not found")

    rule = db.query(PricingRule).filter(PricingRule.service_type == booking.service_type).first()
    if rule:
        c_type, c_val, comm, net = compute_commission(booking.final_fare, rule, rider.rider_profile)
        booking.commission_type_snapshot = c_type
        booking.commission_rate_snapshot = c_val
        booking.commission_amount = comm
        booking.rider_earning = net

    booking.rider_id = rider.id
    booking.status = "assigned"
    booking.assigned_at = utcnow()
    db.commit()
    db.refresh(booking)
    return serialize_booking(booking)


@router.post("/bookings/{booking_id}/status")
def admin_update_booking_status(
    booking_id: int,
    payload: BookingStatusUpdate,
    current_user: User = Depends(require_roles("admin")),
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

    if payload.status == "cancelled":
        if booking.status == "completed":
            raise HTTPException(status_code=400, detail="Completed ride cannot be cancelled")
        booking.status = "cancelled"
        booking.cancelled_reason = payload.cancelled_reason or "Cancelled by Admin"
        db.commit()
    elif payload.status == "completed":
        booking = complete_booking_and_post_ledger(
            db=db,
            booking=booking,
            actor=current_user,
            final_fare_override=payload.final_fare_override,
            payment_collector_override=payload.payment_collector,
        )
    else:
        booking.status = payload.status
        if payload.status == "in_progress" and not booking.started_at:
            booking.started_at = utcnow()
        db.commit()

    db.refresh(booking)
    return serialize_booking(booking)


@router.patch("/bookings/{booking_id}")
def admin_edit_booking(
    booking_id: int,
    payload: AdminBookingUpdate,
    current_user: User = Depends(require_roles("admin")),
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

    updates = payload.model_dump(exclude_unset=True)
    for field, val in updates.items():
        setattr(booking, field, val)

    # Recompute commission & ledger entry if fare or payment collector changed
    rule = db.query(PricingRule).filter(PricingRule.service_type == booking.service_type).first()
    rp = booking.rider.rider_profile if booking.rider else None
    if rule:
        c_type, c_val, comm, net = compute_commission(booking.final_fare, rule, rp)
        booking.commission_type_snapshot = c_type
        booking.commission_rate_snapshot = c_val
        booking.commission_amount = comm
        booking.rider_earning = net

    if booking.status == "completed" and booking.rider_id:
        ledger = db.query(LedgerEntry).filter(LedgerEntry.booking_id == booking.id).first()
        if ledger:
            if booking.payment_collector == "rider":
                ledger.entry_type = "commission_due"
                ledger.amount = booking.commission_amount
                ledger.signed_delta = booking.commission_amount
                ledger.note = f"Ride {booking.booking_code} (Edited): Cash Rs.{booking.final_fare:.0f}, Comm due Rs.{booking.commission_amount:.2f}"
            else:
                ledger.entry_type = "digital_payout_credit"
                ledger.amount = booking.rider_earning
                ledger.signed_delta = -booking.rider_earning
                ledger.note = f"Ride {booking.booking_code} (Edited): Digital Rs.{booking.final_fare:.0f}, Rider credit Rs.{booking.rider_earning:.2f}"
        db.commit()
        recalculate_rider_ledger_balances(db, booking.rider_id)
    else:
        db.commit()

    db.refresh(booking)
    return serialize_booking(booking)


@router.delete("/bookings/{booking_id}")
def admin_delete_booking(
    booking_id: int,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    affected_rider_id = booking.rider_id
    db.query(SupportTicket).filter(SupportTicket.booking_id == booking.id).update({"booking_id": None})
    db.query(LedgerEntry).filter(LedgerEntry.booking_id == booking.id).delete()
    db.delete(booking)
    db.commit()
    if affected_rider_id:
        recalculate_rider_ledger_balances(db, affected_rider_id)
    return {"deleted": booking_id}


@router.patch("/users/{user_id}/password")
def admin_change_any_password(
    user_id: int,
    payload: AdminPasswordReset,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"status": "password_updated", "user_id": user.id, "role": user.role}


@router.patch("/profile")
def admin_update_self(
    payload: AdminSelfUpdate,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    if payload.phone and payload.phone.strip() != current_user.phone:
        if db.query(User).filter(User.phone == payload.phone.strip(), User.id != current_user.id).first():
            raise HTTPException(status_code=400, detail="Phone number already in use")
        current_user.phone = payload.phone.strip()
    if payload.email and payload.email.strip() != current_user.email:
        if db.query(User).filter(User.email == payload.email.strip(), User.id != current_user.id).first():
            raise HTTPException(status_code=400, detail="Email already in use")
        current_user.email = payload.email.strip()
    if payload.full_name:
        current_user.full_name = payload.full_name.strip()
    db.commit()
    db.refresh(current_user)
    return {
        "id": current_user.id,
        "full_name": current_user.full_name,
        "phone": current_user.phone,
        "email": current_user.email,
    }


@router.get("/riders")
def list_riders(
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    riders = (
        db.query(User)
        .options(joinedload(User.rider_profile))
        .filter(User.role == "rider")
        .order_by(User.created_at.desc())
        .all()
    )
    return [
        {
            "id": u.id,
            "full_name": u.full_name,
            "phone": u.phone,
            "is_active": u.is_active,
            "created_at": u.created_at,
            "cnic_number": u.rider_profile.cnic_number if u.rider_profile else None,
            "bike_model": u.rider_profile.bike_model if u.rider_profile else None,
            "bike_plate": u.rider_profile.bike_plate if u.rider_profile else None,
            "license_no": u.rider_profile.license_no if u.rider_profile else None,
            "zone_name": u.rider_profile.zone_name if u.rider_profile else None,
            "is_verified": u.rider_profile.is_verified if u.rider_profile else False,
            "is_online": u.rider_profile.is_online if u.rider_profile else False,
            "credit_limit": u.rider_profile.credit_limit if u.rider_profile else 1500.0,
            "balance_due_to_admin": u.rider_profile.balance_due_to_admin if u.rider_profile else 0.0,
            "custom_commission_type": u.rider_profile.custom_commission_type if u.rider_profile else None,
            "custom_commission_value": u.rider_profile.custom_commission_value if u.rider_profile else None,
            "total_trips": u.rider_profile.total_trips if u.rider_profile else 0,
            "total_gross_collected": u.rider_profile.total_gross_collected if u.rider_profile else 0.0,
            "total_net_earned": u.rider_profile.total_net_earned if u.rider_profile else 0.0,
            "total_commission_generated": u.rider_profile.total_commission_generated if u.rider_profile else 0.0,
            "total_settled_to_admin": u.rider_profile.total_settled_to_admin if u.rider_profile else 0.0,
            "rating_avg": u.rider_profile.rating_avg if u.rider_profile else 5.0,
        }
        for u in riders
    ]


@router.post("/riders", status_code=status.HTTP_201_CREATED)
def admin_create_rider(
    payload: AdminCreateRider,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    clean_phone = payload.phone.strip()
    if db.query(User).filter(User.phone == clean_phone).first():
        raise HTTPException(status_code=400, detail="Phone number already registered")

    user = User(
        full_name=payload.full_name.strip(),
        phone=clean_phone,
        password_hash=hash_password(payload.password),
        role="rider",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    rp = RiderProfile(
        user_id=user.id,
        cnic_number=payload.cnic_number,
        bike_model=payload.bike_model,
        bike_plate=payload.bike_plate.strip().upper(),
        license_no=payload.license_no,
        zone_name=payload.zone_name,
        credit_limit=payload.credit_limit,
        custom_commission_type=payload.custom_commission_type,
        custom_commission_value=payload.custom_commission_value,
        is_verified=payload.is_verified,
        is_online=False,
    )
    db.add(rp)
    db.commit()
    return {"id": user.id, "full_name": user.full_name, "phone": user.phone, "bike_plate": rp.bike_plate}


@router.patch("/riders/{rider_user_id}")
def update_rider_config(
    rider_user_id: int,
    payload: RiderConfigUpdate,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == rider_user_id, User.role == "rider").first()
    if not user or not user.rider_profile:
        raise HTTPException(status_code=404, detail="Rider not found")
    rp = user.rider_profile

    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
    if payload.phone is not None and payload.phone.strip() != user.phone:
        if db.query(User).filter(User.phone == payload.phone.strip(), User.id != user.id).first():
            raise HTTPException(status_code=400, detail="Phone already registered to another user")
        user.phone = payload.phone.strip()
    if payload.cnic_number is not None:
        rp.cnic_number = payload.cnic_number
    if payload.bike_model is not None:
        rp.bike_model = payload.bike_model
    if payload.bike_plate is not None:
        rp.bike_plate = payload.bike_plate.strip().upper()
    if payload.license_no is not None:
        rp.license_no = payload.license_no
    if payload.is_verified is not None:
        rp.is_verified = payload.is_verified
    if payload.is_active is not None:
        user.is_active = payload.is_active
        if not payload.is_active:
            rp.is_online = False
    if payload.zone_name is not None:
        rp.zone_name = payload.zone_name
    if payload.credit_limit is not None:
        rp.credit_limit = payload.credit_limit
    if payload.custom_commission_type == "none":
        rp.custom_commission_type = None
        rp.custom_commission_value = None
    elif payload.custom_commission_type in ("percent", "fixed"):
        rp.custom_commission_type = payload.custom_commission_type
        if payload.custom_commission_value is not None:
            rp.custom_commission_value = payload.custom_commission_value
    elif payload.custom_commission_value is not None and rp.custom_commission_type:
        rp.custom_commission_value = payload.custom_commission_value

    db.commit()
    return {"status": "updated", "rider_id": user.id}


@router.delete("/riders/{rider_user_id}")
def delete_rider(
    rider_user_id: int,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == rider_user_id, User.role == "rider").first()
    if not user:
        raise HTTPException(status_code=404, detail="Rider not found")
    db.query(Booking).filter(Booking.rider_id == rider_user_id).update({"rider_id": None})
    db.query(LedgerEntry).filter(LedgerEntry.rider_id == rider_user_id).delete()
    db.query(LedgerEntry).filter(LedgerEntry.recorded_by_id == rider_user_id).update({"recorded_by_id": current_user.id})
    db.query(SupportTicket).filter(SupportTicket.user_id == rider_user_id).delete()
    db.delete(user)
    db.commit()
    return {"deleted": rider_user_id}


@router.get("/customers")
def list_customers(
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    customers = (
        db.query(User)
        .filter(User.role == "customer")
        .order_by(User.created_at.desc())
        .all()
    )
    counts = dict(
        db.query(Booking.customer_id, func.count(Booking.id))
        .group_by(Booking.customer_id)
        .all()
    )
    spent = dict(
        db.query(Booking.customer_id, func.coalesce(func.sum(Booking.final_fare), 0.0))
        .filter(Booking.status == "completed")
        .group_by(Booking.customer_id)
        .all()
    )
    return [
        {
            "id": c.id,
            "full_name": c.full_name,
            "phone": c.phone,
            "email": c.email,
            "is_active": c.is_active,
            "total_bookings": counts.get(c.id, 0),
            "total_spent": round(float(spent.get(c.id, 0.0)), 2),
            "created_at": c.created_at,
        }
        for c in customers
    ]


@router.post("/customers", status_code=status.HTTP_201_CREATED)
def admin_create_customer(
    payload: AdminCustomerCreate,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    clean_phone = payload.phone.strip()
    if db.query(User).filter(User.phone == clean_phone).first():
        raise HTTPException(status_code=400, detail="Phone number already registered")
    if payload.email and db.query(User).filter(User.email == payload.email.strip()).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    c = User(
        full_name=payload.full_name.strip(),
        phone=clean_phone,
        email=payload.email.strip() if payload.email else None,
        password_hash=hash_password(payload.password),
        role="customer",
        is_active=True,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return {"id": c.id, "full_name": c.full_name, "phone": c.phone}


@router.patch("/customers/{user_id}")
def admin_update_customer(
    user_id: int,
    payload: AdminCustomerUpdate,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id, User.role == "customer").first()
    if not user:
        raise HTTPException(status_code=404, detail="Customer not found")
    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
    if payload.phone is not None and payload.phone.strip() != user.phone:
        if db.query(User).filter(User.phone == payload.phone.strip(), User.id != user.id).first():
            raise HTTPException(status_code=400, detail="Phone number already in use")
        user.phone = payload.phone.strip()
    if payload.email is not None:
        clean_email = payload.email.strip() or None
        if clean_email and db.query(User).filter(User.email == clean_email, User.id != user.id).first():
            raise HTTPException(status_code=400, detail="Email already in use")
        user.email = clean_email
    if payload.is_active is not None:
        user.is_active = payload.is_active
    db.commit()
    return {"id": user.id, "full_name": user.full_name, "phone": user.phone, "is_active": user.is_active}


@router.delete("/customers/{user_id}")
def admin_delete_customer(
    user_id: int,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id, User.role == "customer").first()
    if not user:
        raise HTTPException(status_code=404, detail="Customer not found")
    cust_bookings = db.query(Booking).filter(Booking.customer_id == user_id).all()
    affected_riders = {b.rider_id for b in cust_bookings if b.rider_id}
    booking_ids = [b.id for b in cust_bookings]
    if booking_ids:
        db.query(SupportTicket).filter(SupportTicket.booking_id.in_(booking_ids)).update({"booking_id": None})
        db.query(LedgerEntry).filter(LedgerEntry.booking_id.in_(booking_ids)).delete()
        db.query(Booking).filter(Booking.id.in_(booking_ids)).delete()
    db.query(SupportTicket).filter(SupportTicket.user_id == user_id).delete()
    db.delete(user)
    db.commit()
    for r_id in affected_riders:
        recalculate_rider_ledger_balances(db, r_id)
    return {"deleted": user_id}


@router.patch("/customers/{user_id}/toggle-active")
def toggle_customer_active(
    user_id: int,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id, User.role == "customer").first()
    if not user:
        raise HTTPException(status_code=404, detail="Customer not found")
    user.is_active = not user.is_active
    db.commit()
    return {"id": user.id, "is_active": user.is_active}


@router.get("/pricing")
def get_all_pricing(
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    rules = db.query(PricingRule).order_by(PricingRule.id.asc()).all()
    return [
        {
            "id": r.id,
            "service_type": r.service_type,
            "display_name": r.display_name,
            "base_fare": r.base_fare,
            "per_km_rate": r.per_km_rate,
            "min_fare": r.min_fare,
            "commission_type": r.commission_type,
            "commission_value": r.commission_value,
            "peak_multiplier": r.peak_multiplier,
            "is_active": r.is_active,
            "updated_at": r.updated_at,
        }
        for r in rules
    ]


@router.patch("/pricing/{service_type}")
def update_pricing_rule(
    service_type: str,
    payload: PricingRuleUpdate,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    rule = db.query(PricingRule).filter(PricingRule.service_type == service_type).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Pricing rule not found")

    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(rule, field, val)
    db.commit()
    db.refresh(rule)
    return {
        "service_type": rule.service_type,
        "display_name": rule.display_name,
        "base_fare": rule.base_fare,
        "per_km_rate": rule.per_km_rate,
        "min_fare": rule.min_fare,
        "commission_type": rule.commission_type,
        "commission_value": rule.commission_value,
        "peak_multiplier": rule.peak_multiplier,
        "is_active": rule.is_active,
    }


@router.get("/zones")
def admin_list_zones(
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    return db.query(MansehraZone).order_by(MansehraZone.name.asc()).all()


@router.post("/zones", status_code=status.HTTP_201_CREATED)
def admin_create_zone(
    payload: ZoneCreate,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    if db.query(MansehraZone).filter(MansehraZone.name == payload.name.strip()).first():
        raise HTTPException(status_code=400, detail="Zone already exists")
    z = MansehraZone(
        name=payload.name.strip(),
        area_tag=payload.area_tag,
        approx_km_from_center=payload.approx_km_from_center,
        surcharge=payload.surcharge,
        is_active=True,
    )
    db.add(z)
    db.commit()
    db.refresh(z)
    return z


@router.patch("/zones/{zone_id}")
def admin_update_zone(
    zone_id: int,
    payload: ZoneUpdate,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    z = db.query(MansehraZone).filter(MansehraZone.id == zone_id).first()
    if not z:
        raise HTTPException(status_code=404, detail="Zone not found")
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(z, field, val.strip() if isinstance(val, str) else val)
    db.commit()
    db.refresh(z)
    return z


@router.delete("/zones/{zone_id}")
def admin_delete_zone(
    zone_id: int,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    z = db.query(MansehraZone).filter(MansehraZone.id == zone_id).first()
    if not z:
        raise HTTPException(status_code=404, detail="Zone not found")
    db.delete(z)
    db.commit()
    return {"deleted": zone_id}


@router.get("/promos")
def admin_list_promos(
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    return db.query(PromoCode).order_by(PromoCode.created_at.desc()).all()


@router.post("/promos", status_code=status.HTTP_201_CREATED)
def admin_create_promo(
    payload: PromoCreate,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    code = payload.code.strip().upper()
    if db.query(PromoCode).filter(PromoCode.code == code).first():
        raise HTTPException(status_code=400, detail="Promo code already exists")
    p = PromoCode(
        code=code,
        discount_type=payload.discount_type,
        discount_value=payload.discount_value,
        max_discount=payload.max_discount,
        min_fare=payload.min_fare,
        is_active=True,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.patch("/promos/{promo_id}")
def admin_update_promo(
    promo_id: int,
    payload: PromoUpdate,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    p = db.query(PromoCode).filter(PromoCode.id == promo_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Promo not found")
    for field, val in payload.model_dump(exclude_unset=True).items():
        if field == "code" and val:
            val = val.strip().upper()
        setattr(p, field, val)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/promos/{promo_id}")
def admin_delete_promo(
    promo_id: int,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    p = db.query(PromoCode).filter(PromoCode.id == promo_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Promo not found")
    db.delete(p)
    db.commit()
    return {"deleted": promo_id}


@router.patch("/promos/{promo_id}/toggle")
def admin_toggle_promo(
    promo_id: int,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    p = db.query(PromoCode).filter(PromoCode.id == promo_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Promo not found")
    p.is_active = not p.is_active
    db.commit()
    return {"id": p.id, "is_active": p.is_active}


@router.get("/tickets")
def admin_list_tickets(
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(SupportTicket)
        .options(joinedload(SupportTicket.user))
        .order_by(SupportTicket.created_at.desc())
        .all()
    )
    return [
        {
            "id": t.id,
            "user_name": t.user.full_name if t.user else "User",
            "user_phone": t.user.phone if t.user else "",
            "user_role": t.user.role if t.user else "",
            "booking_id": t.booking_id,
            "subject": t.subject,
            "category": t.category,
            "message": t.message,
            "status": t.status,
            "admin_reply": t.admin_reply,
            "created_at": t.created_at,
        }
        for t in rows
    ]


@router.patch("/tickets/{ticket_id}")
def admin_reply_ticket(
    ticket_id: int,
    payload: SupportTicketReply,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    t = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    t.status = payload.status
    t.admin_reply = payload.admin_reply
    db.commit()
    return {"id": t.id, "status": t.status, "admin_reply": t.admin_reply}


@router.delete("/tickets/{ticket_id}")
def admin_delete_ticket(
    ticket_id: int,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    t = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    db.delete(t)
    db.commit()
    return {"deleted": ticket_id}


@router.get("/releases")
def admin_list_releases(
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    return db.query(AppRelease).order_by(AppRelease.created_at.desc()).all()


@router.post("/releases", status_code=status.HTTP_201_CREATED)
def admin_create_release(
    payload: ReleaseCreate,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    if payload.is_latest:
        db.query(AppRelease).filter(AppRelease.platform == payload.platform).update(
            {"is_latest": False}
        )
    rel = AppRelease(**payload.model_dump())
    db.add(rel)
    db.commit()
    db.refresh(rel)
    return rel


@router.patch("/releases/{release_id}")
def admin_update_release(
    release_id: int,
    payload: ReleaseUpdate,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    rel = db.query(AppRelease).filter(AppRelease.id == release_id).first()
    if not rel:
        raise HTTPException(status_code=404, detail="Release not found")
    updates = payload.model_dump(exclude_unset=True)
    if updates.get("is_latest"):
        target_platform = updates.get("platform", rel.platform)
        db.query(AppRelease).filter(AppRelease.platform == target_platform).update({"is_latest": False})
    for field, val in updates.items():
        setattr(rel, field, val)
    db.commit()
    db.refresh(rel)
    return rel


@router.delete("/releases/{release_id}")
def admin_delete_release(
    release_id: int,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    rel = db.query(AppRelease).filter(AppRelease.id == release_id).first()
    if not rel:
        raise HTTPException(status_code=404, detail="Release not found")
    db.delete(rel)
    db.commit()
    return {"deleted": release_id}


@router.get("/settings")
def admin_list_settings(
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    return {s.key: s.value for s in db.query(SystemSetting).all()}


@router.put("/settings/{key}")
def admin_update_setting(
    key: str,
    payload: SystemSettingUpdate,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    s = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if not s:
        s = SystemSetting(key=key, value=payload.value)
        db.add(s)
    else:
        s.value = payload.value
    db.commit()
    return {"key": s.key, "value": s.value}
