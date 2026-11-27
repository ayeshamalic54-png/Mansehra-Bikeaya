from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.auth import get_current_user, require_roles
from app.database import get_db
from app.models import ReferralRecord, User
from app.schemas import ReferralApplyRequest
from app.services.referral import (
    apply_referral_code_for_user,
    ensure_user_referral_code,
    get_referral_policy,
)

router = APIRouter(prefix="/api", tags=["Referrals"])


@router.get("/referrals/my")
def get_my_referrals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    code = ensure_user_referral_code(db, current_user, commit=True)
    policy = get_referral_policy(db)
    sent_rows = (
        db.query(ReferralRecord)
        .options(joinedload(ReferralRecord.referred_user))
        .filter(ReferralRecord.referrer_id == current_user.id)
        .order_by(ReferralRecord.created_at.desc())
        .all()
    )
    invited_by_rec = (
        db.query(ReferralRecord)
        .options(joinedload(ReferralRecord.referrer))
        .filter(ReferralRecord.referred_user_id == current_user.id)
        .first()
    )
    rewarded_count = sum(1 for r in sent_rows if r.status == "rewarded")
    pending_count = sum(1 for r in sent_rows if r.status == "pending")
    total_rides_earned = sum(int(r.reward_rides or 0) for r in sent_rows if r.status == "rewarded")
    total_credit_earned = round(
        sum(float(r.reward_amount or 0.0) for r in sent_rows if r.status == "rewarded" and r.reward_type == "discount_credit"),
        2,
    )
    return {
        "referral_code": code,
        "referral_discount_balance": round(float(getattr(current_user, "referral_discount_balance", 0.0) or 0.0), 2),
        "policy": policy,
        "stats": {
            "total_referred": len(sent_rows),
            "rewarded_count": rewarded_count,
            "pending_count": pending_count,
            "total_rides_earned": total_rides_earned,
            "total_credit_earned": total_credit_earned,
        },
        "invited_by": (
            {
                "referral_code_used": invited_by_rec.referral_code_used,
                "referrer_name": invited_by_rec.referrer.full_name if invited_by_rec.referrer else "SafarGo User",
                "track": invited_by_rec.track,
                "status": invited_by_rec.status,
                "friend_discount_available": policy["friend_discount"]
                if invited_by_rec.track == "customer" and invited_by_rec.status == "pending" and policy["customer_active"]
                else 0.0,
            }
            if invited_by_rec
            else None
        ),
        "referrals": [
            {
                "id": r.id,
                "referred_name": r.referred_user.full_name if r.referred_user else "SafarGo User",
                "referred_role": r.referred_user.role if r.referred_user else r.track,
                "track": r.track,
                "status": r.status,
                "reward_type": r.reward_type,
                "reward_amount": r.reward_amount,
                "reward_rides": r.reward_rides,
                "friend_discount_given": r.friend_discount_given,
                "created_at": r.created_at,
                "rewarded_at": r.rewarded_at,
            }
            for r in sent_rows
        ],
    }


@router.post("/referrals/apply")
def apply_referral_code(
    payload: ReferralApplyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rec = apply_referral_code_for_user(db, current_user, payload.referral_code)
    return {
        "status": "linked",
        "referral_id": rec.id,
        "track": rec.track,
        "referral_code_used": rec.referral_code_used,
        "reward_status": rec.status,
    }


@router.get("/admin/referrals")
def admin_list_referrals(
    current_admin: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    policy = get_referral_policy(db)
    rows = (
        db.query(ReferralRecord)
        .options(joinedload(ReferralRecord.referrer), joinedload(ReferralRecord.referred_user))
        .order_by(ReferralRecord.created_at.desc())
        .limit(150)
        .all()
    )
    return {
        "policy": policy,
        "summary": {
            "total": len(rows),
            "pending": sum(1 for r in rows if r.status == "pending"),
            "rewarded": sum(1 for r in rows if r.status == "rewarded"),
            "customer_track": sum(1 for r in rows if r.track == "customer"),
            "captain_track": sum(1 for r in rows if r.track == "captain"),
            "total_friend_discounts": round(sum(float(r.friend_discount_given or 0.0) for r in rows), 2),
            "total_credit_rewards": round(
                sum(float(r.reward_amount or 0.0) for r in rows if r.status == "rewarded" and r.reward_type == "discount_credit"),
                2,
            ),
            "total_bonus_rides": sum(int(r.reward_rides or 0) for r in rows if r.status == "rewarded"),
        },
        "items": [
            {
                "id": r.id,
                "referrer_id": r.referrer_id,
                "referrer_name": r.referrer.full_name if r.referrer else "User",
                "referrer_phone": r.referrer.phone if r.referrer else "",
                "referred_user_id": r.referred_user_id,
                "referred_name": r.referred_user.full_name if r.referred_user else "User",
                "referred_phone": r.referred_user.phone if r.referred_user else "",
                "referred_role": r.referred_user.role if r.referred_user else r.track,
                "referral_code_used": r.referral_code_used,
                "track": r.track,
                "status": r.status,
                "reward_type": r.reward_type,
                "reward_amount": r.reward_amount,
                "reward_rides": r.reward_rides,
                "friend_discount_given": r.friend_discount_given,
                "created_at": r.created_at,
                "rewarded_at": r.rewarded_at,
            }
            for r in rows
        ],
    }
