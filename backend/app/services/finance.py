import math
from datetime import datetime, timezone
from typing import Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models import (
    Booking,
    LedgerEntry,
    MansehraZone,
    PricingRule,
    PromoCode,
    RiderProfile,
    RiderTopupRequest,
    SystemSetting,
    User,
)


def utcnow():
    return datetime.now(timezone.utc)


def _parse_bool_setting(val: Optional[str], default: bool = True) -> bool:
    if val is None or not str(val).strip():
        return default
    return str(val).strip().lower() in ("1", "true", "yes", "on")


def get_topup_policy(db: Session, vehicle_type: Optional[str] = None) -> dict:
    """Read live Admin-configured prepaid Ride Top-Up package rules."""
    keys = (
        "rider_topup_required",
        "rider_topup_rides_count",
        "rider_topup_package_fee",
        "rider_topup_car_package_fee",
    )
    rows = {s.key: s.value for s in db.query(SystemSetting).filter(SystemSetting.key.in_(keys)).all()}
    required = _parse_bool_setting(rows.get("rider_topup_required"), default=True)
    try:
        rides_count = max(1, int(float(rows.get("rider_topup_rides_count") or 10)))
    except ValueError:
        rides_count = 10
    try:
        base_fee = max(1.0, float(rows.get("rider_topup_package_fee") or 100.0))
    except ValueError:
        base_fee = 100.0

    package_fee = base_fee
    if (vehicle_type or "").lower() == "car":
        raw_car = (rows.get("rider_topup_car_package_fee") or "").strip()
        if raw_car:
            try:
                car_fee = float(raw_car)
                if car_fee > 0:
                    package_fee = car_fee
            except ValueError:
                pass

    return {
        "required": required,
        "rides_count": rides_count,
        "package_fee": round(package_fee, 2),
        "per_ride_fee": round(package_fee / rides_count, 2),
    }


def can_captain_work(db: Session, rp: RiderProfile) -> tuple[bool, Optional[str]]:
    """Shared eligibility guard checking verification, prepaid top-up rides, and credit cap."""
    if not rp.is_verified:
        return (
            False,
            "Please upload your Selfie, Vehicle Photo & CNIC in Profile and wait for Admin verification first.",
        )
    policy = get_topup_policy(db, rp.vehicle_type)
    if policy["required"] and int(rp.remaining_paid_rides or 0) <= 0:
        return (
            False,
            (
                f"Top-Up Required (0 Rides Left): Kaam start karne ke liye pehle {policy['rides_count']} Rides ka "
                f"Rs. {policy['package_fee']:.0f} Top-Up SafarGo account par bhej kar Admin approval lein."
            ),
        )
    if float(rp.balance_due_to_admin or 0.0) > float(rp.credit_limit or 0.0):
        return (
            False,
            (
                f"Unpaid commission due (Rs. {rp.balance_due_to_admin:.0f}) exceeds "
                f"your limit (Rs. {rp.credit_limit:.0f}). Please settle with SafarGo first."
            ),
        )
    return True, None


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in kilometers between two WGS84 coordinates."""
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(2 * r * math.asin(min(1.0, math.sqrt(a))), 2)


def captain_matches_service(vehicle_type: Optional[str], service_type: str) -> bool:
    vtype = (vehicle_type or "bike").lower()
    if service_type == "car_ride":
        return vtype == "car"
    if service_type == "bike_ride":
        return vtype == "bike"
    return True


def resolve_nearest_zone_name(
    db: Session,
    lat: float,
    lng: float,
    max_km: float = 25.0,
) -> Optional[str]:
    """Find closest active Mansehra/Hazara landmark or zone for given live GPS coordinates."""
    zones = db.query(MansehraZone).filter(MansehraZone.is_active.is_(True)).all()
    best_name = None
    best_dist = max_km
    for z in zones:
        if z.lat is None or z.lng is None:
            continue
        d = haversine_km(lat, lng, z.lat, z.lng)
        if d <= best_dist:
            # Prefer exact Chowk/Road names over broader town entries when tied at same spot
            if best_name is None or d < best_dist - 0.05 or ("Chowk" in z.name and "Chowk" not in best_name):
                best_dist = d
                best_name = z.name
    return best_name


def find_nearest_captains_for_booking(
    db: Session,
    service_type: str,
    pickup_lat: Optional[float],
    pickup_lng: Optional[float],
    pickup_zone: Optional[str] = None,
    limit: int = 3,
    include_phone: bool = False,
) -> list[dict]:
    """Return nearest online verified matching Captains ranked ascending by live GPS distance."""
    p_lat, p_lng = pickup_lat, pickup_lng
    if (p_lat is None or p_lng is None) and pickup_zone:
        z = db.query(MansehraZone).filter(MansehraZone.name == pickup_zone).first()
        if z and z.lat is not None and z.lng is not None:
            p_lat, p_lng = z.lat, z.lng
    if p_lat is None or p_lng is None:
        return []

    from sqlalchemy.orm import joinedload

    topup_setting = db.query(SystemSetting).filter(SystemSetting.key == "rider_topup_required").first()
    topup_required = _parse_bool_setting(topup_setting.value if topup_setting else None, default=True)

    captains = (
        db.query(User)
        .options(joinedload(User.rider_profile))
        .filter(User.role == "rider", User.is_active.is_(True))
        .all()
    )
    ranked = []
    for u in captains:
        rp = u.rider_profile
        if not rp or not rp.is_verified or not rp.is_online:
            continue
        if topup_required and int(rp.remaining_paid_rides or 0) <= 0:
            continue
        if rp.balance_due_to_admin > rp.credit_limit:
            continue
        if not captain_matches_service(rp.vehicle_type, service_type):
            continue
        if rp.current_lat is None or rp.current_lng is None:
            continue
        dist = haversine_km(rp.current_lat, rp.current_lng, p_lat, p_lng)
        row = {
            "rider_id": u.id,
            "full_name": u.full_name,
            "vehicle_type": rp.vehicle_type or "bike",
            "bike_model": rp.bike_model,
            "bike_plate": rp.bike_plate,
            "zone_name": rp.zone_name,
            "distance_km": dist,
            "eta_min": max(2, int(round(dist / 0.45))),
        }
        if include_phone:
            row["phone"] = u.phone
        ranked.append(row)
    ranked.sort(key=lambda item: (item["distance_km"], item["rider_id"]))
    return ranked[:limit]


def compute_commission(
    final_fare: float,
    pricing_rule: PricingRule,
    rider_profile: Optional[RiderProfile] = None,
) -> tuple[str, float, float, float]:
    """
    Determine the effective commission rule (per-rider override if set, else global service rule)
    and return (commission_type, commission_value, commission_amount, rider_earning).
    """
    if (
        rider_profile is not None
        and rider_profile.custom_commission_type in ("percent", "fixed")
        and rider_profile.custom_commission_value is not None
    ):
        c_type = rider_profile.custom_commission_type
        c_val = float(rider_profile.custom_commission_value)
    else:
        c_type = pricing_rule.commission_type
        c_val = float(pricing_rule.commission_value)

    if c_type == "percent":
        commission_amount = round(final_fare * (c_val / 100.0), 2)
    else:
        commission_amount = round(min(final_fare, c_val), 2)

    rider_earning = round(max(0.0, final_fare - commission_amount), 2)
    return c_type, c_val, commission_amount, rider_earning


def is_mansehra_in_city_zone(zone: Optional[MansehraZone]) -> bool:
    if not zone:
        return False
    name = (zone.name or "").strip()
    tag = (zone.area_tag or "").strip()
    if name.startswith(("Abbottabad —", "Abbottabad (", "Haripur", "Battagram", "Islamabad")):
        return False
    if tag.startswith("Abbottabad") or tag in ("Intercity Hub", "Airport Transfer", "Galyat Hills"):
        return False
    return float(zone.approx_km_from_center or 0.0) <= 8.0


def apply_wait_charge_to_booking(
    booking: Booking,
    rule: Optional[PricingRule],
    wait_minutes_override: Optional[int] = None,
) -> float:
    """Compute wait/late fee after free grace minutes and apply delta to final_fare once."""
    if wait_minutes_override is not None:
        effective_wait = max(0, int(wait_minutes_override))
    elif booking.wait_minutes and booking.wait_minutes > 0:
        effective_wait = int(booking.wait_minutes)
    elif booking.arrived_at is not None:
        arrived_utc = booking.arrived_at if booking.arrived_at.tzinfo else booking.arrived_at.replace(tzinfo=timezone.utc)
        effective_wait = max(0, int((utcnow() - arrived_utc).total_seconds() // 60))
    else:
        effective_wait = int(booking.wait_minutes or 0)

    if rule:
        free_mins = int(rule.wait_free_minutes or 0)
        rate_per_min = float(rule.wait_charge_per_min or 0.0)
        new_wait_charge = round(max(0, effective_wait - free_mins) * rate_per_min, 2)
    else:
        new_wait_charge = float(booking.wait_charge or 0.0)

    delta = round(new_wait_charge - float(booking.wait_charge or 0.0), 2)
    booking.wait_minutes = effective_wait
    booking.wait_charge = new_wait_charge
    if delta != 0.0:
        booking.final_fare = float(round(max(10.0, float(booking.final_fare or 0.0) + delta)))
    return new_wait_charge


def estimate_booking_fare(
    db: Session,
    service_type: str,
    pickup_zone_name: str,
    drop_zone_name: str,
    distance_km: float,
    promo_code: Optional[str] = None,
    wait_minutes: int = 0,
) -> dict:
    rule = (
        db.query(PricingRule)
        .filter(PricingRule.service_type == service_type, PricingRule.is_active.is_(True))
        .first()
    )
    if not rule:
        raise HTTPException(status_code=404, detail=f"Active pricing rule not found for {service_type}")

    p_zone = db.query(MansehraZone).filter(MansehraZone.name == pickup_zone_name).first()
    d_zone = db.query(MansehraZone).filter(MansehraZone.name == drop_zone_name).first()
    zone_surcharge = round(
        (p_zone.surcharge if p_zone else 0.0) + (d_zone.surcharge if d_zone else 0.0), 2
    )

    flat_km = float(getattr(rule, "city_flat_km", 0.0) or 0.0)
    flat_fare = float(getattr(rule, "city_flat_fare", 0.0) or 0.0)
    city_slab_applied = bool(
        flat_fare > 0
        and flat_km > 0
        and is_mansehra_in_city_zone(p_zone)
        and is_mansehra_in_city_zone(d_zone)
    )

    if city_slab_applied:
        if distance_km <= flat_km:
            base_plus_distance = round(flat_fare, 2)
        else:
            base_plus_distance = round(flat_fare + (distance_km - flat_km) * rule.per_km_rate, 2)
        distance_charge = round(max(0.0, base_plus_distance - rule.base_fare), 2)
        subtotal = round((base_plus_distance + zone_surcharge) * rule.peak_multiplier, 2)
    else:
        distance_charge = round(distance_km * rule.per_km_rate, 2)
        subtotal = round((rule.base_fare + distance_charge + zone_surcharge) * rule.peak_multiplier, 2)

    free_wait = int(getattr(rule, "wait_free_minutes", 5) or 0)
    wait_rate = float(getattr(rule, "wait_charge_per_min", 10.0) or 0.0)
    clean_wait = max(0, int(wait_minutes or 0))
    billable_wait_minutes = max(0, clean_wait - free_wait)
    wait_charge = round(billable_wait_minutes * wait_rate, 2)

    raw_fare = max(rule.min_fare, subtotal) + wait_charge

    discount_amount = 0.0
    applied_promo = None
    if promo_code:
        clean_code = promo_code.strip().upper()
        promo = (
            db.query(PromoCode)
            .filter(PromoCode.code == clean_code, PromoCode.is_active.is_(True))
            .first()
        )
        if not promo:
            raise HTTPException(status_code=400, detail="Invalid or inactive promo code")
        if raw_fare < promo.min_fare:
            raise HTTPException(
                status_code=400,
                detail=f"Promo {clean_code} requires minimum fare of Rs. {promo.min_fare:.0f}",
            )
        if promo.discount_type == "percent":
            discount_amount = min(promo.max_discount, round(raw_fare * (promo.discount_value / 100.0), 2))
        else:
            discount_amount = min(promo.max_discount, promo.discount_value)
        applied_promo = clean_code

    estimated_fare = float(round(max(rule.min_fare, raw_fare - discount_amount)))
    c_type, c_val, est_commission, est_rider_earning = compute_commission(estimated_fare, rule, None)

    return {
        "service_type": service_type,
        "display_name": rule.display_name,
        "base_fare": rule.base_fare,
        "per_km_rate": rule.per_km_rate,
        "distance_km": distance_km,
        "distance_charge": distance_charge,
        "zone_surcharge": zone_surcharge,
        "peak_multiplier": rule.peak_multiplier,
        "city_slab_applied": city_slab_applied,
        "city_flat_km": flat_km,
        "city_flat_fare": flat_fare,
        "wait_free_minutes": free_wait,
        "wait_charge_per_min": wait_rate,
        "wait_minutes": clean_wait,
        "billable_wait_minutes": billable_wait_minutes,
        "wait_charge": wait_charge,
        "discount_amount": discount_amount,
        "applied_promo": applied_promo,
        "estimated_fare": estimated_fare,
        "commission_type": c_type,
        "commission_value": c_val,
        "estimated_commission": est_commission,
        "estimated_rider_earning": est_rider_earning,
    }


def complete_booking_and_post_ledger(
    db: Session,
    booking: Booking,
    actor: User,
    final_fare_override: Optional[float] = None,
    payment_collector_override: Optional[str] = None,
    wait_minutes_override: Optional[int] = None,
) -> Booking:
    if booking.status == "completed":
        raise HTTPException(status_code=400, detail="Booking is already completed")
    if booking.status == "cancelled":
        raise HTTPException(status_code=400, detail="Cancelled booking cannot be completed")
    if not booking.rider_id:
        raise HTTPException(status_code=400, detail="Cannot complete booking without an assigned rider")

    rider_profile = db.query(RiderProfile).filter(RiderProfile.user_id == booking.rider_id).first()
    if not rider_profile:
        raise HTTPException(status_code=404, detail="Assigned rider profile missing")

    rule = db.query(PricingRule).filter(PricingRule.service_type == booking.service_type).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Pricing rule missing")

    if final_fare_override is not None:
        final_fare = float(round(final_fare_override))
    else:
        apply_wait_charge_to_booking(booking, rule, wait_minutes_override=wait_minutes_override)
        final_fare = float(round(booking.final_fare))

    if payment_collector_override:
        collector = payment_collector_override
    else:
        collector = "rider" if booking.payment_method == "cash" else "admin"

    policy = get_topup_policy(db, rider_profile.vehicle_type)
    use_prepaid_ride = bool(policy["required"]) and int(rider_profile.remaining_paid_rides or 0) > 0

    if use_prepaid_ride:
        unit_fee = round(min(final_fare, float(rider_profile.topup_per_ride_fee or policy["per_ride_fee"] or 10.0)), 2)
        commission_amount = 0.0
        rider_earning = round(final_fare, 2)
        c_type = "app_fee_topup"
        c_val = unit_fee
        rider_profile.remaining_paid_rides = max(0, int(rider_profile.remaining_paid_rides or 0) - 1)
        rider_profile.topup_wallet_balance = round(
            max(0.0, float(rider_profile.topup_wallet_balance or 0.0) - unit_fee), 2
        )
    else:
        c_type, c_val, commission_amount, rider_earning = compute_commission(
            final_fare, rule, rider_profile
        )

    booking.final_fare = final_fare
    booking.commission_type_snapshot = c_type
    booking.commission_rate_snapshot = c_val
    booking.commission_amount = commission_amount
    booking.rider_earning = rider_earning
    booking.payment_collector = collector
    booking.status = "completed"
    booking.completed_at = utcnow()

    rider_profile.total_trips += 1
    rider_profile.total_gross_collected = round(rider_profile.total_gross_collected + final_fare, 2)
    rider_profile.total_net_earned = round(rider_profile.total_net_earned + rider_earning, 2)
    if not use_prepaid_ride:
        rider_profile.total_commission_generated = round(
            rider_profile.total_commission_generated + commission_amount, 2
        )

    if collector == "rider":
        if use_prepaid_ride:
            signed_delta = 0.0
            entry_type = "topup_ride_deduction"
            ledger_amount = unit_fee
            booking.payment_status = "paid"
            note = (
                f"Ride {booking.booking_code}: Pre-Paid App Fee (-1 Ride / Rs.{unit_fee:.2f} from Top-Up, "
                f"0 Commission · {rider_profile.remaining_paid_rides} rides left)"
            )
        else:
            # Post-paid cash ride: rider owes admin the commission amount
            signed_delta = commission_amount
            entry_type = "commission_due"
            ledger_amount = commission_amount
            booking.payment_status = "paid"
            note = f"Ride {booking.booking_code}: Cash collected Rs.{final_fare:.0f}, SafarGo commission Rs.{commission_amount:.2f}"
    else:
        # Digital payment to SafarGo -> admin owes rider their net earning
        signed_delta = -rider_earning
        entry_type = "digital_payout_credit"
        ledger_amount = rider_earning
        if use_prepaid_ride:
            note = (
                f"Ride {booking.booking_code}: Digital payment to SafarGo Rs.{final_fare:.0f}, "
                f"-1 Pre-Paid Ride (0 Commission), Captain credit Rs.{rider_earning:.2f}"
            )
        else:
            note = f"Ride {booking.booking_code}: Digital payment to SafarGo Rs.{final_fare:.0f}, Captain credit Rs.{rider_earning:.2f}"

    if policy["required"] and int(rider_profile.remaining_paid_rides or 0) <= 0:
        other_active = (
            db.query(Booking.id)
            .filter(
                Booking.rider_id == rider_profile.user_id,
                Booking.id != booking.id,
                Booking.status.in_(("assigned", "arrived", "in_progress")),
            )
            .first()
        )
        if not other_active:
            rider_profile.is_online = False

    new_balance = round(rider_profile.balance_due_to_admin + signed_delta, 2)
    rider_profile.balance_due_to_admin = new_balance

    ledger = LedgerEntry(
        rider_id=booking.rider_id,
        booking_id=booking.id,
        entry_type=entry_type,
        amount=ledger_amount,
        signed_delta=signed_delta,
        balance_after=new_balance,
        payment_channel=booking.payment_method,
        reference_no=booking.booking_code,
        note=note,
        recorded_by_id=actor.id,
    )
    db.add(ledger)
    db.commit()
    db.refresh(booking)
    return booking


def post_rider_settlement(
    db: Session,
    rider_profile: RiderProfile,
    amount: float,
    entry_type: str,
    payment_channel: str,
    reference_no: Optional[str],
    note: Optional[str],
    admin_user: User,
) -> LedgerEntry:
    clean_amount = round(float(amount), 2)
    if entry_type == "settlement_to_admin":
        signed_delta = -clean_amount
        rider_profile.total_settled_to_admin = round(rider_profile.total_settled_to_admin + clean_amount, 2)
        default_note = f"Captain paid Rs.{clean_amount:.2f} commission to SafarGo via {payment_channel} (Paid)"
    elif entry_type == "payout_to_rider":
        signed_delta = clean_amount
        default_note = f"SafarGo paid Rs.{clean_amount:.2f} payout to captain via {payment_channel} (Paid)"
    elif entry_type == "adjustment_reduce":
        signed_delta = -clean_amount
        default_note = f"SafarGo reduced due by Rs.{clean_amount:.2f}"
    else:  # adjustment_add
        signed_delta = clean_amount
        default_note = f"SafarGo added due of Rs.{clean_amount:.2f}"

    new_balance = round(rider_profile.balance_due_to_admin + signed_delta, 2)
    rider_profile.balance_due_to_admin = new_balance

    entry = LedgerEntry(
        rider_id=rider_profile.user_id,
        booking_id=None,
        entry_type=entry_type,
        amount=clean_amount,
        signed_delta=signed_delta,
        balance_after=new_balance,
        payment_channel=payment_channel,
        reference_no=reference_no,
        note=note or default_note,
        recorded_by_id=admin_user.id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def recalculate_rider_ledger_balances(db: Session, rider_id: int) -> None:
    """Recompute chronological ledger balances and rider summary totals after any admin edit/delete."""
    rp = db.query(RiderProfile).filter(RiderProfile.user_id == rider_id).first()
    if not rp:
        return

    completed_bookings = (
        db.query(Booking)
        .filter(Booking.rider_id == rider_id, Booking.status == "completed")
        .all()
    )
    rp.total_trips = len(completed_bookings)
    rp.total_gross_collected = round(sum(b.final_fare for b in completed_bookings), 2)
    rp.total_net_earned = round(sum(b.rider_earning for b in completed_bookings), 2)
    rp.total_commission_generated = round(sum(b.commission_amount for b in completed_bookings), 2)

    entries = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.rider_id == rider_id)
        .order_by(LedgerEntry.created_at.asc(), LedgerEntry.id.asc())
        .all()
    )
    running = 0.0
    settled = 0.0
    for e in entries:
        running = round(running + e.signed_delta, 2)
        e.balance_after = running
        if e.entry_type == "settlement_to_admin":
            settled = round(settled + e.amount, 2)

    rp.balance_due_to_admin = running
    rp.total_settled_to_admin = settled
    db.commit()


def approve_rider_topup_request(
    db: Session,
    req: RiderTopupRequest,
    rider_profile: RiderProfile,
    admin_user: User,
    rides_override: Optional[int] = None,
    amount_override: Optional[float] = None,
    admin_note: Optional[str] = None,
) -> tuple[RiderTopupRequest, RiderProfile, LedgerEntry]:
    """Approve a pending Captain prepaid Top-Up request and credit rides + wallet balance."""
    rides_credit = int(rides_override or req.rides_requested or 10)
    if rides_credit <= 0:
        raise HTTPException(status_code=400, detail="Rides granted must be greater than 0")
    amt = round(float(amount_override if amount_override is not None else req.amount), 2)
    if amt <= 0:
        raise HTTPException(status_code=400, detail="Top-up amount must be greater than 0")

    per_ride = round(amt / rides_credit, 2)
    rider_profile.remaining_paid_rides = int(rider_profile.remaining_paid_rides or 0) + rides_credit
    rider_profile.topup_wallet_balance = round(float(rider_profile.topup_wallet_balance or 0.0) + amt, 2)
    rider_profile.topup_per_ride_fee = per_ride
    rider_profile.total_topups_paid = round(float(rider_profile.total_topups_paid or 0.0) + amt, 2)

    req.rides_requested = rides_credit
    req.amount = amt
    req.status = "approved"
    req.admin_note = admin_note.strip() if admin_note else req.admin_note
    req.approved_by_id = admin_user.id
    req.reviewed_at = utcnow()

    ref_txt = f" · Ref: {req.reference_no}" if req.reference_no else ""
    entry = LedgerEntry(
        rider_id=rider_profile.user_id,
        booking_id=None,
        entry_type="topup_approved",
        amount=amt,
        signed_delta=0.0,
        balance_after=rider_profile.balance_due_to_admin,
        payment_channel=req.payment_channel,
        reference_no=req.reference_no,
        note=(
            f"Top-Up Approved: +{rides_credit} Rides (Rs.{amt:.0f} via {req.payment_channel}{ref_txt})"
            + (f" — {admin_note.strip()}" if admin_note and admin_note.strip() else "")
        ),
        recorded_by_id=admin_user.id,
    )
    db.add(entry)
    db.commit()
    db.refresh(req)
    db.refresh(rider_profile)
    db.refresh(entry)
    return req, rider_profile, entry
