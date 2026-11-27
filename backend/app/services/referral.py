import random
import re
import string
from datetime import datetime, timezone
from typing import Optional
from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models import (
    Booking,
    LedgerEntry,
    ReferralRecord,
    RiderProfile,
    RiderTopupRequest,
    SystemSetting,
    User,
)


def _utcnow():
    return datetime.now(timezone.utc)


def _parse_bool(val: Optional[str], default: bool = True) -> bool:
    if val is None or not str(val).strip():
        return default
    return str(val).strip().lower() in ("1", "true", "yes", "on")


def get_referral_policy(db: Session) -> dict:
    """Read live Admin-controlled referral toggles and reward rules."""
    keys = (
        "referral_program_enabled",
        "referral_customer_enabled",
        "referral_captain_enabled",
        "referral_customer_friend_discount",
        "referral_customer_referrer_reward",
        "referral_customer_min_fare",
        "referral_captain_bonus_rides",
        "referral_max_per_user",
    )
    rows = {s.key: s.value for s in db.query(SystemSetting).filter(SystemSetting.key.in_(keys)).all()}
    program_enabled = _parse_bool(rows.get("referral_program_enabled"), default=True)
    customer_enabled = _parse_bool(rows.get("referral_customer_enabled"), default=True)
    captain_enabled = _parse_bool(rows.get("referral_captain_enabled"), default=True)

    def _num(k: str, default_val: float, minimum: float = 0.0) -> float:
        try:
            return max(minimum, float(rows.get(k) if rows.get(k) not in (None, "") else default_val))
        except ValueError:
            return default_val

    friend_discount = round(_num("referral_customer_friend_discount", 30.0, 0.0), 2)
    referrer_reward = round(_num("referral_customer_referrer_reward", 30.0, 0.0), 2)
    min_fare = round(_num("referral_customer_min_fare", 120.0, 0.0), 2)
    captain_bonus_rides = int(_num("referral_captain_bonus_rides", 5, 0))
    max_per_user = int(_num("referral_max_per_user", 20, 0))

    return {
        "program_enabled": program_enabled,
        "customer_enabled": customer_enabled,
        "captain_enabled": captain_enabled,
        "customer_active": program_enabled and customer_enabled,
        "captain_active": program_enabled and captain_enabled,
        "friend_discount": friend_discount,
        "referrer_reward": referrer_reward,
        "min_fare": min_fare,
        "captain_bonus_rides": captain_bonus_rides,
        "max_per_user": max_per_user,
    }


def generate_unique_referral_code(db: Session, full_name: str = "") -> str:
    """Create a clean, readable unique SafarGo referral code like SGHAM482."""
    letters = re.sub(r"[^A-Za-z]", "", (full_name or "").upper())
    prefix = f"SG{(letters[:3] or 'USR').ljust(3, 'X')}"
    chars = string.ascii_uppercase + string.digits
    for _ in range(40):
        suffix = "".join(random.choices(chars, k=4))
        candidate = f"{prefix}{suffix}"
        if not db.query(User.id).filter(User.referral_code == candidate).first():
            return candidate
    return f"SG{random.randint(100000, 999999)}"


def ensure_user_referral_code(db: Session, user: User, commit: bool = False) -> str:
    if user.referral_code:
        return user.referral_code
    user.referral_code = generate_unique_referral_code(db, user.full_name)
    if commit:
        db.commit()
        db.refresh(user)
    return user.referral_code


def backfill_missing_referral_codes(db: Session) -> int:
    missing = db.query(User).filter((User.referral_code.is_(None)) | (User.referral_code == "")).all()
    if not missing:
        return 0
    for u in missing:
        u.referral_code = generate_unique_referral_code(db, u.full_name)
    db.commit()
    return len(missing)


def apply_referral_code_for_user(
    db: Session,
    user: User,
    raw_code: str,
    commit: bool = True,
) -> ReferralRecord:
    """Link a referral code to a newly registered or first-ride user with strict anti-fraud checks."""
    clean_code = (raw_code or "").strip().upper()
    if not clean_code:
        raise HTTPException(status_code=400, detail="Please enter a referral code.")

    policy = get_referral_policy(db)
    if not policy["program_enabled"]:
        raise HTTPException(status_code=400, detail="Referral program is currently turned OFF by Admin.")

    is_captain = user.role == "rider"
    track = "captain" if is_captain else "customer"
    if is_captain and not policy["captain_enabled"]:
        raise HTTPException(status_code=400, detail="Captain referral program is currently turned OFF by Admin.")
    if not is_captain and not policy["customer_enabled"]:
        raise HTTPException(status_code=400, detail="Customer referral program is currently turned OFF by Admin.")

    if user.role == "admin":
        raise HTTPException(status_code=400, detail="Admin accounts cannot apply referral codes.")

    if user.referred_by_user_id is not None or db.query(ReferralRecord.id).filter(
        ReferralRecord.referred_user_id == user.id
    ).first():
        raise HTTPException(status_code=400, detail="A referral code is already applied to this account.")

    referrer = (
        db.query(User)
        .filter(func.upper(User.referral_code) == clean_code)
        .first()
    )
    if not referrer:
        raise HTTPException(status_code=400, detail="Referral code not found. Please check and try again.")
    if referrer.id == user.id or (referrer.phone and user.phone and referrer.phone.strip() == user.phone.strip()):
        raise HTTPException(status_code=400, detail="Self-referral is not allowed.")
    if not referrer.is_active:
        raise HTTPException(status_code=400, detail="This referral code belongs to an inactive user.")

    # Disallow applying referral code after user already completed rides or activated paid topup
    completed_cnt = (
        db.query(Booking.id)
        .filter(
            Booking.rider_id == user.id if is_captain else Booking.customer_id == user.id,
            Booking.status == "completed",
        )
        .count()
    )
    if completed_cnt > 0:
        raise HTTPException(status_code=400, detail="Referral codes can only be applied before your first completed ride.")
    if is_captain:
        approved_topups = (
            db.query(RiderTopupRequest.id)
            .filter(RiderTopupRequest.rider_id == user.id, RiderTopupRequest.status == "approved")
            .count()
        )
        if approved_topups > 0:
            raise HTTPException(
                status_code=400,
                detail="Captain referral codes can only be applied before your first approved App Fee top-up.",
            )

    if policy["max_per_user"] > 0:
        rewarded_cnt = (
            db.query(ReferralRecord.id)
            .filter(ReferralRecord.referrer_id == referrer.id, ReferralRecord.status == "rewarded")
            .count()
        )
        if rewarded_cnt >= policy["max_per_user"]:
            raise HTTPException(status_code=400, detail="This referral code has reached the Admin limit.")

    user.referred_by_user_id = referrer.id
    rec = ReferralRecord(
        referrer_id=referrer.id,
        referred_user_id=user.id,
        referral_code_used=referrer.referral_code or clean_code,
        track=track,
        status="pending",
        reward_type="app_fee_rides" if (is_captain and referrer.role == "rider") else "discount_credit",
    )
    db.add(rec)
    if commit:
        db.commit()
        db.refresh(rec)
    else:
        db.flush()
    return rec


def preview_customer_referral_discount(
    db: Session,
    customer: Optional[User],
    raw_fare: float,
    min_rule_fare: float,
    promo_code_entered: Optional[str] = None,
    use_referral_credit: bool = True,
) -> dict:
    """Compute eligible referral discount without mutating balances."""
    empty = {"discount": 0.0, "source": None, "code": None, "min_fare_required": 0.0}
    if not customer or customer.role != "customer" or promo_code_entered:
        return empty
    policy = get_referral_policy(db)
    if not policy["customer_active"]:
        return empty
    empty["min_fare_required"] = policy["min_fare"]
    if raw_fare < policy["min_fare"]:
        return empty

    max_allowed_disc = round(max(0.0, raw_fare - min_rule_fare), 2)
    if max_allowed_disc <= 0:
        return empty

    # 1. Referred friend's 1st ride discount (if pending customer referral & no existing active REF-1ST booking)
    pending_ref = (
        db.query(ReferralRecord)
        .filter(
            ReferralRecord.referred_user_id == customer.id,
            ReferralRecord.track == "customer",
            ReferralRecord.status == "pending",
        )
        .first()
    )
    if pending_ref and policy["friend_discount"] > 0:
        active_or_done_friend_promo = (
            db.query(Booking.id)
            .filter(
                Booking.customer_id == customer.id,
                Booking.status != "cancelled",
                Booking.promo_code.like("REF-1ST-%"),
            )
            .first()
        )
        if not active_or_done_friend_promo:
            disc = round(min(policy["friend_discount"], max_allowed_disc), 2)
            if disc > 0:
                return {
                    "discount": disc,
                    "source": "friend_first_ride",
                    "code": f"REF-1ST-{pending_ref.referral_code_used}",
                    "min_fare_required": policy["min_fare"],
                }

    # 2. Referrer's earned referral credit balance
    credit_bal = round(float(getattr(customer, "referral_discount_balance", 0.0) or 0.0), 2)
    if use_referral_credit and credit_bal > 0:
        disc = round(min(credit_bal, max_allowed_disc), 2)
        if disc > 0:
            return {
                "discount": disc,
                "source": "earned_credit",
                "code": "REF-BONUS",
                "min_fare_required": policy["min_fare"],
            }

    return empty


def unlock_customer_referral_reward_on_completion(db: Session, booking: Booking) -> Optional[ReferralRecord]:
    """Unlock referrer reward ONLY after referred customer completes a qualifying ride."""
    rec = (
        db.query(ReferralRecord)
        .filter(
            ReferralRecord.referred_user_id == booking.customer_id,
            ReferralRecord.track == "customer",
            ReferralRecord.status == "pending",
        )
        .first()
    )
    if not rec:
        return None
    policy = get_referral_policy(db)
    if not policy["customer_active"]:
        return None

    gross_fare = round(float(booking.final_fare or 0.0) + float(booking.discount_amount or 0.0), 2)
    if gross_fare < policy["min_fare"]:
        return None

    referrer = db.query(User).filter(User.id == rec.referrer_id).first()
    if not referrer or not referrer.is_active:
        rec.status = "cancelled"
        return None

    if policy["max_per_user"] > 0:
        rewarded_cnt = (
            db.query(ReferralRecord.id)
            .filter(ReferralRecord.referrer_id == referrer.id, ReferralRecord.status == "rewarded")
            .count()
        )
        if rewarded_cnt >= policy["max_per_user"]:
            rec.status = "cancelled"
            return None

    reward_amt = round(float(policy["referrer_reward"]), 2)
    referrer.referral_discount_balance = round(
        float(getattr(referrer, "referral_discount_balance", 0.0) or 0.0) + reward_amt, 2
    )
    rec.status = "rewarded"
    rec.reward_type = "discount_credit"
    rec.reward_amount = reward_amt
    rec.friend_discount_given = round(float(booking.discount_amount or 0.0), 2)
    rec.trigger_booking_id = booking.id
    rec.rewarded_at = _utcnow()
    return rec


def unlock_captain_referral_reward(
    db: Session,
    rider_user_id: int,
    trigger_topup: Optional[RiderTopupRequest] = None,
    trigger_booking: Optional[Booking] = None,
) -> Optional[ReferralRecord]:
    """Unlock referrer reward when invited verified Captain completes 1st App Fee Top-Up or 1st ride (when App Fee OFF/exempt)."""
    rec = (
        db.query(ReferralRecord)
        .filter(
            ReferralRecord.referred_user_id == rider_user_id,
            ReferralRecord.track == "captain",
            ReferralRecord.status == "pending",
        )
        .first()
    )
    if not rec:
        return None
    policy = get_referral_policy(db)
    if not policy["captain_active"]:
        return None

    referred_user = db.query(User).filter(User.id == rider_user_id).first()
    referred_rp = db.query(RiderProfile).filter(RiderProfile.user_id == rider_user_id).first()
    if not referred_user or not referred_rp or not referred_rp.is_verified:
        return None

    referrer = db.query(User).filter(User.id == rec.referrer_id).first()
    if not referrer or not referrer.is_active:
        rec.status = "cancelled"
        return None

    if policy["max_per_user"] > 0:
        rewarded_cnt = (
            db.query(ReferralRecord.id)
            .filter(ReferralRecord.referrer_id == referrer.id, ReferralRecord.status == "rewarded")
            .count()
        )
        if rewarded_cnt >= policy["max_per_user"]:
            rec.status = "cancelled"
            return None

    if referrer.role == "rider":
        referrer_rp = db.query(RiderProfile).filter(RiderProfile.user_id == referrer.id).first()
        if not referrer_rp:
            return None
        from app.services.finance import get_topup_policy

        bonus_rides = max(0, int(policy["captain_bonus_rides"] or 0))
        topup_pol = get_topup_policy(db, referrer_rp.vehicle_type)
        per_ride = round(float(referrer_rp.topup_per_ride_fee or topup_pol["per_ride_fee"] or 10.0), 2)
        bonus_val = round(bonus_rides * per_ride, 2)
        if bonus_rides > 0:
            referrer_rp.remaining_paid_rides = int(referrer_rp.remaining_paid_rides or 0) + bonus_rides
            referrer_rp.topup_wallet_balance = round(
                float(referrer_rp.topup_wallet_balance or 0.0) + bonus_val, 2
            )
            db.add(
                LedgerEntry(
                    rider_id=referrer.id,
                    booking_id=trigger_booking.id if trigger_booking else None,
                    entry_type="referral_app_fee_bonus",
                    amount=bonus_val,
                    signed_delta=0.0,
                    balance_after=referrer_rp.balance_due_to_admin,
                    payment_channel="referral_bonus",
                    reference_no=referred_user.phone,
                    note=(
                        f"Referral Bonus: +{bonus_rides} App Access Rides "
                        f"(Invited Captain {referred_user.full_name} activated)"
                    ),
                    recorded_by_id=trigger_topup.approved_by_id if trigger_topup else referrer.id,
                )
            )
        rec.reward_type = "app_fee_rides"
        rec.reward_rides = bonus_rides
        rec.reward_amount = bonus_val
    else:
        reward_amt = round(float(policy["referrer_reward"]), 2)
        referrer.referral_discount_balance = round(
            float(getattr(referrer, "referral_discount_balance", 0.0) or 0.0) + reward_amt, 2
        )
        rec.reward_type = "discount_credit"
        rec.reward_rides = 0
        rec.reward_amount = reward_amt

    rec.status = "rewarded"
    rec.trigger_topup_id = trigger_topup.id if trigger_topup else None
    rec.trigger_booking_id = trigger_booking.id if trigger_booking else None
    rec.rewarded_at = _utcnow()
    return rec
