from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from app.auth import require_roles
from app.database import get_db
from app.models import AdminExpense, LedgerEntry, RiderProfile, RiderSettlementRequest, User
from app.schemas import ExpenseCreate, ExpenseUpdate, LedgerEntryUpdate, SettlementCreate
from app.services.finance import post_rider_settlement, recalculate_rider_ledger_balances, utcnow

router = APIRouter(prefix="/api/finance", tags=["Finance & Lain-Dain"])


@router.get("/rider-balances")
def list_rider_balances(
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    profiles = (
        db.query(RiderProfile)
        .options(joinedload(RiderProfile.user))
        .order_by(RiderProfile.balance_due_to_admin.desc())
        .all()
    )
    return [
        {
            "rider_id": rp.user_id,
            "full_name": rp.user.full_name if rp.user else "Rider",
            "phone": rp.user.phone if rp.user else "",
            "bike_plate": rp.bike_plate,
            "zone_name": rp.zone_name,
            "total_trips": rp.total_trips,
            "total_gross_collected": rp.total_gross_collected,
            "total_net_earned": rp.total_net_earned,
            "total_commission_generated": rp.total_commission_generated,
            "total_settled_to_admin": rp.total_settled_to_admin,
            "balance_due_to_admin": rp.balance_due_to_admin,
            "credit_limit": rp.credit_limit,
            "is_over_limit": rp.balance_due_to_admin > rp.credit_limit,
        }
        for rp in profiles
    ]


@router.get("/ledger")
def list_ledger_entries(
    rider_id: Optional[int] = None,
    entry_type: Optional[str] = None,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    q = db.query(LedgerEntry).options(joinedload(LedgerEntry.rider), joinedload(LedgerEntry.recorded_by))
    if rider_id:
        q = q.filter(LedgerEntry.rider_id == rider_id)
    if entry_type:
        q = q.filter(LedgerEntry.entry_type == entry_type)
    rows = q.order_by(LedgerEntry.created_at.desc()).limit(200).all()
    return [
        {
            "id": e.id,
            "rider_id": e.rider_id,
            "rider_name": e.rider.full_name if e.rider else "Rider",
            "booking_id": e.booking_id,
            "entry_type": e.entry_type,
            "amount": e.amount,
            "signed_delta": e.signed_delta,
            "balance_after": e.balance_after,
            "payment_channel": e.payment_channel,
            "reference_no": e.reference_no,
            "note": e.note,
            "recorded_by": "SafarGo",
            "created_at": e.created_at,
        }
        for e in rows
    ]


@router.post("/settlements", status_code=status.HTTP_201_CREATED)
def record_settlement(
    payload: SettlementCreate,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    rp = db.query(RiderProfile).filter(RiderProfile.user_id == payload.rider_id).first()
    if not rp:
        raise HTTPException(status_code=404, detail="Rider profile not found")

    entry = post_rider_settlement(
        db=db,
        rider_profile=rp,
        amount=payload.amount,
        entry_type=payload.entry_type,
        payment_channel=payload.payment_channel,
        reference_no=payload.reference_no,
        note=payload.note,
        admin_user=current_user,
    )
    return {
        "id": entry.id,
        "rider_id": entry.rider_id,
        "entry_type": entry.entry_type,
        "amount": entry.amount,
        "balance_after": entry.balance_after,
        "note": entry.note,
        "created_at": entry.created_at,
    }


@router.patch("/ledger/{entry_id}")
def update_ledger_entry(
    entry_id: int,
    payload: LedgerEntryUpdate,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    entry = db.query(LedgerEntry).filter(LedgerEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Ledger entry not found")
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(entry, field, val)
    db.commit()
    db.refresh(entry)
    return {"id": entry.id, "note": entry.note, "payment_channel": entry.payment_channel, "reference_no": entry.reference_no}


@router.delete("/ledger/{entry_id}")
def delete_ledger_entry(
    entry_id: int,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    entry = db.query(LedgerEntry).filter(LedgerEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Ledger entry not found")
    if entry.booking_id is not None:
        raise HTTPException(
            status_code=400,
            detail="Ride-linked ledger entries are edited or deleted via Dispatch & Rides.",
        )
    rider_id = entry.rider_id
    db.delete(entry)
    db.commit()
    recalculate_rider_ledger_balances(db, rider_id)
    return {"deleted": entry_id}


@router.get("/expenses")
def list_expenses(
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    return db.query(AdminExpense).order_by(AdminExpense.expense_date.desc(), AdminExpense.id.desc()).all()


@router.post("/expenses", status_code=status.HTTP_201_CREATED)
def create_expense(
    payload: ExpenseCreate,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    exp = AdminExpense(
        title=payload.title.strip(),
        category=payload.category,
        amount=round(payload.amount, 2),
        expense_date=payload.expense_date,
        note=payload.note,
        recorded_by_id=current_user.id,
    )
    db.add(exp)
    db.commit()
    db.refresh(exp)
    return exp


@router.patch("/expenses/{expense_id}")
def update_expense(
    expense_id: int,
    payload: ExpenseUpdate,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    exp = db.query(AdminExpense).filter(AdminExpense.id == expense_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expense not found")
    for field, val in payload.model_dump(exclude_unset=True).items():
        if field == "amount" and val is not None:
            val = round(val, 2)
        setattr(exp, field, val)
    db.commit()
    db.refresh(exp)
    return exp


@router.delete("/expenses/{expense_id}")
def delete_expense(
    expense_id: int,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    exp = db.query(AdminExpense).filter(AdminExpense.id == expense_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(exp)
    db.commit()
    return {"deleted": expense_id}


@router.get("/settlement-requests")
def admin_list_settlement_requests(
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(RiderSettlementRequest)
        .options(joinedload(RiderSettlementRequest.rider))
        .order_by(RiderSettlementRequest.created_at.desc())
        .limit(100)
        .all()
    )
    return [
        {
            "id": r.id,
            "rider_id": r.rider_id,
            "rider_name": r.rider.full_name if r.rider else "Captain",
            "rider_phone": r.rider.phone if r.rider else "",
            "amount": r.amount,
            "payment_channel": r.payment_channel,
            "reference_no": r.reference_no,
            "note": r.note,
            "account_title": "SafarGo",
            "status": r.status,
            "created_at": r.created_at,
            "paid_at": r.paid_at,
        }
        for r in rows
    ]


@router.post("/settlement-requests/{req_id}/mark-paid")
def admin_approve_settlement_request(
    req_id: int,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    req = db.query(RiderSettlementRequest).filter(RiderSettlementRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Settlement request not found")
    if req.status == "paid":
        raise HTTPException(status_code=400, detail="Settlement request already marked Paid")
    rp = db.query(RiderProfile).filter(RiderProfile.user_id == req.rider_id).first()
    if not rp:
        raise HTTPException(status_code=404, detail="Rider profile not found")

    note_txt = req.note or f"Captain paid Rs.{req.amount:.0f} to SafarGo via {req.payment_channel} (Paid)"
    post_rider_settlement(
        db=db,
        rider_profile=rp,
        amount=req.amount,
        entry_type="settlement_to_admin",
        payment_channel=req.payment_channel,
        reference_no=req.reference_no,
        note=note_txt,
        admin_user=current_user,
    )
    req.status = "paid"
    req.paid_at = utcnow()
    db.commit()
    return {"id": req.id, "status": req.status, "balance_after": rp.balance_due_to_admin}


@router.post("/settlement-requests/{req_id}/reject")
def admin_reject_settlement_request(
    req_id: int,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    req = db.query(RiderSettlementRequest).filter(RiderSettlementRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Settlement request not found")
    if req.status == "paid":
        raise HTTPException(status_code=400, detail="Paid request cannot be rejected")
    req.status = "rejected"
    db.commit()
    return {"id": req.id, "status": req.status}
