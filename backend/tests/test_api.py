import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

TEST_DB = BACKEND_DIR / "test_mansehra.db"
if TEST_DB.exists():
    TEST_DB.unlink()

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
os.environ["JWT_SECRET"] = "test-secret-key-for-pytest-only-32bytes"

import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c
    if TEST_DB.exists():
        try:
            TEST_DB.unlink()
        except OSError:
            pass


def _auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_health_and_bootstrap(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

    boot = client.get("/api/public/bootstrap")
    assert boot.status_code == 200
    data = boot.json()
    assert len(data["zones"]) >= 50
    assert len(data["pricing_rules"]) == 4
    rule_types = {r["service_type"] for r in data["pricing_rules"]}
    assert {"bike_ride", "car_ride", "parcel", "errand"}.issubset(rule_types)
    zone_names = " | ".join(z["name"] for z in data["zones"])
    for hub in (
        "Abbottabad — Mandian / KKH",
        "Abbottabad — Supply Bazar",
        "Abbottabad — Jinnahabad",
        "Mansehra — Kashmir Road",
        "Mansehra — Balakot / Garhi Habibullah",
        "Haripur",
        "Battagram",
        "Islamabad Airport",
    ):
        assert hub in zone_names
    assert len(data["releases"]) == 2


def test_full_ride_commission_settlement_and_dynamic_rate_change(client):
    # 1. Login seeded Customer, Rider, Admin
    cust_login = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03334444444", "password": "user123"},
    )
    assert cust_login.status_code == 200
    cust_token = cust_login.json()["access_token"]

    rider_login = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03112222222", "password": "rider123"},
    )
    assert rider_login.status_code == 200
    rider_token = rider_login.json()["access_token"]
    rider_user = rider_login.json()["user"]

    admin_login = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03001111111", "password": "admin123"},
    )
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["access_token"]

    # Fresh Captain starts unverified; partial doc saves progress, blocks verify until all 4 docs + Admin approval
    sample_jpg = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q=="
    assert rider_user["rider_profile"]["is_verified"] is False
    blocked_verify = client.patch(
        f"/api/admin/riders/{rider_user['id']}",
        headers=_auth_header(admin_token),
        json={"is_verified": True},
    )
    assert blocked_verify.status_code == 400

    partial = client.patch(
        "/api/riders/profile",
        headers=_auth_header(rider_token),
        json={"rider_photo": sample_jpg},
    )
    assert partial.status_code == 200
    p_rp = partial.json()["rider_profile"]
    assert p_rp["rider_photo"] == sample_jpg
    assert p_rp["has_required_docs"] is False
    assert p_rp["is_verified"] is False
    assert p_rp["verification_status"] == "incomplete"
    assert len(p_rp["missing_required_docs"]) == 3

    blocked_partial = client.patch(
        f"/api/admin/riders/{rider_user['id']}",
        headers=_auth_header(admin_token),
        json={"is_verified": True},
    )
    assert blocked_partial.status_code == 400

    completed_docs = client.patch(
        "/api/riders/profile",
        headers=_auth_header(rider_token),
        json={
            "vehicle_photo": sample_jpg,
            "cnic_front_photo": sample_jpg,
            "cnic_back_photo": sample_jpg,
        },
    )
    assert completed_docs.status_code == 200
    c_rp = completed_docs.json()["rider_profile"]
    assert c_rp["has_required_docs"] is True
    assert c_rp["is_verified"] is False
    assert c_rp["verification_status"] == "pending"

    approved = client.patch(
        f"/api/admin/riders/{rider_user['id']}",
        headers=_auth_header(admin_token),
        json={"is_verified": True},
    )
    assert approved.status_code == 200
    assert client.post("/api/riders/toggle-online", headers=_auth_header(rider_token)).status_code == 200

    # 2. Customer books a 4 km ride (base 100 + 4*50 = 300) with MANSEHRA20 promo -> 280
    est = client.post(
        "/api/public/estimate",
        json={
            "service_type": "bike_ride",
            "pickup_zone": "Main Bazar / Lari Adda",
            "drop_zone": "Ghazikot Township",
            "distance_km": 4.0,
            "promo_code": "MANSEHRA20",
        },
    )
    assert est.status_code == 200
    assert est.json()["estimated_fare"] == 280.0

    booking_res = client.post(
        "/api/bookings",
        headers=_auth_header(cust_token),
        json={
            "service_type": "bike_ride",
            "pickup_zone": "Main Bazar / Lari Adda",
            "pickup_address": "Lari Adda Gate 2",
            "drop_zone": "Ghazikot Township",
            "drop_address": "Sector A Park",
            "distance_km": 4.0,
            "payment_method": "cash",
            "promo_code": "MANSEHRA20",
        },
    )
    assert booking_res.status_code == 201
    booking = booking_res.json()
    assert booking["final_fare"] == 280.0
    assert booking["status"] == "pending"

    # 3. Rider accepts & completes ride (15% of 280 = 42.0 admin commission; 238.0 rider earning)
    acc = client.post(f"/api/riders/jobs/{booking['id']}/accept", headers=_auth_header(rider_token))
    assert acc.status_code == 200
    assert acc.json()["status"] == "assigned"

    comp = client.post(
        f"/api/riders/jobs/{booking['id']}/status",
        headers=_auth_header(rider_token),
        json={"status": "completed"},
    )
    assert comp.status_code == 200
    done_booking = comp.json()
    assert done_booking["commission_amount"] == 42.0
    assert done_booking["rider_earning"] == 238.0

    # Check rider ledger increased by +42.0 (from initial seeded 24.0 -> 66.0)
    ledger_before = client.get("/api/riders/ledger", headers=_auth_header(rider_token)).json()
    assert ledger_before["summary"]["balance_due_to_admin"] == 66.0

    # 4. Admin changes commission rate from 15% to 20% live!
    upd = client.patch(
        "/api/admin/pricing/bike_ride",
        headers=_auth_header(admin_token),
        json={"commission_type": "percent", "commission_value": 20.0},
    )
    assert upd.status_code == 200
    assert upd.json()["commission_value"] == 20.0

    # Historical booking keeps 15% snapshot (42.0), while new estimate uses 20%
    hist_list = client.get("/api/admin/bookings", headers=_auth_header(admin_token)).json()
    past = next(b for b in hist_list if b["id"] == booking["id"])
    assert past["commission_amount"] == 42.0
    assert past["commission_rate_snapshot"] == 15.0

    new_est = client.post(
        "/api/public/estimate",
        json={
            "service_type": "bike_ride",
            "pickup_zone": "Main Bazar / Lari Adda",
            "drop_zone": "Ghazikot Township",
            "distance_km": 4.0,
        },
    )
    assert new_est.status_code == 200
    assert new_est.json()["estimated_commission"] == 60.0  # 20% of 300

    # 5. Admin collects cash settlement Rs. 66 from Rider 1 -> balance becomes 0.0
    rider_id = rider_login.json()["user"]["id"]
    sett = client.post(
        "/api/finance/settlements",
        headers=_auth_header(admin_token),
        json={
            "rider_id": rider_id,
            "amount": 66.0,
            "entry_type": "settlement_to_admin",
            "payment_channel": "cash",
            "note": "Settled at office",
        },
    )
    assert sett.status_code == 201
    assert sett.json()["balance_after"] == 0.0

    # 6. Admin P&L Report & CSV export work cleanly
    pnl = client.get("/api/reports/pnl", headers=_auth_header(admin_token))
    assert pnl.status_code == 200
    summary = pnl.json()["summary"]
    assert summary["admin_commission_earned"] == 99.3  # 24.0 + 33.3 (seeded) + 42.0
    assert summary["net_business_profit"] == 49.3  # 99.3 - 50.0 seeded expense

    csv_res = client.get("/api/reports/export-csv", headers=_auth_header(admin_token))
    assert csv_res.status_code == 200
    assert "Booking Code" in csv_res.text


def test_admin_full_crud_and_only_admin_password_control(client):
    admin_login = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03001111111", "password": "admin123"},
    ).json()
    admin_token = admin_login["access_token"]
    admin_id = admin_login["user"]["id"]

    cust_login = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03334444444", "password": "user123"},
    ).json()
    cust_token = cust_login["access_token"]
    cust_id = cust_login["user"]["id"]

    rider_login = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03112222222", "password": "rider123"},
    ).json()
    rider_token = rider_login["access_token"]
    rider_id = rider_login["user"]["id"]

    # Non-admins MUST be blocked (403) from changing any password
    assert (
        client.patch(
            f"/api/admin/users/{cust_id}/password",
            headers=_auth_header(cust_token),
            json={"new_password": "hacked"},
        ).status_code
        == 403
    )
    assert (
        client.patch(
            f"/api/admin/users/{rider_id}/password",
            headers=_auth_header(rider_token),
            json={"new_password": "hacked"},
        ).status_code
        == 403
    )

    # Admin changes Customer password -> old fails, new works
    res_pw = client.patch(
        f"/api/admin/users/{cust_id}/password",
        headers=_auth_header(admin_token),
        json={"new_password": "newuser999"},
    )
    assert res_pw.status_code == 200
    assert (
        client.post(
            "/api/auth/login",
            json={"phone_or_email": "03334444444", "password": "user123"},
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/auth/login",
            json={"phone_or_email": "03334444444", "password": "newuser999"},
        ).status_code
        == 200
    )

    # Admin creates, edits, and deletes a Zone
    z_add = client.post(
        "/api/admin/zones",
        headers=_auth_header(admin_token),
        json={"name": "Test Zone MNS", "area_tag": "North", "approx_km_from_center": 5, "surcharge": 20},
    )
    assert z_add.status_code == 201
    zid = z_add.json()["id"]
    z_edit = client.patch(
        f"/api/admin/zones/{zid}",
        headers=_auth_header(admin_token),
        json={"surcharge": 35},
    )
    assert z_edit.status_code == 200
    assert z_edit.json()["surcharge"] == 35.0
    assert client.delete(f"/api/admin/zones/{zid}", headers=_auth_header(admin_token)).status_code == 200

    # Admin changes Admin password -> works
    assert (
        client.patch(
            f"/api/admin/users/{admin_id}/password",
            headers=_auth_header(admin_token),
            json={"new_password": "superadmin99"},
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/api/auth/login",
            json={"phone_or_email": "03001111111", "password": "superadmin99"},
        ).status_code
        == 200
    )


def test_seed_idempotent_after_admin_phone_update(client):
    from app.database import SessionLocal
    from app.seed import seed_initial_data

    # Admin updates phone while keeping original email (triggers restart-seed test)
    login = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03001111111", "password": "superadmin99"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]

    upd = client.patch(
        "/api/admin/profile",
        headers=_auth_header(token),
        json={"phone": "03139620729"},
    )
    assert upd.status_code == 200

    # Re-running seed on startup must NOT raise IntegrityError on duplicate email
    db = SessionLocal()
    try:
        seed_initial_data(db)
    finally:
        db.close()

    assert (
        client.post(
            "/api/auth/login",
            json={"phone_or_email": "03139620729", "password": "superadmin99"},
        ).status_code
        == 200
    )


def test_car_ride_and_intercity_airport_estimate(client):
    est = client.post(
        "/api/public/estimate",
        json={
            "service_type": "car_ride",
            "pickup_zone": "Abbottabad (City / Fawara Chowk)",
            "drop_zone": "Islamabad Airport (New IIA)",
            "distance_km": 125.0,
        },
    )
    assert est.status_code == 200
    data = est.json()
    assert data["service_type"] == "car_ride"
    assert data["zone_surcharge"] == 600.0
    assert data["estimated_fare"] > 5000.0
    assert data["estimated_commission"] > 0
    assert data["estimated_rider_earning"] > 0

    # Local in-city Abbottabad ride has zero intercity surcharge bloat
    atd_local = client.post(
        "/api/public/estimate",
        json={
            "service_type": "bike_ride",
            "pickup_zone": "Abbottabad — Mandian / KKH",
            "drop_zone": "Abbottabad — Supply Bazar",
            "distance_km": 4.0,
        },
    )
    assert atd_local.status_code == 200
    assert atd_local.json()["zone_surcharge"] == 0.0
    assert atd_local.json()["estimated_fare"] == 300.0  # base 100 + 4*50


def test_new_fares_mansehra_parcel_slab_and_wait_charges(client):
    # 1. Bike Ride: base 100 + 50/km
    bike_est = client.post(
        "/api/public/estimate",
        json={
            "service_type": "bike_ride",
            "pickup_zone": "Main Bazar / Lari Adda",
            "drop_zone": "College Doraha",
            "distance_km": 2.0,
            "wait_minutes": 8,  # 5 free -> 3 * 10 = Rs. 30 wait charge
        },
    ).json()
    assert bike_est["estimated_fare"] == 230.0  # 100 + 100 + 30
    assert bike_est["billable_wait_minutes"] == 3
    assert bike_est["wait_charge"] == 30.0

    # 2. Car Ride: base 150 + 80/km, 5 min free then Rs. 10/min
    car_est = client.post(
        "/api/public/estimate",
        json={
            "service_type": "car_ride",
            "pickup_zone": "Abbottabad — Mandian / KKH",
            "drop_zone": "Abbottabad — Supply Bazar",
            "distance_km": 4.0,
            "wait_minutes": 9,  # 5 free -> 4 * 10 = Rs. 40 wait charge
        },
    ).json()
    assert car_est["estimated_fare"] == 510.0  # 150 + 320 + 40
    assert car_est["wait_charge"] == 40.0

    # 3. Parcel Mansehra In-City Slab: <=3 km fixed Rs. 250, after 3 km +Rs. 50/km
    mns_parcel_2 = client.post(
        "/api/public/estimate",
        json={
            "service_type": "parcel",
            "pickup_zone": "Main Bazar / Lari Adda",
            "drop_zone": "Ghazikot Township",
            "distance_km": 2.0,
        },
    ).json()
    assert mns_parcel_2["city_slab_applied"] is True
    assert mns_parcel_2["estimated_fare"] == 250.0

    mns_parcel_5 = client.post(
        "/api/public/estimate",
        json={
            "service_type": "parcel",
            "pickup_zone": "Main Bazar / Lari Adda",
            "drop_zone": "Ghazikot Township",
            "distance_km": 5.0,
        },
    ).json()
    assert mns_parcel_5["city_slab_applied"] is True
    assert mns_parcel_5["estimated_fare"] == 350.0  # 250 + (5-3)*50

    # Outside Mansehra (e.g. Abbottabad parcel): uses base 100 + 50/km
    atd_parcel_2 = client.post(
        "/api/public/estimate",
        json={
            "service_type": "parcel",
            "pickup_zone": "Abbottabad — Mandian / KKH",
            "drop_zone": "Abbottabad — Supply Bazar",
            "distance_km": 2.0,
        },
    ).json()
    assert atd_parcel_2["city_slab_applied"] is False
    assert atd_parcel_2["estimated_fare"] == 200.0  # 100 + 2*50

    # 4. Rider wait charge added once when starting ride and preserved on completion + Admin dynamic rate edit
    admin_token = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03139620729", "password": "superadmin99"},
    ).json()["access_token"]
    rider_token = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03112222222", "password": "rider123"},
    ).json()["access_token"]
    cust_token = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03334444444", "password": "newuser999"},
    ).json()["access_token"]

    b = client.post(
        "/api/bookings",
        headers=_auth_header(cust_token),
        json={
            "service_type": "car_ride",
            "pickup_zone": "Main Bazar / Lari Adda",
            "pickup_address": "Lari Adda",
            "drop_zone": "Ghazikot Township",
            "drop_address": "Sector B",
            "distance_km": 2.0,
            "payment_method": "cash",
        },
    ).json()
    assert b["final_fare"] == 310.0  # 150 + 2*80

    assert client.post(f"/api/riders/jobs/{b['id']}/accept", headers=_auth_header(rider_token)).status_code == 200
    assert client.post(
        f"/api/riders/jobs/{b['id']}/status",
        headers=_auth_header(rider_token),
        json={"status": "arrived"},
    ).status_code == 200
    started = client.post(
        f"/api/riders/jobs/{b['id']}/status",
        headers=_auth_header(rider_token),
        json={"status": "in_progress", "wait_minutes": 9},
    ).json()
    assert started["wait_charge"] == 40.0
    assert started["final_fare"] == 350.0  # 310 + 40

    done = client.post(
        f"/api/riders/jobs/{b['id']}/status",
        headers=_auth_header(rider_token),
        json={"status": "completed"},
    ).json()
    assert done["wait_charge"] == 40.0
    assert done["final_fare"] == 350.0  # no double-charging

    # Admin updates car base fare & late fee dynamically
    patch_car = client.patch(
        "/api/admin/pricing/car_ride",
        headers=_auth_header(admin_token),
        json={"base_fare": 200.0, "wait_charge_per_min": 15.0},
    )
    assert patch_car.status_code == 200
    car_after = client.post(
        "/api/public/estimate",
        json={
            "service_type": "car_ride",
            "pickup_zone": "Abbottabad — Mandian / KKH",
            "drop_zone": "Abbottabad — Supply Bazar",
            "distance_km": 2.0,
            "wait_minutes": 7,  # 2 billable * 15 = 30
        },
    ).json()
    assert car_after["estimated_fare"] == 390.0  # 200 + 160 + 30


def test_live_gps_nearby_captains_and_admin_live_map(client):
    # 1. Bootstrap returns GPS coordinates on zones
    boot = client.get("/api/public/bootstrap").json()
    assert all(z["lat"] is not None and z["lng"] is not None for z in boot["zones"])

    # 2. Captain updates GPS location & appears in nearby-captains for Customer's home GPS
    rider_token = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03112222222", "password": "rider123"},
    ).json()["access_token"]
    loc_res = client.post(
        "/api/riders/location",
        headers=_auth_header(rider_token),
        json={"lat": 34.3340, "lng": 73.2001},
    )
    assert loc_res.status_code == 200
    assert loc_res.json()["current_lat"] == 34.334

    nearby = client.get("/api/public/nearby-captains?lat=34.3335&lng=73.1995&service_type=bike_ride")
    assert nearby.status_code == 200
    caps = nearby.json()
    assert len(caps) >= 1
    assert "phone" not in caps[0]
    assert caps[0]["lat"] is not None and caps[0]["eta_min"] >= 2
    assert caps[0]["rider_photo"].startswith("data:image/")
    assert caps[0]["vehicle_photo"].startswith("data:image/")

    # 3. Customer books from home GPS pin -> Rider accepts -> Customer sees rider GPS & Admin live-map shows both
    cust_token = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03334444444", "password": "newuser999"},
    ).json()["access_token"]
    admin_token = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03139620729", "password": "superadmin99"},
    ).json()["access_token"]

    bk = client.post(
        "/api/bookings",
        headers=_auth_header(cust_token),
        json={
            "service_type": "bike_ride",
            "pickup_zone": "Main Bazar / Lari Adda",
            "pickup_address": "House 14, College St",
            "pickup_lat": 34.3361,
            "pickup_lng": 73.1982,
            "drop_zone": "Ghazikot Township",
            "drop_address": "Sector C Markaz",
            "drop_lat": 34.3171,
            "drop_lng": 73.1915,
            "distance_km": 2.9,
            "payment_method": "cash",
        },
    ).json()
    assert bk["pickup_lat"] == 34.3361
    assert bk["drop_lat"] == 34.3171

    assert client.post(f"/api/riders/jobs/{bk['id']}/accept", headers=_auth_header(rider_token)).status_code == 200

    my_rides = client.get("/api/bookings/my", headers=_auth_header(cust_token)).json()
    active_ride = next(r for r in my_rides if r["id"] == bk["id"])
    assert active_ride["rider"]["current_lat"] == 34.334

    live_map = client.get("/api/admin/live-map", headers=_auth_header(admin_token))
    assert live_map.status_code == 200
    lm = live_map.json()
    assert len(lm["captains"]) >= 2
    assert any(c.get("rider_photo", "").startswith("data:image/") for c in lm["captains"])
    assert any(b["id"] == bk["id"] and b["pickup_lat"] == 34.3361 for b in lm["active_bookings"])


def test_customer_feedback_and_complaint_flow(client):
    cust_token = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03334444444", "password": "newuser999"},
    ).json()["access_token"]
    admin_token = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03139620729", "password": "superadmin99"},
    ).json()["access_token"]

    my_rides = client.get("/api/bookings/my", headers=_auth_header(cust_token)).json()
    assert len(my_rides) >= 1
    target_ride = my_rides[0]

    # Non-existent booking id returns 404
    bad_ticket = client.post(
        "/api/support/tickets",
        headers=_auth_header(cust_token),
        json={
            "booking_id": 999999,
            "category": "fare_dispute",
            "subject": "Invalid booking link",
            "message": "Testing booking ownership validation",
        },
    )
    assert bad_ticket.status_code == 404

    # Customer submits ride-linked fare complaint
    complaint_res = client.post(
        "/api/support/tickets",
        headers=_auth_header(cust_token),
        json={
            "booking_id": target_ride["id"],
            "category": "fare_dispute",
            "subject": f"Fare review for {target_ride['booking_code']}",
            "message": "Please verify waiting time charges on this trip.",
        },
    )
    assert complaint_res.status_code == 201
    complaint = complaint_res.json()
    assert complaint["category"] == "fare_dispute"
    assert complaint["booking_id"] == target_ride["id"]
    assert complaint["booking_code"] == target_ride["booking_code"]

    # Customer submits general positive feedback
    fb_res = client.post(
        "/api/support/tickets",
        headers=_auth_header(cust_token),
        json={
            "category": "feedback",
            "subject": "Great SafarGo pickup speed",
            "message": "Pakhwal Chowk search and rider arrival worked nicely.",
        },
    )
    assert fb_res.status_code == 201
    assert fb_res.json()["category"] == "feedback"

    # Admin inspects tickets and replies
    admin_tickets = client.get("/api/admin/tickets", headers=_auth_header(admin_token))
    assert admin_tickets.status_code == 200
    t_list = admin_tickets.json()
    matched = next(t for t in t_list if t["id"] == complaint["id"])
    assert matched["booking_code"] == target_ride["booking_code"]
    assert matched["category"] == "fare_dispute"

    reply_res = client.patch(
        f"/api/admin/tickets/{complaint['id']}",
        headers=_auth_header(admin_token),
        json={"status": "resolved", "admin_reply": "Reviewed wait logs and confirmed exact tariff."},
    )
    assert reply_res.status_code == 200
    assert reply_res.json()["status"] == "resolved"

    # Customer sees admin reply live in my tickets
    cust_tickets = client.get("/api/support/tickets/my", headers=_auth_header(cust_token)).json()
    resolved = next(t for t in cust_tickets if t["id"] == complaint["id"])
    assert resolved["status"] == "resolved"
    assert "Reviewed wait logs" in resolved["admin_reply"]
    assert resolved["booking_code"] == target_ride["booking_code"]


def test_mansehra_chowks_and_roads_distinct_coordinates(client):
    zones = client.get("/api/public/bootstrap").json()["zones"]
    by_name = {z["name"]: z for z in zones}

    required_zones = [
        "Mansehra — Punjab Chowk",
        "Mansehra — Baidra Chowk",
        "Mansehra — Baidra Road",
        "Mansehra — Dhangri Chowk",
        "Mansehra — Safdar Chowk",
        "Mansehra — Safdar Road / Dab No. 1",
        "Mansehra — Shahnawaz Chowk",
        "Mansehra — Chowk Khatm-e-Nabuwat",
        "Mansehra — Main Chowk Bazar",
        "Mansehra — Pakhwal Chowk",
        "Mansehra — Pakhwal Road",
        "Mansehra — Township Bypass Chowk",
        "Mansehra — Phagla Chowk (N-15)",
        "Mansehra — Karakoram Highway (KKH / N-35)",
        "Mansehra — Hazara Motorway (M-15 / E-35)",
        "Mansehra — Naran–Jalkhad Road (N-15)",
        "Mansehra — Mansehra Bypass Road",
        "Mansehra — Jail Road",
        "Mansehra — Chinar Road",
        "Mansehra — Oghi Road",
    ]
    for name in required_zones:
        assert name in by_name, f"Missing expected Mansehra zone: {name}"
        assert by_name[name]["lat"] is not None and by_name[name]["lng"] is not None

    # Chowks vs Roads must have strictly distinct GPS pins
    assert (by_name["Mansehra — Baidra Chowk"]["lat"], by_name["Mansehra — Baidra Chowk"]["lng"]) != (
        by_name["Mansehra — Baidra Road"]["lat"],
        by_name["Mansehra — Baidra Road"]["lng"],
    )
    assert (by_name["Mansehra — Safdar Chowk"]["lat"], by_name["Mansehra — Safdar Chowk"]["lng"]) != (
        by_name["Mansehra — Safdar Road / Dab No. 1"]["lat"],
        by_name["Mansehra — Safdar Road / Dab No. 1"]["lng"],
    )
    assert (by_name["Mansehra — Pakhwal Chowk"]["lat"], by_name["Mansehra — Pakhwal Chowk"]["lng"]) != (
        by_name["Mansehra — Pakhwal Road"]["lat"],
        by_name["Mansehra — Pakhwal Road"]["lng"],
    )


def test_safargo_digital_payments_paid_status_and_admin_discount(client):
    admin_token = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03139620729", "password": "superadmin99"},
    ).json()["access_token"]
    cust_token = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03334444444", "password": "newuser999"},
    ).json()["access_token"]
    rider_token = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03112222222", "password": "rider123"},
    ).json()["access_token"]

    # 1. Admin configures Bank, EasyPaisa, UPaisa under SafarGo account title
    for key, val in [
        ("payment_account_title", "SafarGo"),
        ("payment_easypaisa", "03001234567"),
        ("payment_upaisa", "03331234567"),
        ("payment_bank_name", "Meezan Bank"),
        ("payment_bank_account", "PK00MEZN0001234567"),
    ]:
        res = client.put(f"/api/admin/settings/{key}", headers=_auth_header(admin_token), json={"value": val})
        assert res.status_code == 200

    boot = client.get("/api/public/bootstrap").json()
    assert boot["settings"]["payment_account_title"] == "SafarGo"
    assert boot["settings"]["payment_upaisa"] == "03331234567"
    assert boot["settings"]["payment_bank_account"] == "PK00MEZN0001234567"

    # 2. Customer creates ride with UPaisa -> submits digital payment proof -> Admin applies discount -> marks Paid
    bk_res = client.post(
        "/api/bookings",
        headers=_auth_header(cust_token),
        json={
            "service_type": "bike_ride",
            "pickup_zone": "Mansehra — Punjab Chowk",
            "pickup_address": "Punjab Chowk",
            "drop_zone": "Mansehra — Pakhwal Chowk",
            "drop_address": "Pakhwal Chowk",
            "distance_km": 4.0,
            "payment_method": "upaisa",
        },
    )
    assert bk_res.status_code == 201
    bk = bk_res.json()
    orig_fare = bk["final_fare"]
    assert bk["payment_status"] == "pending"

    sub_res = client.post(
        f"/api/bookings/{bk['id']}/submit-payment",
        headers=_auth_header(cust_token),
        json={"payment_method": "bank", "payment_reference": "TID-998877"},
    )
    assert sub_res.status_code == 200
    assert sub_res.json()["payment_status"] == "submitted"
    assert sub_res.json()["payment_method"] == "bank"
    assert sub_res.json()["payment_reference"] == "TID-998877"

    # Admin gives Rs. 50 customer discount -> final_fare automatically decreases by 50
    disc_res = client.patch(
        f"/api/admin/bookings/{bk['id']}",
        headers=_auth_header(admin_token),
        json={"discount_amount": 50.0},
    )
    assert disc_res.status_code == 200
    assert disc_res.json()["discount_amount"] == 50.0
    assert disc_res.json()["final_fare"] == orig_fare - 50.0

    # Admin marks Paid -> payment_status becomes "paid"
    paid_res = client.post(f"/api/admin/bookings/{bk['id']}/mark-paid", headers=_auth_header(admin_token), json={})
    assert paid_res.status_code == 200
    assert paid_res.json()["payment_status"] == "paid"

    # 3. Admin manual booking with explicit Discount subtracts discount from custom fare
    man_res = client.post(
        "/api/admin/bookings/manual",
        headers=_auth_header(admin_token),
        json={
            "customer_phone": "03334444444",
            "service_type": "car_ride",
            "pickup_zone": "Mansehra — Punjab Chowk",
            "pickup_address": "Punjab Chowk",
            "drop_zone": "Mansehra — Baidra Road",
            "drop_address": "Baidra Road",
            "distance_km": 3.0,
            "payment_method": "easypaisa",
            "custom_fare": 400.0,
            "discount_amount": 80.0,
        },
    )
    assert man_res.status_code == 201
    assert man_res.json()["discount_amount"] == 80.0
    assert man_res.json()["final_fare"] == 320.0

    # 4. Captain sends Bank settlement proof to SafarGo -> Admin marks Paid -> ledger uses "SafarGo", never Admin personal name
    req_res = client.post(
        "/api/riders/settlement-requests",
        headers=_auth_header(rider_token),
        json={"amount": 100.0, "payment_channel": "bank", "reference_no": "BNK-4411"},
    )
    assert req_res.status_code == 201
    assert req_res.json()["account_title"] == "SafarGo"
    assert req_res.json()["status"] == "pending"

    reqs = client.get("/api/finance/settlement-requests", headers=_auth_header(admin_token)).json()
    target_req = next(r for r in reqs if r["id"] == req_res.json()["id"])
    assert target_req["account_title"] == "SafarGo"

    app_res = client.post(
        f"/api/finance/settlement-requests/{target_req['id']}/mark-paid",
        headers=_auth_header(admin_token),
    )
    assert app_res.status_code == 200
    assert app_res.json()["status"] == "paid"

    ledger_entries = client.get("/api/finance/ledger", headers=_auth_header(admin_token)).json()
    assert len(ledger_entries) > 0
    assert all(e["recorded_by"] == "SafarGo" for e in ledger_entries)


def test_admin_per_trip_km_and_office_contact_settings(client):
    admin_token = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03139620729", "password": "superadmin99"},
    ).json()["access_token"]

    # 1. Riders list exposes total_distance_km and per-trip distance_km in recent_trips
    riders = client.get("/api/admin/riders", headers=_auth_header(admin_token))
    assert riders.status_code == 200
    r_rows = riders.json()
    assert any(r["total_distance_km"] > 0 and len(r["recent_trips"]) >= 1 for r in r_rows)
    first_with_trips = next(r for r in r_rows if len(r["recent_trips"]) >= 1)
    assert "distance_km" in first_with_trips["recent_trips"][0]

    # 2. Admin edits office_address, support_phone, support_whatsapp, office_hours -> reflected in public bootstrap
    updates = {
        "office_address": "Paracha Plaza, Shahrah-e-Resham, Mansehra",
        "support_phone": "+92 311 5550199",
        "support_whatsapp": "+92 311 5550199",
        "office_hours": "24/7 Dispatch · 9 AM – 10 PM",
    }
    for k, v in updates.items():
        res = client.put(f"/api/admin/settings/{k}", headers=_auth_header(admin_token), json={"value": v})
        assert res.status_code == 200

    boot_settings = client.get("/api/public/bootstrap").json()["settings"]
    for k, v in updates.items():
        assert boot_settings[k] == v


def test_indrive_direct_bidding_and_equal_bike_car_verification_uploads(client):
    sample_jpg = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q=="

    admin_token = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03139620729", "password": "superadmin99"},
    ).json()["access_token"]
    cust_token = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03334444444", "password": "newuser999"},
    ).json()["access_token"]

    # 1. New Bike Captain & New Car Captain both register and upload Selfie, Vehicle Photo, CNIC Front/Back equally
    bike_reg = client.post(
        "/api/auth/register",
        json={
            "full_name": "Hamza Bike Captain",
            "phone": "03150001111",
            "password": "pass1234",
            "role": "rider",
            "vehicle_type": "bike",
            "bike_model": "Honda CG-125",
            "bike_plate": "MNS-7001",
            "cnic_number": "13503-1111111-1",
            "rider_photo": sample_jpg,
            "vehicle_photo": sample_jpg,
            "cnic_front_photo": sample_jpg,
            "cnic_back_photo": sample_jpg,
        },
    )
    assert bike_reg.status_code == 201
    bike_user = bike_reg.json()["user"]
    bike_token = bike_reg.json()["access_token"]
    assert bike_user["rider_profile"]["vehicle_type"] == "bike"
    assert bike_user["rider_profile"]["has_required_docs"] is True
    assert bike_user["rider_profile"]["verification_status"] == "pending"

    # New Car Captain uploads vehicle + selfie via Profile PATCH equally
    car_reg = client.post(
        "/api/auth/register",
        json={
            "full_name": "Tariq Car Captain",
            "phone": "03150002222",
            "password": "pass1234",
            "role": "rider",
            "vehicle_type": "car",
            "bike_model": "Toyota Corolla GLi",
            "bike_plate": "MNS-8822",
            "cnic_number": "13503-2222222-3",
        },
    )
    assert car_reg.status_code == 201
    car_token = car_reg.json()["access_token"]
    car_id = car_reg.json()["user"]["id"]
    assert car_reg.json()["user"]["rider_profile"]["verification_status"] == "incomplete"

    upd_car = client.patch(
        "/api/riders/profile",
        headers=_auth_header(car_token),
        json={
            "rider_photo": sample_jpg,
            "vehicle_photo": sample_jpg,
            "cnic_front_photo": sample_jpg,
            "cnic_back_photo": sample_jpg,
        },
    )
    assert upd_car.status_code == 200
    assert upd_car.json()["rider_profile"]["has_required_docs"] is True
    assert upd_car.json()["rider_profile"]["verification_status"] == "pending"

    # Admin inspects uploaded docs and verifies both Bike & Car Captains
    admin_riders = client.get("/api/admin/riders", headers=_auth_header(admin_token)).json()
    car_row = next(r for r in admin_riders if r["id"] == car_id)
    assert car_row["rider_photo"] == sample_jpg
    assert car_row["vehicle_photo"] == sample_jpg
    assert car_row["cnic_front_photo"] == sample_jpg
    assert car_row["cnic_back_photo"] == sample_jpg

    assert (
        client.patch(
            f"/api/admin/riders/{bike_user['id']}",
            headers=_auth_header(admin_token),
            json={"is_verified": True},
        ).status_code
        == 200
    )
    assert (
        client.patch(
            f"/api/admin/riders/{car_id}",
            headers=_auth_header(admin_token),
            json={"is_verified": True},
        ).status_code
        == 200
    )

    # 2. Customer books an AC Car Ride with custom InDrive offer fare -> NO Admin approval needed!
    car_book = client.post(
        "/api/bookings",
        headers=_auth_header(cust_token),
        json={
            "service_type": "car_ride",
            "pickup_zone": "Mansehra — Punjab Chowk",
            "pickup_address": "Punjab Chowk",
            "drop_zone": "Mansehra — Pakhwal Chowk",
            "drop_address": "Pakhwal Chowk",
            "distance_km": 4.0,
            "payment_method": "cash",
            "offer_fare": 420.0,
        },
    )
    assert car_book.status_code == 201
    bk = car_book.json()
    assert bk["status"] == "pending"
    assert bk["final_fare"] == 420.0

    # Bike Captain default job feed excludes car_ride; Car Captain job feed includes it immediately!
    bike_jobs = client.get("/api/riders/available-jobs", headers=_auth_header(bike_token)).json()
    assert not any(j["id"] == bk["id"] for j in bike_jobs)

    car_jobs = client.get("/api/riders/available-jobs", headers=_auth_header(car_token)).json()
    assert any(j["id"] == bk["id"] and j["matches_vehicle"] is True for j in car_jobs)

    # Customer raises fare + Car Captain sends InDrive counter-offer -> Customer accepts Captain directly!
    raised = client.post(
        f"/api/bookings/{bk['id']}/raise-fare",
        headers=_auth_header(cust_token),
        json={"new_fare": 450.0},
    )
    assert raised.status_code == 200
    assert raised.json()["final_fare"] == 450.0

    offer_res = client.post(
        f"/api/riders/jobs/{bk['id']}/offer",
        headers=_auth_header(car_token),
        json={"offered_fare": 480.0, "eta_minutes": 4, "note": "AC Corolla at Punjab Chowk"},
    )
    assert offer_res.status_code == 200
    offer = offer_res.json()
    assert offer["offered_fare"] == 480.0
    assert "cnic_number" not in (offer.get("rider") or {})

    # Customer inspects live offers & accepts Car Captain directly (ZERO Admin intervention!)
    cust_my = client.get("/api/bookings/my", headers=_auth_header(cust_token)).json()
    bk_with_offer = next(r for r in cust_my if r["id"] == bk["id"])
    assert len(bk_with_offer["offers"]) == 1
    assert bk_with_offer["offers"][0]["rider"]["rider_photo"] == sample_jpg
    assert bk_with_offer["offers"][0]["rider"]["vehicle_photo"] == sample_jpg

    accepted = client.post(
        f"/api/bookings/{bk['id']}/offers/{offer['id']}/accept",
        headers=_auth_header(cust_token),
    )
    assert accepted.status_code == 200
    matched = accepted.json()
    assert matched["status"] == "assigned"
    assert matched["rider_id"] == car_id
    assert matched["final_fare"] == 480.0
    assert matched["rider"]["vehicle_type"] == "car"
    assert matched["rider"]["rider_photo"] == sample_jpg
    assert matched["rider"]["vehicle_photo"] == sample_jpg


def test_admin_overview_and_pending_verification_photos(client):
    admin_token = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03139620729", "password": "superadmin99"},
    ).json()["access_token"]

    res = client.get("/api/admin/overview", headers=_auth_header(admin_token))
    assert res.status_code == 200
    data = res.json()
    assert "kpis" in data
    assert "today_total_rides" in data["kpis"]
    assert "today_completed_rides" in data["kpis"]
    assert "recent_bookings" in data
    assert "over_limit_riders" in data








