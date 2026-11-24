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
    assert len(data["zones"]) >= 12
    assert len(data["pricing_rules"]) == 4
    rule_types = {r["service_type"] for r in data["pricing_rules"]}
    assert {"bike_ride", "car_ride", "parcel", "errand"}.issubset(rule_types)
    zone_names = " | ".join(z["name"] for z in data["zones"])
    for city in ("Abbottabad", "Haripur", "Battagram", "Islamabad Airport"):
        assert city in zone_names
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

    admin_login = client.post(
        "/api/auth/login",
        json={"phone_or_email": "03001111111", "password": "admin123"},
    )
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["access_token"]

    # 2. Customer books a 4 km ride (base 60 + 4*25 = 160) with MANSEHRA20 promo -> 140
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
    assert est.json()["estimated_fare"] == 140.0

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
    assert booking["final_fare"] == 140.0
    assert booking["status"] == "pending"

    # 3. Rider accepts & completes ride (15% of 140 = 21.0 admin commission; 119.0 rider earning)
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
    assert done_booking["commission_amount"] == 21.0
    assert done_booking["rider_earning"] == 119.0

    # Check rider ledger increased by +21.0 (from initial seeded 24.0 -> 45.0)
    ledger_before = client.get("/api/riders/ledger", headers=_auth_header(rider_token)).json()
    assert ledger_before["summary"]["balance_due_to_admin"] == 45.0

    # 4. Admin changes commission rate from 15% to 20% live!
    upd = client.patch(
        "/api/admin/pricing/bike_ride",
        headers=_auth_header(admin_token),
        json={"commission_type": "percent", "commission_value": 20.0},
    )
    assert upd.status_code == 200
    assert upd.json()["commission_value"] == 20.0

    # Historical booking keeps 15% snapshot (21.0), while new estimate uses 20%
    hist_list = client.get("/api/admin/bookings", headers=_auth_header(admin_token)).json()
    past = next(b for b in hist_list if b["id"] == booking["id"])
    assert past["commission_amount"] == 21.0
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
    assert new_est.json()["estimated_commission"] == 32.0  # 20% of 160

    # 5. Admin collects cash settlement Rs. 45 from Rider 1 -> balance becomes 0.0
    rider_id = rider_login.json()["user"]["id"]
    sett = client.post(
        "/api/finance/settlements",
        headers=_auth_header(admin_token),
        json={
            "rider_id": rider_id,
            "amount": 45.0,
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
    assert summary["admin_commission_earned"] == 78.3  # 24.0 + 33.3 (seeded) + 21.0
    assert summary["net_business_profit"] == 28.3  # 78.3 - 50.0 seeded expense

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


