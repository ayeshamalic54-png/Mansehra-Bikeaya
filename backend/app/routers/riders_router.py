from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.auth import require_roles
from app.database import get_db
from app.models import (
    Booking,
    LedgerEntry,
    MansehraZone,
    PricingRule,
    RideOffer,
    RiderProfile,
    RiderSettlementRequest,
    RiderTopupRequest,
    User,
)
from app.routers.auth_router import serialize_user
from app.routers.bookings_router import booking_query_with_relations, serialize_booking, serialize_offer
from app.schemas import (
    BookingStatusUpdate,
    RideOfferCreate,
    RiderLocationUpdate,
    RiderProfileSelfUpdate,
    RiderSettlementSubmit,
    RiderTopupProofSubmit,
    RiderTopupSubmit,
)
from app.services.finance import (
    apply_wait_charge_to_booking,
    can_captain_work,
    captain_matches_service,
    complete_booking_and_post_ledger,
    compute_commission,
    find_nearest_captains_for_booking,
    get_topup_policy,
    haversine_km,
    resolve_nearest_zone_name,
    utcnow,
)
from app.services.media import clean_image_data_uri, has_complete_captain_docs

router = APIRouter(prefix="/api/riders", tags=["Rider Captain"])


def _vehicle_matches_service(vehicle_type: str, service_type: str) -> bool:
    return captain_matches_service(vehicle_type, service_type)


@router.get("/profile")
def get_my_captain_profile(current_user: User = Depends(require_roles("rider"))):
    return serialize_user(current_user)


@router.patch("/profile")
def update_my_captain_profile(
    payload: RiderProfileSelfUpdate,
    current_user: User = Depends(require_roles("rider")),
    db: Session = Depends(get_db),
):
    rp = db.query(RiderProfile).filter(RiderProfile.user_id == current_user.id).first()
    if not rp:
        raise HTTPException(status_code=404, detail="Captain profile not found")

    if payload.full_name is not None:
        current_user.full_name = payload.full_name.strip()
    identity_or_docs_changed = False
    if payload.vehicle_type is not None and payload.vehicle_type != rp.vehicle_type:
        rp.vehicle_type = payload.vehicle_type
        identity_or_docs_changed = True
    if payload.bike_model is not None:
        rp.bike_model = payload.bike_model.strip()
    if payload.bike_plate is not None:
        new_plate = payload.bike_plate.strip().upper()
        if new_plate != (rp.bike_plate or ""):
            rp.bike_plate = new_plate
            identity_or_docs_changed = True
    if payload.cnic_number is not None:
        new_cnic = payload.cnic_number.strip() or None
        if new_cnic != rp.cnic_number:
            rp.cnic_number = new_cnic
            identity_or_docs_changed = True
    if payload.license_no is not None:
        rp.license_no = payload.license_no.strip() or None
    if payload.zone_name is not None:
        rp.zone_name = payload.zone_name.strip()

    for field in ("rider_photo", "vehicle_photo", "cnic_front_photo", "cnic_back_photo"):
        val = getattr(payload, field)
        if val is not None:
            cleaned = clean_image_data_uri(val) or None
            if cleaned != getattr(rp, field, None):
                setattr(rp, field, cleaned)
                identity_or_docs_changed = True

    has_required_docs = has_complete_captain_docs(rp)
    if not rp.is_verified:
        if has_required_docs:
            rp.docs_submitted_at = utcnow()
            rp.verification_status = "pending"
            rp.verification_note = None
        else:
            rp.is_online = False
            rp.verification_status = "incomplete"
    elif identity_or_docs_changed and has_required_docs:
        rp.docs_submitted_at = utcnow()

    db.commit()
    db.refresh(current_user)
    return serialize_user(current_user)


@router.post("/toggle-online")
def toggle_online(
    current_user: User = Depends(require_roles("rider")),
    db: Session = Depends(get_db),
):
    rp = db.query(RiderProfile).filter(RiderProfile.user_id == current_user.id).first()
    if not rp:
        raise HTTPException(status_code=404, detail="Rider profile not found")

    if not rp.is_online:
        eligible, block_reason = can_captain_work(db, rp)
        if not eligible:
            raise HTTPException(status_code=403, detail=block_reason)
        rp.is_online = True
        if rp.current_lat is None or rp.current_lng is None:
            z = db.query(MansehraZone).filter(MansehraZone.name == rp.zone_name).first()
            rp.current_lat = z.lat if z and z.lat is not None else 34.3335
            rp.current_lng = z.lng if z and z.lng is not None else 73.1995
            rp.location_updated_at = utcnow()
    else:
        rp.is_online = False

    db.commit()
    from app.routers.public_router import invalidate_nearby_captains_cache

    invalidate_nearby_captains_cache()
    return {
        "is_online": rp.is_online,
        "balance_due_to_admin": rp.balance_due_to_admin,
        "remaining_paid_rides": int(rp.remaining_paid_rides or 0),
        "topup_wallet_balance": float(rp.topup_wallet_balance or 0.0),
        "current_lat": rp.current_lat,
        "current_lng": rp.current_lng,
    }


@router.post("/location")
def update_rider_location(
    payload: RiderLocationUpdate,
    current_user: User = Depends(require_roles("rider")),
    db: Session = Depends(get_db),
):
    rp = db.query(RiderProfile).filter(RiderProfile.user_id == current_user.id).first()
    if not rp:
        raise HTTPException(status_code=404, detail="Rider profile not found")
    rp.current_lat = payload.lat
    rp.current_lng = payload.lng
    rp.location_updated_at = utcnow()
    resolved_zone = resolve_nearest_zone_name(db, payload.lat, payload.lng)
    if resolved_zone:
        rp.zone_name = resolved_zone
    if payload.is_online is not None:
        if payload.is_online:
            eligible, _ = can_captain_work(db, rp)
            if eligible:
                rp.is_online = True
        else:
            rp.is_online = False
    db.commit()
    from app.routers.public_router import invalidate_nearby_captains_cache

    invalidate_nearby_captains_cache()
    return {
        "current_lat": rp.current_lat,
        "current_lng": rp.current_lng,
        "zone_name": rp.zone_name,
        "location_updated_at": rp.location_updated_at,
        "is_online": rp.is_online,
    }


@router.get("/available-jobs")
def get_available_jobs(
    include_other_vehicles: bool = Query(False),
    current_user: User = Depends(require_roles("rider")),
    db: Session = Depends(get_db),
):
    rp = db.query(RiderProfile).filter(RiderProfile.user_id == current_user.id).first()
    if not rp:
        raise HTTPException(status_code=404, detail="Rider profile not found")
    if not rp.is_verified:
        return []
    eligible, _ = can_captain_work(db, rp)
    if not eligible:
        return []

    rules = {r.service_type: r for r in db.query(PricingRule).all()}
    zones_by_name = {z.name: z for z in db.query(MansehraZone).all()}
    jobs = (
        booking_query_with_relations(db)
        .filter(Booking.status == "pending", Booking.rider_id.is_(None))
        .order_by(Booking.created_at.desc())
        .all()
    )
    out = []
    for job in jobs:
        matches = _vehicle_matches_service(rp.vehicle_type, job.service_type)
        if not include_other_vehicles and not matches:
            continue
        data = serialize_booking(job)
        data["matches_vehicle"] = matches

        p_lat = job.pickup_lat
        p_lng = job.pickup_lng
        if (p_lat is None or p_lng is None) and job.pickup_zone in zones_by_name:
            z = zones_by_name[job.pickup_zone]
            p_lat, p_lng = z.lat, z.lng

        cap_dist = None
        if rp.current_lat is not None and rp.current_lng is not None and p_lat is not None and p_lng is not None:
            cap_dist = haversine_km(rp.current_lat, rp.current_lng, p_lat, p_lng)

        nearest = find_nearest_captains_for_booking(
            db,
            job.service_type,
            p_lat,
            p_lng,
            job.pickup_zone,
            limit=3,
        )
        closest_id = nearest[0]["rider_id"] if nearest else None
        is_closest = bool(
            matches and (closest_id == current_user.id or (cap_dist is not None and cap_dist <= 2.5))
        )

        data["captain_distance_km"] = cap_dist
        data["captain_eta_min"] = max(2, int(round(cap_dist / 0.45))) if cap_dist is not None else None
        data["closest_captain_id"] = closest_id
        data["is_closest_captain"] = is_closest

        topup_policy = get_topup_policy(db, rp.vehicle_type)
        on_prepaid = bool(topup_policy["required"]) and int(rp.remaining_paid_rides or 0) > 0
        rule = rules.get(job.service_type)
        if on_prepaid:
            data["fee_mode"] = "app_fee_topup"
            data["prepaid_ride_fee"] = round(
                float(rp.topup_per_ride_fee or topup_policy["per_ride_fee"] or 10.0), 2
            )
            data["commission_amount"] = 0.0
            data["rider_earning"] = job.final_fare
        elif rule:
            _, _, comm, net = compute_commission(job.final_fare, rule, rp)
            data["fee_mode"] = "commission"
            data["prepaid_ride_fee"] = 0.0
            data["commission_amount"] = comm
            data["rider_earning"] = net
        my_offer = next((o for o in job.offers if o.rider_id == current_user.id and o.status != "withdrawn"), None)
        if my_offer:
            serialized_offer = serialize_offer(my_offer)
            if on_prepaid:
                serialized_offer["commission_amount"] = 0.0
                serialized_offer["rider_earning"] = my_offer.offered_fare
            elif rule:
                _, _, o_comm, o_net = compute_commission(my_offer.offered_fare, rule, rp)
                serialized_offer["commission_amount"] = o_comm
                serialized_offer["rider_earning"] = o_net
            data["my_offer"] = serialized_offer
        else:
            data["my_offer"] = None
        out.append(data)

    out.sort(
        key=lambda j: (
            0 if j.get("matches_vehicle") else 1,
            0 if j.get("is_closest_captain") else 1,
            j.get("captain_distance_km") if j.get("captain_distance_km") is not None else 9999.0,
            -j.get("id", 0),
        )
    )
    return out


@router.post("/jobs/{booking_id}/offer")
def send_or_update_ride_offer(
    booking_id: int,
    payload: RideOfferCreate,
    current_user: User = Depends(require_roles("rider")),
    db: Session = Depends(get_db),
):
    rp = db.query(RiderProfile).filter(RiderProfile.user_id == current_user.id).first()
    if not rp:
        raise HTTPException(status_code=404, detail="Rider profile not found")
    eligible, block_reason = can_captain_work(db, rp)
    if not eligible:
        raise HTTPException(status_code=403, detail=block_reason)

    booking = booking_query_with_relations(db).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status != "pending" or booking.rider_id is not None:
        raise HTTPException(status_code=409, detail="This ride was already assigned or cancelled")

    rec = float(booking.recommended_fare or booking.estimated_fare or 100.0)
    min_floor = max(50.0, float(round(rec * 0.5)))
    offered = float(round(payload.offered_fare))
    if offered < min_floor:
        raise HTTPException(status_code=400, detail=f"Offer fare must be at least Rs. {min_floor:.0f}")

    offer = (
        db.query(RideOffer)
        .filter(RideOffer.booking_id == booking.id, RideOffer.rider_id == current_user.id)
        .order_by(RideOffer.id.desc())
        .first()
    )
    if offer:
        offer.offered_fare = offered
        offer.eta_minutes = payload.eta_minutes
        offer.note = payload.note.strip() if payload.note else None
        offer.status = "pending"
    else:
        offer = RideOffer(
            booking_id=booking.id,
            rider_id=current_user.id,
            offered_fare=offered,
            eta_minutes=payload.eta_minutes,
            note=payload.note.strip() if payload.note else None,
            status="pending",
        )
        db.add(offer)

    rp.is_online = True
    db.commit()
    db.refresh(offer)
    topup_policy = get_topup_policy(db, rp.vehicle_type)
    on_prepaid = bool(topup_policy["required"]) and int(rp.remaining_paid_rides or 0) > 0
    rule = db.query(PricingRule).filter(PricingRule.service_type == booking.service_type).first()
    res = serialize_offer(offer)
    if on_prepaid:
        res["fee_mode"] = "app_fee_topup"
        res["commission_amount"] = 0.0
        res["rider_earning"] = offered
    elif rule:
        _, _, o_comm, o_net = compute_commission(offered, rule, rp)
        res["fee_mode"] = "commission"
        res["commission_amount"] = o_comm
        res["rider_earning"] = o_net
    return res


@router.post("/jobs/{booking_id}/withdraw-offer")
def withdraw_ride_offer(
    booking_id: int,
    current_user: User = Depends(require_roles("rider")),
    db: Session = Depends(get_db),
):
    offer = (
        db.query(RideOffer)
        .filter(
            RideOffer.booking_id == booking_id,
            RideOffer.rider_id == current_user.id,
            RideOffer.status == "pending",
        )
        .first()
    )
    if not offer:
        raise HTTPException(status_code=404, detail="No active offer found for this booking")
    offer.status = "withdrawn"
    db.commit()
    return {"status": "withdrawn", "offer_id": offer.id}


@router.post("/jobs/{booking_id}/accept")
def accept_job(
    booking_id: int,
    current_user: User = Depends(require_roles("rider")),
    db: Session = Depends(get_db),
):
    rp = db.query(RiderProfile).filter(RiderProfile.user_id == current_user.id).first()
    if not rp:
        raise HTTPException(status_code=404, detail="Rider profile not found")
    eligible, block_reason = can_captain_work(db, rp)
    if not eligible:
        raise HTTPException(status_code=403, detail=block_reason)

    booking = booking_query_with_relations(db).filter(Booking.id == booking_id).first()
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
    for o in booking.offers:
        if o.rider_id == current_user.id and o.status == "pending":
            o.status = "accepted"
        elif o.status == "pending":
            o.status = "declined"

    db.commit()
    booking = booking_query_with_relations(db).filter(Booking.id == booking.id).first()
    return serialize_booking(booking)


@router.post("/jobs/{booking_id}/status")
def update_rider_job_status(
    booking_id: int,
    payload: BookingStatusUpdate,
    current_user: User = Depends(require_roles("rider")),
    db: Session = Depends(get_db),
):
    booking = booking_query_with_relations(db).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.rider_id != current_user.id:
        raise HTTPException(status_code=403, detail="This booking is not assigned to you")
    if payload.status == "cancelled":
        raise HTTPException(status_code=403, detail="Please contact Support/Admin to cancel an assigned ride")

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
        if not booking.arrived_at:
            booking.arrived_at = utcnow()
        db.commit()
    elif payload.status == "in_progress":
        booking.status = "in_progress"
        if not booking.started_at:
            booking.started_at = utcnow()
        rule = db.query(PricingRule).filter(PricingRule.service_type == booking.service_type).first()
        rp = booking.rider.rider_profile if booking.rider else None
        apply_wait_charge_to_booking(booking, rule, wait_minutes_override=payload.wait_minutes)
        if rule:
            c_type, c_val, comm, net = compute_commission(booking.final_fare, rule, rp)
            booking.commission_type_snapshot = c_type
            booking.commission_rate_snapshot = c_val
            booking.commission_amount = comm
            booking.rider_earning = net
        db.commit()
    elif payload.status == "completed":
        booking = complete_booking_and_post_ledger(
            db=db,
            booking=booking,
            actor=current_user,
            final_fare_override=payload.final_fare_override,
            payment_collector_override=payload.payment_collector,
            wait_minutes_override=payload.wait_minutes,
        )

    booking = booking_query_with_relations(db).filter(Booking.id == booking.id).first()
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
    requests = (
        db.query(RiderSettlementRequest)
        .filter(RiderSettlementRequest.rider_id == current_user.id)
        .order_by(RiderSettlementRequest.created_at.desc())
        .limit(40)
        .all()
    )
    topups = (
        db.query(RiderTopupRequest)
        .filter(RiderTopupRequest.rider_id == current_user.id)
        .order_by(RiderTopupRequest.created_at.desc())
        .limit(40)
        .all()
    )
    topup_policy = get_topup_policy(db, rp.vehicle_type)
    return {
        "summary": {
            "balance_due_to_admin": rp.balance_due_to_admin,
            "credit_limit": rp.credit_limit,
            "is_over_limit": rp.balance_due_to_admin > rp.credit_limit,
            "topup_wallet_balance": float(rp.topup_wallet_balance or 0.0),
            "remaining_paid_rides": int(rp.remaining_paid_rides or 0),
            "topup_per_ride_fee": float(rp.topup_per_ride_fee or topup_policy["per_ride_fee"]),
            "total_topups_paid": float(rp.total_topups_paid or 0.0),
            "topup_policy": topup_policy,
            "topup_blocked": bool(topup_policy["required"] and int(rp.remaining_paid_rides or 0) <= 0),
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
        "settlement_requests": [
            {
                "id": req.id,
                "amount": req.amount,
                "payment_channel": req.payment_channel,
                "reference_no": req.reference_no,
                "note": req.note,
                "account_title": "SafarGo",
                "status": req.status,
                "created_at": req.created_at,
                "paid_at": req.paid_at,
            }
            for req in requests
        ],
        "topup_requests": [
            {
                "id": t.id,
                "amount": t.amount,
                "rides_requested": t.rides_requested,
                "payment_channel": t.payment_channel,
                "reference_no": t.reference_no,
                "note": t.note,
                "admin_note": t.admin_note,
                "account_title": "SafarGo",
                "status": t.status,
                "created_at": t.created_at,
                "reviewed_at": t.reviewed_at,
            }
            for t in topups
        ],
    }


@router.post("/topup-requests", status_code=status.HTTP_201_CREATED)
def submit_rider_topup_request(
    payload: RiderTopupSubmit,
    current_user: User = Depends(require_roles("rider")),
    db: Session = Depends(get_db),
):
    rp = db.query(RiderProfile).filter(RiderProfile.user_id == current_user.id).first()
    if not rp:
        raise HTTPException(status_code=404, detail="Rider profile not found")

    policy = get_topup_policy(db, rp.vehicle_type)
    amt = round(float(payload.amount), 2)
    if payload.rides_requested is not None:
        rides_req = int(payload.rides_requested)
    else:
        rides_req = max(1, int(round((amt / policy["package_fee"]) * policy["rides_count"])))

    ref_clean = payload.reference_no.strip() if payload.reference_no and payload.reference_no.strip() else None
    req = RiderTopupRequest(
        rider_id=current_user.id,
        amount=amt,
        rides_requested=rides_req,
        payment_channel=payload.payment_channel,
        reference_no=ref_clean,
        note=payload.note.strip() if payload.note else None,
        status="pending",
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return {
        "id": req.id,
        "amount": req.amount,
        "rides_requested": req.rides_requested,
        "payment_channel": req.payment_channel,
        "reference_no": req.reference_no,
        "proof_submitted": bool(req.reference_no),
        "note": req.note,
        "account_title": "SafarGo",
        "status": req.status,
        "created_at": req.created_at,
    }


@router.post("/topup-requests/{req_id}/proof")
def submit_topup_proof_later(
    req_id: int,
    payload: RiderTopupProofSubmit,
    current_user: User = Depends(require_roles("rider")),
    db: Session = Depends(get_db),
):
    req = (
        db.query(RiderTopupRequest)
        .filter(RiderTopupRequest.id == req_id, RiderTopupRequest.rider_id == current_user.id)
        .first()
    )
    if not req:
        raise HTTPException(status_code=404, detail="Top-up request not found")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail=f"Top-up request already {req.status}")

    req.reference_no = payload.reference_no.strip()
    if payload.note and payload.note.strip():
        req.note = payload.note.strip()
    req.admin_note = "Proof / TID submitted — waiting Admin confirmation"
    db.commit()
    db.refresh(req)
    return {
        "id": req.id,
        "reference_no": req.reference_no,
        "note": req.note,
        "admin_note": req.admin_note,
        "status": req.status,
    }


@router.post("/settlement-requests", status_code=status.HTTP_201_CREATED)
def submit_rider_settlement_request(
    payload: RiderSettlementSubmit,
    current_user: User = Depends(require_roles("rider")),
    db: Session = Depends(get_db),
):
    rp = db.query(RiderProfile).filter(RiderProfile.user_id == current_user.id).first()
    if not rp:
        raise HTTPException(status_code=404, detail="Rider profile not found")
    req = RiderSettlementRequest(
        rider_id=current_user.id,
        amount=round(float(payload.amount), 2),
        payment_channel=payload.payment_channel,
        reference_no=payload.reference_no.strip() if payload.reference_no else None,
        note=payload.note.strip() if payload.note else None,
        status="pending",
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return {
        "id": req.id,
        "amount": req.amount,
        "payment_channel": req.payment_channel,
        "reference_no": req.reference_no,
        "note": req.note,
        "account_title": "SafarGo",
        "status": req.status,
        "created_at": req.created_at,
    }
