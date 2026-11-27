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
    assert data["settings"]["rider_topup_required"] == "true"
    assert data["settings"]["rider_topup_rides_count"] == "10"
    assert data["settings"]["rider_topup_package_fee"] == "100"


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

    # Temporarily switch to post-paid mode so legacy commission/settlement flow runs;
    # pre-paid top-up mode (default "true") is tested end-to-end below.
    assert (
        client.put(
            "/api/admin/settings/rider_topup_required",
            headers=_auth_header(admin_token),
            json={"value": "false"},
        ).status_code
        == 200
    )

    # Fresh Captain starts unverified; partial doc saves progress, stays unverified until Admin manually approves
    sample_jpg = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q=="
    assert rider_user["rider_profile"]["is_verified"] is False

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

    # Admin CAN manually verify even while docs are still incomplete/pending (Admin override option)
    admin_override = client.patch(
        f"/api/admin/riders/{rider_user['id']}",
        headers=_auth_header(admin_token),
        json={"is_verified": True},
    )
    assert admin_override.status_code == 200

    # Reset back to test full 4/4 pending flow -> still needs Admin verify
    client.patch(
        f"/api/admin/riders/{rider_user['id']}",
        headers=_auth_header(admin_token),
        json={"is_verified": False},
    )
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


def test_live_gps_resolves_baidra_chowk_and_notifies_closest_captain_and_admin(client):
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

    # Set Captain profile zone to Dhangri Chowk first, then push live Baidra Chowk GPS
    client.patch(
        "/api/riders/profile",
        headers=_auth_header(rider_token),
        json={"zone_name": "Mansehra — Dhangri Chowk"},
    )
    gps_res = client.post(
        "/api/riders/location",
        headers=_auth_header(rider_token),
        json={"lat": 34.334342, "lng": 73.187789},
    )
    assert gps_res.status_code == 200
    assert gps_res.json()["zone_name"] == "Mansehra — Baidra Chowk"

    # Customer books pickup at Baidra Chowk -> Captain & Admin both see nearest priority!
    bk_res = client.post(
        "/api/bookings",
        headers=_auth_header(cust_token),
        json={
            "service_type": "bike_ride",
            "pickup_zone": "Mansehra — Baidra Chowk",
            "pickup_address": "Baidra Chowk Motorway Stand",
            "pickup_lat": 34.334342,
            "pickup_lng": 73.187789,
            "drop_zone": "Mansehra — Punjab Chowk",
            "drop_address": "Punjab Chowk",
            "distance_km": 1.2,
            "payment_method": "cash",
        },
    )
    assert bk_res.status_code == 201
    created = bk_res.json()
    assert created["nearby_captains_notified"] >= 1

    avail = client.get("/api/riders/available-jobs", headers=_auth_header(rider_token)).json()
    target_job = next(j for j in avail if j["id"] == created["id"])
    assert target_job["is_closest_captain"] is True
    assert target_job["captain_distance_km"] <= 0.1

    ov = client.get("/api/admin/overview", headers=_auth_header(admin_token)).json()
    recent = next(b for b in ov["recent_bookings"] if b["id"] == created["id"])
    assert len(recent["nearest_captains"]) >= 1
    assert recent["nearest_captains"][0]["zone_name"] == "Mansehra — Baidra Chowk"


def test_admin_full_rider_and_customer_complete_edit(client):
    admin_token = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03139620729", "password": "superadmin99"},
    ).json()["access_token"]

    riders = client.get("/api/admin/riders", headers=_auth_header(admin_token)).json()
    bilal = next(r for r in riders if r["phone"] == "03123333333")

    upd = client.patch(
        f"/api/admin/riders/{bilal['id']}",
        headers=_auth_header(admin_token),
        json={
            "full_name": "Bilal Ahmed Updated",
            "email": "bilal.updated@safargo.pk",
            "password": "newpass99",
            "vehicle_type": "car",
            "bike_model": "Suzuki WagonR AC",
            "bike_plate": "MNS-9900",
            "cnic_number": "13503-9999999-9",
            "license_no": "MNS-DL-9900",
            "zone_name": "Mansehra — Punjab Chowk",
            "sync_zone_coords": True,
            "is_verified": True,
            "is_online": True,
            "credit_limit": 4500.0,
            "custom_commission_type": "percent",
            "custom_commission_value": 12.0,
        },
    )
    assert upd.status_code == 200

    riders_after = client.get("/api/admin/riders", headers=_auth_header(admin_token)).json()
    edited = next(r for r in riders_after if r["id"] == bilal["id"])
    assert edited["full_name"] == "Bilal Ahmed Updated"
    assert edited["email"] == "bilal.updated@safargo.pk"
    assert edited["vehicle_type"] == "car"
    assert edited["bike_model"] == "Suzuki WagonR AC"
    assert edited["bike_plate"] == "MNS-9900"
    assert edited["license_no"] == "MNS-DL-9900"
    assert edited["zone_name"] == "Mansehra — Punjab Chowk"
    assert edited["is_verified"] is True
    assert edited["is_online"] is True
    assert edited["credit_limit"] == 4500.0
    assert abs(edited["current_lat"] - 34.328548) < 0.001

    login_new = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03123333333", "password": "newpass99"},
    )
    assert login_new.status_code == 200

    custs = client.get("/api/admin/customers", headers=_auth_header(admin_token)).json()
    target_cust = next(c for c in custs if c["phone"] == "03334444444")
    c_upd = client.patch(
        f"/api/admin/customers/{target_cust['id']}",
        headers=_auth_header(admin_token),
        json={"full_name": "Hammad Raza Edited", "email": "hammad.edited@safargo.pk"},
    )
    assert c_upd.status_code == 200
    assert c_upd.json()["full_name"] == "Hammad Raza Edited"


def test_full_db_backup_download_and_restore(client):
    import gzip
    import json

    admin_token = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03139620729", "password": "superadmin99"},
    ).json()["access_token"]

    # 1. Verify SMTP & HTTPS relay credentials cannot leak publicly even if saved in settings
    client.put(
        "/api/admin/settings/backup_smtp_pass",
        headers=_auth_header(admin_token),
        json={"value": "super-secret-app-pw"},
    )
    client.put(
        "/api/admin/settings/backup_webhook_url",
        headers=_auth_header(admin_token),
        json={"value": "https://script.google.com/macros/s/test-secret/exec"},
    )
    client.put(
        "/api/admin/settings/backup_resend_key",
        headers=_auth_header(admin_token),
        json={"value": "re_test_secret_123"},
    )
    boot_settings = client.get("/api/public/bootstrap").json()["settings"]
    assert "backup_smtp_pass" not in boot_settings
    assert "backup_smtp_user" not in boot_settings
    assert "backup_webhook_url" not in boot_settings
    assert "backup_resend_key" not in boot_settings
    assert boot_settings.get("backup_email") == "gosafar4@gmail.com"

    admin_settings = client.get("/api/admin/settings", headers=_auth_header(admin_token)).json()
    assert admin_settings["backup_smtp_pass"] == ""
    assert admin_settings["backup_smtp_pass_configured"] == "true"
    assert admin_settings["backup_webhook_url"] == ""
    assert admin_settings["backup_webhook_url_configured"] == "true"
    assert admin_settings["backup_resend_key"] == ""
    assert admin_settings["backup_resend_key_configured"] == "true"

    # 2. Backup summary shows 04:00 AM PKT schedule, gosafar4@gmail.com, and HTTPS relay flag
    info = client.get("/api/admin/backups", headers=_auth_header(admin_token)).json()
    assert "04:00 AM PKT" in info["schedule_pkt"]
    assert info["backup_email"] == "gosafar4@gmail.com"
    assert info["https_relay_configured"] is True
    assert info["email_configured"] is True

    # 3. Take manual full backup -> compressed .json.gz in app directory & DB
    created_files = []
    try:
        run_res = client.post("/api/admin/backups/run", headers=_auth_header(admin_token))
        assert run_res.status_code == 200
        bk = run_res.json()
        assert bk["total_rows"] > 10
        assert bk["file_name"].endswith("-PKT.json.gz")
        if bk.get("local_path"):
            created_files.append(Path(bk["local_path"]))
            created_files.append(Path(bk["local_path"].replace(".json.gz", ".meta.json")))

        # Download gzipped snapshot & inspect tables
        dl = client.get(f"/api/admin/backups/{bk['id']}/download", headers=_auth_header(admin_token))
        assert dl.status_code == 200
        parsed = json.loads(gzip.decompress(dl.content).decode("utf-8"))
        assert parsed["service"] == "SafarGo"
        assert "users" in parsed["tables"] and "bookings" in parsed["tables"]

        # Mutate DB (add temporary promo), then restore from saved backup -> temp promo disappears
        p_res = client.post(
            "/api/admin/promos",
            headers=_auth_header(admin_token),
            json={"code": "TEMP99", "discount_type": "fixed", "discount_value": 10, "max_discount": 10, "min_fare": 50},
        )
        assert p_res.status_code == 201

        rst = client.post(f"/api/admin/backups/{bk['id']}/restore", headers=_auth_header(admin_token))
        assert rst.status_code == 200
        rst_data = rst.json()
        assert rst_data["status"] == "restored"
        assert rst_data["safety_backup_status"] == "local_only"
        assert rst_data["total_restored_rows"] > 10
        assert "PKT" in rst_data["restored_at_pkt"]
        assert "users" in rst_data["restored_counts"]
        safety_file = BACKUP_DIR_TEST / rst_data["safety_backup_file"] if (BACKUP_DIR_TEST := BACKEND_DIR.parent / "backups") else None
        if safety_file:
            created_files.append(safety_file)
            created_files.append(Path(str(safety_file).replace(".json.gz", ".meta.json")))

        # Verify safety backup stored in backups list shows local_only (not pending)
        after_list = client.get("/api/admin/backups", headers=_auth_header(admin_token)).json()["backups"]
        safety_row = next((x for x in after_list if x["file_name"] == rst_data["safety_backup_file"]), None)
        assert safety_row is not None
        assert safety_row["email_status"] == "local_only"

        promos_after = client.get("/api/admin/promos", headers=_auth_header(admin_token)).json()
        assert not any(p["code"] == "TEMP99" for p in promos_after)

        # Also test restore-file upload endpoint with an older backup missing emergency_* keys
        import gzip as _gzip
        import json as _json
        older_payload = _json.loads(_gzip.decompress(dl.content).decode("utf-8"))
        older_payload["tables"]["system_settings"] = [
            s for s in older_payload["tables"].get("system_settings", [])
            if s.get("key") not in ("emergency_rescue_number", "emergency_police_number")
        ]
        older_gz = _gzip.compress(_json.dumps(older_payload).encode("utf-8"))
        up_rst = client.post(
            "/api/admin/backups/restore-file",
            headers=_auth_header(admin_token),
            files={"file": (bk["file_name"], older_gz, "application/gzip")},
        )
        assert up_rst.status_code == 200
        assert up_rst.json()["status"] == "restored"
        assert up_rst.json()["safety_backup_status"] == "local_only"
        boot_after = client.get("/api/public/bootstrap").json()["settings"]
        assert boot_after["emergency_rescue_number"] == "1122"
        assert boot_after["emergency_police_number"] == "15"
        if up_rst.json().get("safety_backup_file"):
            sf2 = BACKEND_DIR.parent / "backups" / up_rst.json()["safety_backup_file"]
            created_files.append(sf2)
            created_files.append(Path(str(sf2).replace(".json.gz", ".meta.json")))
    finally:
        for fp in created_files:
            try:
                fp.unlink(missing_ok=True)
            except OSError:
                pass


def test_emergency_sos_and_1122_helplines(client):
    boot_settings = client.get("/api/public/bootstrap").json()["settings"]
    assert boot_settings["emergency_rescue_number"] == "1122"
    assert boot_settings["emergency_police_number"] == "15"

    # Log in as Admin, Bike Captain, AC Car Captain, and Customer
    admin_token = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03139620729", "password": "superadmin99"},
    ).json()["access_token"]
    bike_token = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03112222222", "password": "rider123"},
    ).json()["access_token"]
    car_token = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03145555555", "password": "rider123"},
    ).json()["access_token"]
    cust_res = client.post(
        "/api/auth/register",
        json={
            "full_name": "SOS Test Passenger",
            "phone": "03338881122",
            "password": "user123",
            "role": "customer",
        },
    )
    assert cust_res.status_code == 201
    cust_token = cust_res.json()["access_token"]

    # Customer creates a Car Ride booking & triggers SOS
    bk_res = client.post(
        "/api/bookings",
        headers=_auth_header(cust_token),
        json={
            "service_type": "car_ride",
            "pickup_zone": "Mansehra — Baidra Chowk",
            "pickup_address": "Baidra Chowk Stand",
            "pickup_lat": 34.334342,
            "pickup_lng": 73.187789,
            "drop_zone": "Mansehra — Punjab Chowk",
            "drop_address": "Punjab Chowk",
            "drop_lat": 34.328548,
            "drop_lng": 73.188513,
            "distance_km": 2.0,
            "payment_method": "cash",
        },
    )
    assert bk_res.status_code == 201
    car_booking = bk_res.json()

    # 1. Bike Captain triggers SOS near Baidra Chowk (Rescue 1122)
    bike_sos = client.post(
        "/api/sos/trigger",
        headers=_auth_header(bike_token),
        json={
            "emergency_type": "rescue_1122",
            "lat": 34.334342,
            "lng": 73.187789,
            "note": "Need ambulance 1122 near Baidra Chowk",
            "called_number": "1122",
        },
    )
    assert bike_sos.status_code == 201
    b_sos_data = bike_sos.json()
    assert b_sos_data["emergency_rescue_number"] == "1122"
    assert b_sos_data["emergency_police_number"] == "15"
    assert "Baidra Chowk" in b_sos_data["zone_name"]
    assert b_sos_data["status"] == "active"

    # 2. AC Car Captain triggers SOS (Police 15)
    car_sos = client.post(
        "/api/sos/trigger",
        headers=_auth_header(car_token),
        json={"emergency_type": "police_15", "note": "Car emergency", "called_number": "15"},
    )
    assert car_sos.status_code == 201
    assert car_sos.json()["vehicle_type"] == "car"

    # 3. Customer on Car Ride triggers SOS -> auto-links active Car booking
    cust_sos = client.post(
        "/api/sos/trigger",
        headers=_auth_header(cust_token),
        json={"emergency_type": "police_15", "note": "Need police 15 urgently", "called_number": "15"},
    )
    assert cust_sos.status_code == 201
    c_sos_data = cust_sos.json()
    assert c_sos_data["booking_code"] == car_booking["booking_code"]
    assert c_sos_data["service_type"] == "car_ride"

    # 4. Admin sees live active SOS alerts immediately in /overview & /admin/sos, can Acknowledge & Resolve
    ov = client.get("/api/admin/overview", headers=_auth_header(admin_token)).json()
    assert ov["kpis"]["active_sos_count"] >= 3
    sos_ids = {s["id"] for s in ov["active_sos_alerts"]}
    assert b_sos_data["id"] in sos_ids and c_sos_data["id"] in sos_ids

    ack = client.post(
        f"/api/admin/sos/{b_sos_data['id']}/status",
        headers=_auth_header(admin_token),
        json={"status": "acknowledged", "resolution_note": "Called 1122 Rescue"},
    )
    assert ack.status_code == 200
    assert ack.json()["status"] == "acknowledged"

    res = client.post(
        f"/api/admin/sos/{b_sos_data['id']}/status",
        headers=_auth_header(admin_token),
        json={"status": "resolved", "resolution_note": "Captain safe"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "resolved"

    # Resolve remaining SOS alerts & verify /api/sos/my reflects resolved state
    client.post(f"/api/admin/sos/{c_sos_data['id']}/status", headers=_auth_header(admin_token), json={"status": "resolved"})
    my_sos = client.get("/api/sos/my", headers=_auth_header(bike_token)).json()
    assert any(s["id"] == b_sos_data["id"] and s["status"] == "resolved" for s in my_sos)


def test_health_head_and_db_quota_resilience(client):
    from sqlalchemy.exc import OperationalError
    import app.main as main_mod
    from app.database import DatabaseUnavailableError, get_db

    head_res = client.head("/api/health")
    assert head_res.status_code == 200

    health_res = client.get("/api/health")
    assert health_res.status_code == 200
    h_data = health_res.json()
    assert h_data["status"] == "ok"
    assert h_data["database"] == "connected"

    err_kind, err_msg = main_mod._classify_db_error(
        Exception("ERROR: Your account or project has exceeded the quota. Upgrade your plan to increase limits.")
    )
    assert err_kind == "quota_exceeded"
    assert "quota" in err_msg.lower()

    def _broken_db_dep():
        raise DatabaseUnavailableError("quota_exceeded", err_msg)
        yield  # pragma: no cover

    app.dependency_overrides[get_db] = _broken_db_dep
    try:
        fail_boot = client.get("/api/public/bootstrap")
        assert fail_boot.status_code == 503
        assert fail_boot.json()["code"] == "db_quota_exceeded"
        assert fail_boot.json()["database"] == "quota_exceeded"
    finally:
        app.dependency_overrides.pop(get_db, None)

    def _op_err_dep():
        raise OperationalError("SELECT 1", {}, Exception("Your account or project has exceeded the quota"))
        yield  # pragma: no cover

    app.dependency_overrides[get_db] = _op_err_dep
    try:
        op_boot = client.get("/api/public/bootstrap")
        assert op_boot.status_code == 503
        assert op_boot.json()["code"] == "db_quota_exceeded"
        # Health stays 200 OK for Render edge so instance does not get stuck in hibernate loop
        degraded_health = client.get("/api/health")
        assert degraded_health.status_code == 200
        assert degraded_health.json()["database"] == "quota_exceeded"
    finally:
        app.dependency_overrides.pop(get_db, None)
        assert main_mod.initialize_database_once(force=True) is True


def test_prepaid_rider_topup_package_approval_and_deduction(client):
    admin_token = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03139620729", "password": "superadmin99"},
    ).json()["access_token"]
    cust_token = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03334444444", "password": "newuser999"},
    ).json()["access_token"]

    # Ensure Top-Up is ON (10 Rides = Rs. 100) and all receiving methods are configured
    for key, val in [
        ("rider_topup_required", "true"),
        ("rider_topup_rides_count", "10"),
        ("rider_topup_package_fee", "100"),
        ("rider_topup_car_package_fee", ""),
        ("payment_account_title", "SafarGo"),
        ("payment_easypaisa", "03001234567"),
        ("payment_upaisa", "03331234567"),
        ("payment_jazzcash", "03017654321"),
        ("payment_bank_name", "Meezan Bank"),
        ("payment_bank_account", "PK00MEZN0001234567"),
    ]:
        assert (
            client.put(
                f"/api/admin/settings/{key}",
                headers=_auth_header(admin_token),
                json={"value": val},
            ).status_code
            == 200
        )

    boot = client.get("/api/public/bootstrap").json()["settings"]
    assert boot["rider_topup_required"] == "true"
    assert boot["rider_topup_rides_count"] == "10"
    assert boot["rider_topup_package_fee"] == "100"
    assert boot["payment_easypaisa"] == "03001234567"
    assert boot["payment_upaisa"] == "03331234567"
    assert boot["payment_jazzcash"] == "03017654321"
    assert boot["payment_bank_account"] == "PK00MEZN0001234567"

    # 1. Register new Bike Captain & AC Car Captain -> both start with 0 rides & 0 topup wallet
    sample_jpg = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q=="
    bike_reg = client.post(
        "/api/auth/register",
        json={
            "full_name": "Asif Topup Bike",
            "phone": "03160001111",
            "password": "pass1234",
            "role": "rider",
            "vehicle_type": "bike",
            "bike_model": "Honda CD-70",
            "bike_plate": "MNS-1010",
            "cnic_number": "13503-5551111-1",
            "zone_name": "Mansehra — Punjab Chowk",
            "rider_photo": sample_jpg,
            "vehicle_photo": sample_jpg,
            "cnic_front_photo": sample_jpg,
            "cnic_back_photo": sample_jpg,
        },
    )
    assert bike_reg.status_code == 201
    bike_user = bike_reg.json()["user"]
    bike_token = bike_reg.json()["access_token"]
    assert bike_user["rider_profile"]["remaining_paid_rides"] == 0
    assert bike_user["rider_profile"]["topup_wallet_balance"] == 0.0

    car_reg = client.post(
        "/api/auth/register",
        json={
            "full_name": "Usman Topup Car",
            "phone": "03160002222",
            "password": "pass1234",
            "role": "rider",
            "vehicle_type": "car",
            "bike_model": "Suzuki Alto AC",
            "bike_plate": "MNS-2020",
            "cnic_number": "13503-5552222-2",
            "zone_name": "Mansehra — Punjab Chowk",
            "rider_photo": sample_jpg,
            "vehicle_photo": sample_jpg,
            "cnic_front_photo": sample_jpg,
            "cnic_back_photo": sample_jpg,
        },
    )
    assert car_reg.status_code == 201
    car_user = car_reg.json()["user"]
    car_token = car_reg.json()["access_token"]
    assert car_user["rider_profile"]["remaining_paid_rides"] == 0

    # Verify docs by Admin; set GPS coords -> unpaid captains STILL cannot go online OR appear on Customer map!
    for rid in (bike_user["id"], car_user["id"]):
        patch_res = client.patch(
            f"/api/admin/riders/{rid}",
            headers=_auth_header(admin_token),
            json={"is_verified": True, "is_online": True, "sync_zone_coords": True},
        )
        assert patch_res.status_code == 200

    bike_me = client.get("/api/auth/me", headers=_auth_header(bike_token)).json()["user"]
    assert bike_me["rider_profile"]["is_online"] is False

    assert client.post("/api/riders/toggle-online", headers=_auth_header(bike_token)).status_code == 403
    assert client.post("/api/riders/toggle-online", headers=_auth_header(car_token)).status_code == 403

    loc_push = client.post(
        "/api/riders/location",
        headers=_auth_header(bike_token),
        json={"lat": 34.328548, "lng": 73.188513},
    )
    assert loc_push.status_code == 200
    assert loc_push.json()["is_online"] is False

    # Confirm Customer map (/api/public/nearby-captains) hides unpaid Bike & Car captains completely
    nearby_bike = client.get(
        "/api/public/nearby-captains?lat=34.328548&lng=73.188513&service_type=bike_ride"
    ).json()
    assert not any(c["rider_id"] == bike_user["id"] for c in nearby_bike)
    nearby_car = client.get(
        "/api/public/nearby-captains?lat=34.328548&lng=73.188513&service_type=car_ride"
    ).json()
    assert not any(c["rider_id"] == car_user["id"] for c in nearby_car)

    # Customer books a ride -> unpaid captains receive ZERO requests in available-jobs & get 403 on offer/accept
    bk = client.post(
        "/api/bookings",
        headers=_auth_header(cust_token),
        json={
            "service_type": "bike_ride",
            "pickup_zone": "Mansehra — Punjab Chowk",
            "pickup_address": "Punjab Chowk Stand",
            "pickup_lat": 34.328548,
            "pickup_lng": 73.188513,
            "drop_zone": "Mansehra — Pakhwal Chowk",
            "drop_address": "Pakhwal Chowk",
            "distance_km": 2.0,
            "payment_method": "cash",
        },
    ).json()

    assert client.get("/api/riders/available-jobs", headers=_auth_header(bike_token)).json() == []
    assert (
        client.post(
            f"/api/riders/jobs/{bk['id']}/offer",
            headers=_auth_header(bike_token),
            json={"offered_fare": 200.0, "eta_minutes": 4},
        ).status_code
        == 403
    )
    assert client.post(f"/api/riders/jobs/{bk['id']}/accept", headers=_auth_header(bike_token)).status_code == 403

    # 2. Admin toggles Top-Up OFF -> unpaid captain can work in free mode; toggling ON hides them immediately
    assert (
        client.put(
            "/api/admin/settings/rider_topup_required",
            headers=_auth_header(admin_token),
            json={"value": "false"},
        ).status_code
        == 200
    )
    assert client.post("/api/riders/toggle-online", headers=_auth_header(bike_token)).json()["is_online"] is True
    assert any(
        c["rider_id"] == bike_user["id"]
        for c in client.get("/api/public/nearby-captains?lat=34.328548&lng=73.188513&service_type=bike_ride").json()
    )
    assert any(
        j["id"] == bk["id"]
        for j in client.get("/api/riders/available-jobs", headers=_auth_header(bike_token)).json()
    )

    # Turn Top-Up ON again -> immediately forces unpaid online Bike Captain offline & invisible!
    assert (
        client.put(
            "/api/admin/settings/rider_topup_required",
            headers=_auth_header(admin_token),
            json={"value": "true"},
        ).status_code
        == 200
    )
    assert client.get("/api/auth/me", headers=_auth_header(bike_token)).json()["user"]["rider_profile"]["is_online"] is False
    assert not any(
        c["rider_id"] == bike_user["id"]
        for c in client.get("/api/public/nearby-captains?lat=34.328548&lng=73.188513&service_type=bike_ride").json()
    )
    assert client.get("/api/riders/available-jobs", headers=_auth_header(bike_token)).json() == []

    # 3. Bike & Car submit Top-Up proofs -> Reject one, Approve valid ones -> both unlocked for 10 rides!
    bad_req = client.post(
        "/api/riders/topup-requests",
        headers=_auth_header(bike_token),
        json={"amount": 100, "rides_requested": 10, "payment_channel": "easypaisa", "reference_no": "FAKE-TID"},
    )
    assert bad_req.status_code == 201
    rej = client.post(
        f"/api/finance/topup-requests/{bad_req.json()['id']}/reject",
        headers=_auth_header(admin_token),
        json={"admin_note": "Invalid TID"},
    )
    assert rej.status_code == 200
    assert rej.json()["status"] == "rejected"
    assert client.get("/api/auth/me", headers=_auth_header(bike_token)).json()["user"]["rider_profile"]["remaining_paid_rides"] == 0

    # Direct Top-Up request does NOT require TID upfront; TID proof can be attached later only if Admin asks
    bike_req = client.post(
        "/api/riders/topup-requests",
        headers=_auth_header(bike_token),
        json={"amount": 100, "rides_requested": 10, "payment_channel": "upaisa"},
    )
    assert bike_req.status_code == 201
    assert bike_req.json()["reference_no"] is None
    assert bike_req.json()["proof_submitted"] is False

    ask_proof = client.post(
        f"/api/finance/topup-requests/{bike_req.json()['id']}/request-proof",
        headers=_auth_header(admin_token),
        json={"admin_note": "Payment abhi nahi mili, TID bhejein"},
    )
    assert ask_proof.status_code == 200
    assert "TID" in ask_proof.json()["admin_note"]

    attach_proof = client.post(
        f"/api/riders/topup-requests/{bike_req.json()['id']}/proof",
        headers=_auth_header(bike_token),
        json={"reference_no": "UP-1001"},
    )
    assert attach_proof.status_code == 200
    assert attach_proof.json()["reference_no"] == "UP-1001"

    car_req = client.post(
        "/api/riders/topup-requests",
        headers=_auth_header(car_token),
        json={"amount": 100, "rides_requested": 10, "payment_channel": "bank", "reference_no": "MEZN-2002"},
    )
    assert car_req.status_code == 201

    ov = client.get("/api/admin/overview", headers=_auth_header(admin_token)).json()
    assert ov["kpis"]["pending_topup_count"] >= 2

    topups_list = client.get("/api/finance/topup-requests", headers=_auth_header(admin_token))
    assert topups_list.status_code == 200
    t_rows = topups_list.json()
    assert any(r["id"] == bike_req.json()["id"] and r["status"] == "pending" for r in t_rows)
    assert any(r["id"] == car_req.json()["id"] and r["vehicle_type"] == "car" for r in t_rows)

    app_bike = client.post(
        f"/api/finance/topup-requests/{bike_req.json()['id']}/approve",
        headers=_auth_header(admin_token),
        json={"admin_note": "Verified UPaisa Rs. 100"},
    )
    app_car = client.post(
        f"/api/finance/topup-requests/{car_req.json()['id']}/approve",
        headers=_auth_header(admin_token),
        json={"admin_note": "Verified Bank Rs. 100"},
    )
    assert app_bike.status_code == 200 and app_car.status_code == 200
    assert app_bike.json()["remaining_paid_rides"] == 10
    assert app_bike.json()["topup_wallet_balance"] == 100.0
    assert app_bike.json()["topup_per_ride_fee"] == 10.0

    # Set Bike Ride per-ride commission rule to fixed Rs. 20 so we verify strict separation from App Fee
    assert (
        client.patch(
            "/api/admin/pricing/bike_ride",
            headers=_auth_header(admin_token),
            json={"commission_type": "fixed", "commission_value": 20.0},
        ).status_code
        == 200
    )

    # Now Bike Captain goes online, appears on Customer map, sees job with Rs. 20 per-ride commission + 1 prepaid pass deduction
    assert client.post("/api/riders/toggle-online", headers=_auth_header(bike_token)).json()["is_online"] is True
    assert any(
        c["rider_id"] == bike_user["id"]
        for c in client.get("/api/public/nearby-captains?lat=34.328548&lng=73.188513&service_type=bike_ride").json()
    )
    avail_jobs = client.get("/api/riders/available-jobs", headers=_auth_header(bike_token)).json()
    job_match = next(j for j in avail_jobs if j["id"] == bk["id"])
    assert job_match["uses_topup_ride"] is True
    assert job_match["fee_mode"] == "app_fee_plus_commission"
    assert job_match["commission_amount"] == 20.0
    assert job_match["rider_earning"] == bk["final_fare"] - 20.0

    assert client.post(f"/api/riders/jobs/{bk['id']}/accept", headers=_auth_header(bike_token)).status_code == 200
    done = client.post(
        f"/api/riders/jobs/{bk['id']}/status",
        headers=_auth_header(bike_token),
        json={"status": "completed"},
    )
    assert done.status_code == 200
    assert done.json()["commission_type_snapshot"] == "fixed"
    assert done.json()["commission_amount"] == 20.0
    assert done.json()["rider_earning"] == bk["final_fare"] - 20.0

    # App Fee ledger tracks pass deduction separately; Ride Commission ledger tracks Rs. 20 commission & completed ride history separately!
    bike_led = client.get("/api/riders/ledger", headers=_auth_header(bike_token)).json()
    assert bike_led["summary"]["remaining_paid_rides"] == 9
    assert bike_led["summary"]["topup_wallet_balance"] == 90.0
    assert bike_led["summary"]["total_topups_paid"] == 100.0
    assert bike_led["summary"]["balance_due_to_admin"] == 20.0
    assert bike_led["summary"]["total_commission_generated"] == 20.0
    assert bike_led["summary"]["total_net_earned"] == bk["final_fare"] - 20.0
    assert len(bike_led["completed_rides"]) == 1
    assert bike_led["completed_rides"][0]["id"] == bk["id"]
    assert bike_led["completed_rides"][0]["uses_topup_ride"] is True
    assert all(e["entry_type"] in ("topup_approved", "topup_ride_deduction") for e in bike_led["app_fee_entries"])
    assert all(e["signed_delta"] == 0.0 for e in bike_led["app_fee_entries"])
    assert any(e["entry_type"] == "commission_due" and e["signed_delta"] == 20.0 for e in bike_led["commission_entries"])
    assert not any(e["entry_type"] in ("topup_approved", "topup_ride_deduction") for e in bike_led["commission_entries"])

    pnl = client.get("/api/reports/pnl", headers=_auth_header(admin_token)).json()
    assert pnl["summary"]["topup_collected"] >= 200.0
    assert pnl["summary"]["admin_commission_earned"] >= 20.0
    assert pnl["summary"]["net_business_profit"] >= pnl["summary"]["topup_collected"] - pnl["summary"]["total_expenses"]

    # 3b. Counter-offer at Rs. 120 keeps Rs. 20 per-ride commission & Rs. 100 Captain Net in Completed Rides History
    bk_counter = client.post(
        "/api/bookings",
        headers=_auth_header(cust_token),
        json={
            "service_type": "bike_ride",
            "pickup_zone": "Mansehra — Punjab Chowk",
            "pickup_address": "Punjab Chowk Counter Test",
            "pickup_lat": 34.328548,
            "pickup_lng": 73.188513,
            "drop_zone": "Mansehra — Pakhwal Chowk",
            "drop_address": "Pakhwal Counter Test",
            "distance_km": 2.0,
            "offered_fare": 150,
            "payment_method": "cash",
        },
    ).json()
    offer_res = client.post(
        f"/api/riders/jobs/{bk_counter['id']}/offer",
        headers=_auth_header(bike_token),
        json={"offered_fare": 120, "eta_minutes": 4, "note": "Near College Chowk"},
    )
    assert offer_res.status_code == 200, offer_res.text
    offer_data = offer_res.json()
    assert offer_data["offered_fare"] == 120.0
    assert offer_data["fee_mode"] == "app_fee_plus_commission"
    assert offer_data["commission_amount"] == 20.0
    assert offer_data["rider_earning"] == 100.0

    my_bookings_after = client.get("/api/bookings/my", headers=_auth_header(cust_token)).json()
    cust_bk = next(b for b in my_bookings_after if b["id"] == bk_counter["id"])
    assert len(cust_bk["offers"]) == 1
    assert cust_bk["offers"][0]["offered_fare"] == 120.0

    acc_offer = client.post(
        f"/api/bookings/{bk_counter['id']}/offers/{offer_data['id']}/accept",
        headers=_auth_header(cust_token),
    )
    assert acc_offer.status_code == 200, acc_offer.text
    acc_data = acc_offer.json()
    assert acc_data["final_fare"] == 120.0
    assert acc_data["commission_type_snapshot"] == "fixed"
    assert acc_data["commission_amount"] == 20.0
    assert acc_data["rider_earning"] == 100.0

    done_counter = client.post(
        f"/api/riders/jobs/{bk_counter['id']}/status",
        headers=_auth_header(bike_token),
        json={"status": "completed"},
    )
    assert done_counter.status_code == 200, done_counter.text
    assert done_counter.json()["commission_type_snapshot"] == "fixed"
    assert done_counter.json()["commission_amount"] == 20.0
    assert done_counter.json()["rider_earning"] == 100.0

    bike_led_after = client.get("/api/riders/ledger", headers=_auth_header(bike_token)).json()
    assert bike_led_after["summary"]["remaining_paid_rides"] == 8
    assert bike_led_after["summary"]["total_topups_paid"] == 100.0
    assert bike_led_after["summary"]["total_commission_generated"] == 40.0
    assert bike_led_after["summary"]["balance_due_to_admin"] == 40.0
    assert len(bike_led_after["completed_rides"]) == 2
    assert any(r["id"] == bk_counter["id"] and r["final_fare"] == 120.0 and r["commission_amount"] == 20.0 and r["rider_earning"] == 100.0 for r in bike_led_after["completed_rides"])

    # Verify Captain can submit a Ride Commission settlement independently of App Fee pass balance
    sett_req = client.post(
        "/api/riders/settlement-requests",
        headers=_auth_header(bike_token),
        json={"amount": 20.0, "payment_channel": "easypaisa", "reference_no": "COMM-20"},
    )
    assert sett_req.status_code == 201
    sett_app = client.post(
        f"/api/finance/settlement-requests/{sett_req.json()['id']}/mark-paid",
        headers=_auth_header(admin_token),
    )
    assert sett_app.status_code == 200
    bike_led_settled = client.get("/api/riders/ledger", headers=_auth_header(bike_token)).json()
    assert bike_led_settled["summary"]["balance_due_to_admin"] == 20.0
    assert bike_led_settled["summary"]["total_settled_to_admin"] == 20.0
    assert bike_led_settled["summary"]["remaining_paid_rides"] == 8
    assert bike_led_settled["summary"]["total_topups_paid"] == 100.0

    # 4. Admin dynamically changes package to 5 Rides = Rs. 150 (Car Rs. 250) & exhaustion auto-offline test
    for k, v in [
        ("rider_topup_rides_count", "5"),
        ("rider_topup_package_fee", "150"),
        ("rider_topup_car_package_fee", "250"),
    ]:
        assert client.put(f"/api/admin/settings/{k}", headers=_auth_header(admin_token), json={"value": v}).status_code == 200

    # Set Bike Captain down to 1 last paid ride -> completes 1 ride -> drops to 0 & auto-offlines!
    assert (
        client.patch(
            f"/api/admin/riders/{bike_user['id']}",
            headers=_auth_header(admin_token),
            json={"remaining_paid_rides": 1, "topup_wallet_balance": 10.0, "is_online": True},
        ).status_code
        == 200
    )
    bk2 = client.post(
        "/api/bookings",
        headers=_auth_header(cust_token),
        json={
            "service_type": "bike_ride",
            "pickup_zone": "Mansehra — Punjab Chowk",
            "pickup_address": "Punjab Chowk 2",
            "pickup_lat": 34.328548,
            "pickup_lng": 73.188513,
            "drop_zone": "Mansehra — Pakhwal Chowk",
            "drop_address": "Pakhwal 2",
            "distance_km": 1.5,
            "payment_method": "cash",
        },
    ).json()
    assert client.post(f"/api/riders/jobs/{bk2['id']}/accept", headers=_auth_header(bike_token)).status_code == 200
    assert (
        client.post(
            f"/api/riders/jobs/{bk2['id']}/status",
            headers=_auth_header(bike_token),
            json={"status": "completed"},
        ).status_code
        == 200
    )

    after_zero = client.get("/api/auth/me", headers=_auth_header(bike_token)).json()["user"]["rider_profile"]
    assert after_zero["remaining_paid_rides"] == 0
    assert after_zero["is_online"] is False
    assert not any(
        c["rider_id"] == bike_user["id"]
        for c in client.get("/api/public/nearby-captains?lat=34.328548&lng=73.188513&service_type=bike_ride").json()
    )
    assert client.post("/api/riders/toggle-online", headers=_auth_header(bike_token)).status_code == 403

    # Verify deleting a Captain with topup history cleans up cleanly without FK errors
    del_car = client.delete(f"/api/admin/riders/{car_user['id']}", headers=_auth_header(admin_token))
    assert del_car.status_code == 200


def test_specific_rider_topup_exemption(client):
    admin_token = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03139620729", "password": "superadmin99"},
    ).json()["access_token"]
    cust_token = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03334444444", "password": "newuser999"},
    ).json()["access_token"]

    assert (
        client.put(
            "/api/admin/settings/rider_topup_required",
            headers=_auth_header(admin_token),
            json={"value": "true"},
        ).status_code
        == 200
    )

    sample_jpg = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q=="

    # Register Non-Exempt unpaid Captain A and Exempted unpaid Captain B
    cap_a_res = client.post(
        "/api/auth/register",
        json={
            "full_name": "Paid Required Capt",
            "phone": "03170001111",
            "password": "pass1234",
            "role": "rider",
            "vehicle_type": "bike",
            "bike_plate": "MNS-EX01",
            "zone_name": "Mansehra — Punjab Chowk",
            "rider_photo": sample_jpg,
            "vehicle_photo": sample_jpg,
            "cnic_front_photo": sample_jpg,
            "cnic_back_photo": sample_jpg,
        },
    ).json()
    cap_b_res = client.post(
        "/api/auth/register",
        json={
            "full_name": "Fee Waived Capt",
            "phone": "03170002222",
            "password": "pass1234",
            "role": "rider",
            "vehicle_type": "bike",
            "bike_plate": "MNS-EX02",
            "zone_name": "Mansehra — Punjab Chowk",
            "rider_photo": sample_jpg,
            "vehicle_photo": sample_jpg,
            "cnic_front_photo": sample_jpg,
            "cnic_back_photo": sample_jpg,
        },
    ).json()
    cap_a_id, cap_a_tok = cap_a_res["user"]["id"], cap_a_res["access_token"]
    cap_b_id, cap_b_tok = cap_b_res["user"]["id"], cap_b_res["access_token"]

    # Verify both, but ONLY exempt Captain B from Pre-Paid App Access Fee!
    assert (
        client.patch(
            f"/api/admin/riders/{cap_a_id}",
            headers=_auth_header(admin_token),
            json={"is_verified": True, "sync_zone_coords": True, "is_topup_exempt": False},
        ).status_code
        == 200
    )
    assert (
        client.patch(
            f"/api/admin/riders/{cap_b_id}",
            headers=_auth_header(admin_token),
            json={"is_verified": True, "sync_zone_coords": True, "is_topup_exempt": True},
        ).status_code
        == 200
    )

    # Captain A (0 paid rides, non-exempt) is BLOCKED; Captain B (0 paid rides, exempt) goes ONLINE!
    assert client.post("/api/riders/toggle-online", headers=_auth_header(cap_a_tok)).status_code == 403
    tog_b = client.post("/api/riders/toggle-online", headers=_auth_header(cap_b_tok))
    assert tog_b.status_code == 200
    assert tog_b.json()["is_online"] is True
    assert tog_b.json()["is_topup_exempt"] is True

    # Global toggle OFF -> ON keeps Captain B online while everyone else with 0 paid rides goes offline
    assert (
        client.put(
            "/api/admin/settings/rider_topup_required",
            headers=_auth_header(admin_token),
            json={"value": "false"},
        ).status_code
        == 200
    )
    assert (
        client.put(
            "/api/admin/settings/rider_topup_required",
            headers=_auth_header(admin_token),
            json={"value": "true"},
        ).status_code
        == 200
    )
    me_b = client.get("/api/auth/me", headers=_auth_header(cap_b_tok)).json()["user"]["rider_profile"]
    assert me_b["is_online"] is True
    assert me_b["is_topup_exempt"] is True

    # Captain B appears on customer map, receives job with uses_topup_ride=False, completes Rs. 120 ride -> Rs. 20 commission, stays ONLINE!
    nearby = client.get("/api/public/nearby-captains?lat=34.328548&lng=73.188513&service_type=bike_ride").json()
    assert any(c["rider_id"] == cap_b_id for c in nearby)
    assert not any(c["rider_id"] == cap_a_id for c in nearby)

    bk = client.post(
        "/api/bookings",
        headers=_auth_header(cust_token),
        json={
            "service_type": "bike_ride",
            "pickup_zone": "Mansehra — Punjab Chowk",
            "pickup_address": "Punjab Chowk Exempt Test",
            "pickup_lat": 34.328548,
            "pickup_lng": 73.188513,
            "drop_zone": "Mansehra — Pakhwal Chowk",
            "drop_address": "Pakhwal Exempt Test",
            "distance_km": 2.0,
            "offer_fare": 120.0,
            "payment_method": "cash",
        },
    ).json()

    avail_a = client.get("/api/riders/available-jobs", headers=_auth_header(cap_a_tok)).json()
    assert avail_a == []
    avail_b = client.get("/api/riders/available-jobs", headers=_auth_header(cap_b_tok)).json()
    job_b = next(j for j in avail_b if j["id"] == bk["id"])
    assert job_b["uses_topup_ride"] is False
    assert job_b["fee_mode"] == "commission"
    assert job_b["commission_amount"] == 20.0

    assert client.post(f"/api/riders/jobs/{bk['id']}/accept", headers=_auth_header(cap_b_tok)).status_code == 200
    done = client.post(
        f"/api/riders/jobs/{bk['id']}/status",
        headers=_auth_header(cap_b_tok),
        json={"status": "completed"},
    )
    assert done.status_code == 200
    assert done.json()["commission_amount"] == 20.0
    assert done.json()["rider_earning"] == 100.0

    led_b = client.get("/api/riders/ledger", headers=_auth_header(cap_b_tok)).json()
    assert led_b["summary"]["is_topup_exempt"] is True
    assert led_b["summary"]["topup_blocked"] is False
    assert led_b["summary"]["remaining_paid_rides"] == 0
    assert led_b["summary"]["balance_due_to_admin"] == 20.0
    assert led_b["app_fee_entries"] == []

    me_b_after = client.get("/api/auth/me", headers=_auth_header(cap_b_tok)).json()["user"]["rider_profile"]
    assert me_b_after["is_online"] is True

    # Removing exemption immediately auto-offlines Captain B (0 paid rides)
    assert (
        client.patch(
            f"/api/admin/riders/{cap_b_id}",
            headers=_auth_header(admin_token),
            json={"is_topup_exempt": False},
        ).status_code
        == 200
    )
    assert client.get("/api/auth/me", headers=_auth_header(cap_b_tok)).json()["user"]["rider_profile"]["is_online"] is False

    assert client.delete(f"/api/admin/riders/{cap_a_id}", headers=_auth_header(admin_token)).status_code == 200
    assert client.delete(f"/api/admin/riders/{cap_b_id}", headers=_auth_header(admin_token)).status_code == 200


def test_two_track_referral_program_and_toggles(client):
    admin_token = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03139620729", "password": "superadmin99"},
    ).json()["access_token"]

    # Configure Referral Program ON with clear rewards & toggles
    for k, v in [
        ("rider_topup_required", "true"),
        ("rider_topup_rides_count", "10"),
        ("rider_topup_package_fee", "167"),
        ("referral_program_enabled", "true"),
        ("referral_customer_enabled", "true"),
        ("referral_captain_enabled", "true"),
        ("referral_customer_friend_discount", "30"),
        ("referral_customer_referrer_reward", "30"),
        ("referral_customer_min_fare", "120"),
        ("referral_captain_bonus_rides", "5"),
        ("referral_max_per_user", "20"),
    ]:
        assert client.put(f"/api/admin/settings/{k}", headers=_auth_header(admin_token), json={"value": v}).status_code == 200

    # 1. Master Toggle OFF blocks referral application cleanly
    assert client.put("/api/admin/settings/referral_program_enabled", headers=_auth_header(admin_token), json={"value": "false"}).status_code == 200

    c1 = client.post(
        "/api/auth/register",
        json={"full_name": "Hammad Referrer", "phone": "03180001111", "password": "pass1234", "role": "customer"},
    ).json()
    c1_tok = c1["access_token"]
    c1_code = c1["user"]["referral_code"]
    assert c1_code and c1_code.startswith("SG")

    blocked_reg = client.post(
        "/api/auth/register",
        json={
            "full_name": "Bilal Blocked",
            "phone": "03180002222",
            "password": "pass1234",
            "role": "customer",
            "referral_code": c1_code,
        },
    )
    assert blocked_reg.status_code == 400

    # Turn Master Toggle ON -> Customer Track OFF still blocks Customer referral, while Captain Track works!
    assert client.put("/api/admin/settings/referral_program_enabled", headers=_auth_header(admin_token), json={"value": "true"}).status_code == 200
    assert client.put("/api/admin/settings/referral_customer_enabled", headers=_auth_header(admin_token), json={"value": "false"}).status_code == 200
    assert (
        client.post(
            "/api/auth/register",
            json={
                "full_name": "Bilal Paused",
                "phone": "03180002222",
                "password": "pass1234",
                "role": "customer",
                "referral_code": c1_code,
            },
        ).status_code
        == 400
    )

    # Turn Customer Track ON -> Bilal registers cleanly with Hammad's code!
    assert client.put("/api/admin/settings/referral_customer_enabled", headers=_auth_header(admin_token), json={"value": "true"}).status_code == 200
    c2 = client.post(
        "/api/auth/register",
        json={
            "full_name": "Bilal Referred",
            "phone": "03180002222",
            "password": "pass1234",
            "role": "customer",
            "referral_code": c1_code,
        },
    )
    assert c2.status_code == 201, c2.text
    c2_tok = c2.json()["access_token"]

    # Self-referral blocked
    assert client.post("/api/referrals/apply", headers=_auth_header(c1_tok), json={"referral_code": c1_code}).status_code == 400

    # Before Bilal completes a ride, Hammad has 0 discount balance & status == pending
    c1_refs_before = client.get("/api/referrals/my", headers=_auth_header(c1_tok)).json()
    assert c1_refs_before["referral_discount_balance"] == 0.0
    assert c1_refs_before["stats"]["pending_count"] == 1
    assert c1_refs_before["stats"]["rewarded_count"] == 0

    # Bilal books 1st ride -> Rs. 30 Friend Discount auto-applies cleanly!
    bk_c2 = client.post(
        "/api/bookings",
        headers=_auth_header(c2_tok),
        json={
            "service_type": "bike_ride",
            "pickup_zone": "Mansehra — Punjab Chowk",
            "pickup_address": "Punjab Chowk",
            "drop_zone": "Mansehra — Pakhwal Chowk",
            "drop_address": "Pakhwal Chowk",
            "distance_km": 2.0,
            "payment_method": "cash",
        },
    )
    assert bk_c2.status_code == 201, bk_c2.text
    bk_c2_data = bk_c2.json()
    assert bk_c2_data["discount_amount"] == 30.0
    assert bk_c2_data["promo_code"] == f"REF-1ST-{c1_code}"
    assert bk_c2_data["final_fare"] == bk_c2_data["recommended_fare"] - 30.0

    # Create & verify an exempt helper rider to complete Bilal's ride
    helper = client.post(
        "/api/auth/register",
        json={
            "full_name": "Helper Capt",
            "phone": "03180003333",
            "password": "pass1234",
            "role": "rider",
            "vehicle_type": "bike",
            "bike_plate": "MNS-REF1",
            "zone_name": "Mansehra — Punjab Chowk",
        },
    ).json()
    helper_id, helper_tok = helper["user"]["id"], helper["access_token"]
    assert client.patch(f"/api/admin/riders/{helper_id}", headers=_auth_header(admin_token), json={"is_verified": True, "is_topup_exempt": True, "is_online": True}).status_code == 200
    assert client.post(f"/api/riders/jobs/{bk_c2_data['id']}/accept", headers=_auth_header(helper_tok)).status_code == 200
    assert client.post(f"/api/riders/jobs/{bk_c2_data['id']}/status", headers=_auth_header(helper_tok), json={"status": "completed"}).status_code == 200

    # After Bilal's 1st ride completes -> Hammad earns Rs. 30 credit!
    c1_refs_after = client.get("/api/referrals/my", headers=_auth_header(c1_tok)).json()
    assert c1_refs_after["referral_discount_balance"] == 30.0
    assert c1_refs_after["stats"]["rewarded_count"] == 1

    # Hammad books a ride -> Rs. 30 earned credit applies (`REF-BONUS`); cancelling refunds it cleanly!
    bk_c1_cancel = client.post(
        "/api/bookings",
        headers=_auth_header(c1_tok),
        json={
            "service_type": "bike_ride",
            "pickup_zone": "Mansehra — Punjab Chowk",
            "pickup_address": "Punjab Chowk",
            "drop_zone": "Mansehra — Pakhwal Chowk",
            "drop_address": "Pakhwal Chowk",
            "distance_km": 2.0,
            "payment_method": "cash",
        },
    ).json()
    assert bk_c1_cancel["discount_amount"] == 30.0
    assert bk_c1_cancel["promo_code"] == "REF-BONUS"
    assert client.get("/api/referrals/my", headers=_auth_header(c1_tok)).json()["referral_discount_balance"] == 0.0

    assert client.post(f"/api/bookings/{bk_c1_cancel['id']}/cancel", headers=_auth_header(c1_tok)).status_code == 200
    assert client.get("/api/referrals/my", headers=_auth_header(c1_tok)).json()["referral_discount_balance"] == 30.0

    # 2. Captain Referral Track (+5 Free App Access Rides on verified 1st Top-Up approval)
    helper_code = helper["user"]["referral_code"]
    invited_cap = client.post(
        "/api/auth/register",
        json={
            "full_name": "Invited Capt Two",
            "phone": "03180004444",
            "password": "pass1234",
            "role": "rider",
            "vehicle_type": "bike",
            "bike_plate": "MNS-REF2",
            "zone_name": "Mansehra — Punjab Chowk",
            "referral_code": helper_code,
        },
    )
    assert invited_cap.status_code == 201, invited_cap.text
    inv_id, inv_tok = invited_cap.json()["user"]["id"], invited_cap.json()["access_token"]

    assert client.patch(f"/api/admin/riders/{inv_id}", headers=_auth_header(admin_token), json={"is_verified": True}).status_code == 200
    topup_req = client.post(
        "/api/riders/topup-requests",
        headers=_auth_header(inv_tok),
        json={"amount": 167, "rides_requested": 10, "payment_channel": "easypaisa"},
    )
    assert topup_req.status_code == 201
    assert (
        client.post(
            f"/api/finance/topup-requests/{topup_req.json()['id']}/approve",
            headers=_auth_header(admin_token),
            json={"admin_note": "Approved"},
        ).status_code
        == 200
    )

    helper_led = client.get("/api/riders/ledger", headers=_auth_header(helper_tok)).json()
    assert helper_led["summary"]["remaining_paid_rides"] == 5
    assert any(e["entry_type"] == "referral_app_fee_bonus" for e in helper_led["app_fee_entries"])
    assert not any(e["entry_type"] == "referral_app_fee_bonus" for e in helper_led["commission_entries"])

    # Admin Referral Summary & P&L check + FK clean deletions
    adm_refs = client.get("/api/admin/referrals", headers=_auth_header(admin_token)).json()
    assert adm_refs["summary"]["rewarded"] >= 2
    assert adm_refs["summary"]["total_bonus_rides"] >= 5

    pnl = client.get("/api/reports/pnl", headers=_auth_header(admin_token)).json()
    assert pnl["summary"]["referral_discounts_given"] >= 30.0
    assert pnl["summary"]["referral_bonus_rides"] >= 5

    assert client.delete(f"/api/admin/riders/{inv_id}", headers=_auth_header(admin_token)).status_code == 200
    assert client.delete(f"/api/admin/riders/{helper_id}", headers=_auth_header(admin_token)).status_code == 200
    assert client.delete(f"/api/admin/customers/{c2.json()['user']['id']}", headers=_auth_header(admin_token)).status_code == 200
    assert client.delete(f"/api/admin/customers/{c1['user']['id']}", headers=_auth_header(admin_token)).status_code == 200



