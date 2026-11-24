import csv
import io
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from app.auth import require_roles
from app.database import get_db
from app.models import AdminExpense, Booking, LedgerEntry, RiderProfile, User

router = APIRouter(prefix="/api/reports", tags=["Profit & Loss Reports"])


def _resolve_date_range(start_date: Optional[date], end_date: Optional[date]) -> tuple[date, date]:
    end_d = end_date or date.today()
    start_d = start_date or (end_d - timedelta(days=30))
    return start_d, end_d


@router.get("/pnl")
def get_pnl_report(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    start_d, end_d = _resolve_date_range(start_date, end_date)
    dt_start = datetime.combine(start_d, time.min, tzinfo=timezone.utc)
    dt_end = datetime.combine(end_d, time.max, tzinfo=timezone.utc)

    bookings = (
        db.query(Booking)
        .options(joinedload(Booking.rider))
        .filter(Booking.created_at >= dt_start, Booking.created_at <= dt_end)
        .all()
    )
    completed = [b for b in bookings if b.status == "completed"]
    cancelled = [b for b in bookings if b.status == "cancelled"]

    expenses = (
        db.query(AdminExpense)
        .filter(AdminExpense.expense_date >= start_d, AdminExpense.expense_date <= end_d)
        .all()
    )
    settlements = (
        db.query(LedgerEntry)
        .filter(
            LedgerEntry.entry_type == "settlement_to_admin",
            LedgerEntry.created_at >= dt_start,
            LedgerEntry.created_at <= dt_end,
        )
        .all()
    )

    gross_gmv = round(sum(b.final_fare for b in completed), 2)
    admin_commission = round(sum(b.commission_amount for b in completed), 2)
    rider_net = round(sum(b.rider_earning for b in completed), 2)
    cash_by_riders = round(sum(b.final_fare for b in completed if b.payment_collector == "rider"), 2)
    digital_by_admin = round(sum(b.final_fare for b in completed if b.payment_collector == "admin"), 2)
    settlements_collected = round(sum(s.amount for s in settlements), 2)
    total_expenses = round(sum(e.amount for e in expenses), 2)
    net_profit = round(admin_commission - total_expenses, 2)

    # Service breakdown
    svc_map = defaultdict(lambda: {"service_type": "", "trips": 0, "gross_fare": 0.0, "admin_profit": 0.0})
    for b in completed:
        row = svc_map[b.service_type]
        row["service_type"] = b.service_type
        row["trips"] += 1
        row["gross_fare"] = round(row["gross_fare"] + b.final_fare, 2)
        row["admin_profit"] = round(row["admin_profit"] + b.commission_amount, 2)

    # Daily trend
    day_map = defaultdict(lambda: {"date": "", "trips": 0, "gross_fare": 0.0, "admin_commission": 0.0, "expenses": 0.0})
    for b in completed:
        d_str = (b.completed_at or b.created_at).date().isoformat()
        day_map[d_str]["date"] = d_str
        day_map[d_str]["trips"] += 1
        day_map[d_str]["gross_fare"] = round(day_map[d_str]["gross_fare"] + b.final_fare, 2)
        day_map[d_str]["admin_commission"] = round(day_map[d_str]["admin_commission"] + b.commission_amount, 2)
    for e in expenses:
        d_str = e.expense_date.isoformat()
        day_map[d_str]["date"] = d_str
        day_map[d_str]["expenses"] = round(day_map[d_str]["expenses"] + e.amount, 2)

    daily_trend = sorted(day_map.values(), key=lambda x: x["date"])

    # Rider performance in range + live balance due
    rider_profiles = {
        rp.user_id: rp
        for rp in db.query(RiderProfile).options(joinedload(RiderProfile.user)).all()
    }
    rider_stats = defaultdict(
        lambda: {"rider_id": 0, "rider_name": "", "bike_plate": "", "trips": 0, "gross_fare": 0.0, "commission": 0.0, "rider_earning": 0.0, "current_balance_due": 0.0}
    )
    for b in completed:
        if not b.rider_id:
            continue
        rs = rider_stats[b.rider_id]
        rp = rider_profiles.get(b.rider_id)
        rs["rider_id"] = b.rider_id
        rs["rider_name"] = b.rider.full_name if b.rider else f"Rider #{b.rider_id}"
        rs["bike_plate"] = rp.bike_plate if rp else ""
        rs["trips"] += 1
        rs["gross_fare"] = round(rs["gross_fare"] + b.final_fare, 2)
        rs["commission"] = round(rs["commission"] + b.commission_amount, 2)
        rs["rider_earning"] = round(rs["rider_earning"] + b.rider_earning, 2)
        rs["current_balance_due"] = rp.balance_due_to_admin if rp else 0.0

    # Expense breakdown
    exp_cat = defaultdict(float)
    for e in expenses:
        exp_cat[e.category] = round(exp_cat[e.category] + e.amount, 2)

    return {
        "start_date": start_d.isoformat(),
        "end_date": end_d.isoformat(),
        "summary": {
            "total_bookings": len(bookings),
            "completed_trips": len(completed),
            "cancelled_trips": len(cancelled),
            "gross_gmv": gross_gmv,
            "admin_commission_earned": admin_commission,
            "rider_net_earnings": rider_net,
            "cash_collected_by_riders": cash_by_riders,
            "digital_collected_by_admin": digital_by_admin,
            "settlements_collected": settlements_collected,
            "total_expenses": total_expenses,
            "net_business_profit": net_profit,
        },
        "service_breakdown": list(svc_map.values()),
        "expense_by_category": [{"category": k, "amount": v} for k, v in exp_cat.items()],
        "daily_trend": daily_trend,
        "rider_performance": sorted(rider_stats.values(), key=lambda x: x["commission"], reverse=True),
    }


@router.get("/export-csv")
def export_pnl_csv(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    start_d, end_d = _resolve_date_range(start_date, end_date)
    dt_start = datetime.combine(start_d, time.min, tzinfo=timezone.utc)
    dt_end = datetime.combine(end_d, time.max, tzinfo=timezone.utc)

    rows = (
        db.query(Booking)
        .options(joinedload(Booking.customer), joinedload(Booking.rider))
        .filter(
            Booking.status == "completed",
            Booking.created_at >= dt_start,
            Booking.created_at <= dt_end,
        )
        .order_by(Booking.completed_at.desc())
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "Booking Code",
            "Date",
            "Service",
            "Customer",
            "Rider",
            "Pickup Zone",
            "Drop Zone",
            "Final Fare (PKR)",
            "Commission Rule",
            "Admin Commission (PKR)",
            "Rider Earning (PKR)",
            "Payment Method",
            "Collected By",
        ]
    )
    for b in rows:
        writer.writerow(
            [
                b.booking_code,
                (b.completed_at or b.created_at).strftime("%Y-%m-%d %H:%M"),
                b.service_type,
                b.customer.full_name if b.customer else "",
                b.rider.full_name if b.rider else "",
                b.pickup_zone,
                b.drop_zone,
                b.final_fare,
                f"{b.commission_rate_snapshot} ({b.commission_type_snapshot})",
                b.commission_amount,
                b.rider_earning,
                b.payment_method,
                b.payment_collector,
            ]
        )

    output.seek(0)
    filename = f"safargo_report_{start_d.isoformat()}_to_{end_d.isoformat()}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
