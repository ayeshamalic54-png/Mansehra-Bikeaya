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
    User,
)


def utcnow():
    return datetime.now(timezone.utc)


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


def estimate_booking_fare(
    db: Session,
    service_type: str,
    pickup_zone_name: str,
    drop_zone_name: str,
    distance_km: float,
    promo_code: Optional[str] = None,
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

    distance_charge = round(distance_km * rule.per_km_rate, 2)
    subtotal = round((rule.base_fare + distance_charge + zone_surcharge) * rule.peak_multiplier, 2)
    raw_fare = max(rule.min_fare, subtotal)

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

    final_fare = float(round(final_fare_override if final_fare_override is not None else booking.final_fare))
    c_type, c_val, commission_amount, rider_earning = compute_commission(
        final_fare, rule, rider_profile
    )

    if payment_collector_override:
        collector = payment_collector_override
    else:
        collector = "rider" if booking.payment_method == "cash" else "admin"

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
    rider_profile.total_commission_generated = round(
        rider_profile.total_commission_generated + commission_amount, 2
    )

    if collector == "rider":
        # Rider collected full cash from customer -> rider owes admin the commission amount
        signed_delta = commission_amount
        entry_type = "commission_due"
        ledger_amount = commission_amount
        note = f"Ride {booking.booking_code}: Cash collected Rs.{final_fare:.0f}, Admin commission due Rs.{commission_amount:.2f}"
    else:
        # Admin collected digital payment -> admin owes rider their net earning
        signed_delta = -rider_earning
        entry_type = "digital_payout_credit"
        ledger_amount = rider_earning
        note = f"Ride {booking.booking_code}: Digital payment to Admin Rs.{final_fare:.0f}, Rider earning credit Rs.{rider_earning:.2f}"

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
        default_note = f"Rider paid Rs.{clean_amount:.2f} commission via {payment_channel}"
    elif entry_type == "payout_to_rider":
        signed_delta = clean_amount
        default_note = f"Admin paid Rs.{clean_amount:.2f} digital payout to rider via {payment_channel}"
    elif entry_type == "adjustment_reduce":
        signed_delta = -clean_amount
        default_note = f"Admin reduced rider due by Rs.{clean_amount:.2f}"
    else:  # adjustment_add
        signed_delta = clean_amount
        default_note = f"Admin added rider due of Rs.{clean_amount:.2f}"

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
