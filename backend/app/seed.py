from datetime import date, timedelta
from sqlalchemy.orm import Session
from app.auth import hash_password
from app.models import (
    AdminExpense,
    AppRelease,
    Booking,
    LedgerEntry,
    MansehraZone,
    PricingRule,
    PromoCode,
    RiderProfile,
    SystemSetting,
    User,
)
from app.services.finance import complete_booking_and_post_ledger, utcnow


def seed_initial_data(db: Session) -> None:
    # 1. Full City & Intercity Hubs / Zones (idempotent by zone name + coordinate backfill)
    zone_specs = [
        # --- Mansehra City Core & Tehsil ---
        ("Main Bazar / Lari Adda", "City Core", 1.0, 0, 34.3335, 73.1995),
        ("Abbottabad Road", "City Core", 2.5, 0, 34.3245, 73.2040),
        ("Ghazikot Township", "Residential", 3.5, 0, 34.3168, 73.1920),
        ("Shinkiari Road", "City North", 3.0, 0, 34.3440, 73.2030),
        ("College Doraha", "Education Hub", 2.0, 0, 34.3375, 73.1945),
        ("Kaghan Colony", "Residential", 3.5, 0, 34.3395, 73.2090),
        ("Channai", "Suburb", 4.5, 10, 34.3490, 73.1865),
        ("King Abdullah Hospital", "Medical", 2.5, 0, 34.3275, 73.1975),
        ("Hazara University (Dhodial)", "University", 11.0, 30, 34.4328, 73.2610),
        ("Baffa Town", "Outer Town", 12.5, 40, 34.4368, 73.2255),
        ("Mansehra — Kashmir Road", "Mansehra Core", 2.0, 0, 34.3360, 73.2035),
        ("Mansehra — Zafar Road / Pehlwan Bagh", "Mansehra Core", 2.0, 0, 34.3315, 73.1955),
        ("Mansehra — Sabzi Mandi / GT Bypass", "Mansehra Commercial", 3.5, 0, 34.3220, 73.1885),
        ("Mansehra — Data Bypass / Chakal", "Mansehra Residential", 4.0, 0, 34.3125, 73.2085),
        ("Mansehra — Muftiabad / Shahrah-e-Resham", "Mansehra City", 2.5, 0, 34.3390, 73.1998),
        ("Mansehra — Nogazi / Bherkund Road", "Mansehra Suburb", 5.0, 10, 34.3545, 73.1755),
        ("Mansehra — Khaki Road / Kotli Bala", "Mansehra Suburb", 5.5, 15, 34.3580, 73.1620),
        ("Mansehra — Labarkot / Chakia", "Mansehra Residential", 4.5, 10, 34.3110, 73.1835),
        ("Mansehra — Dhangri / KKH", "Mansehra South", 6.0, 15, 34.2945, 73.2055),
        ("Mansehra — Safada / Atter Shisha", "Mansehra Route", 8.5, 25, 34.3820, 73.2270),
        ("Mansehra — Qalandarabad", "Mansehra Route", 12.0, 40, 34.2740, 73.2290),
        ("Mansehra — Shinkiari Town", "Mansehra Tehsil", 18.0, 60, 34.4620, 73.2685),
        ("Mansehra — Pakhal / Chattar Plain / Battal", "Mansehra North", 28.0, 90, 34.5810, 73.1535),
        ("Mansehra — Oghi / Susal Gali", "Mansehra Tehsil", 36.0, 120, 34.5020, 73.0120),
        ("Mansehra — Balakot / Garhi Habibullah", "Mansehra / Kaghan", 40.0, 150, 34.5480, 73.3525),
        ("Mansehra — Lassan Nawab", "Mansehra Tehsil", 16.0, 50, 34.3740, 73.0580),
        # --- Abbottabad City, Cantt & Surrounding ---
        ("Abbottabad (City / Fawara Chowk)", "Intercity Hub", 25.0, 100, 34.1495, 73.2145),
        ("Abbottabad — Main Bazar / Sabzi Mandi", "Abbottabad Core", 1.5, 0, 34.1465, 73.2125),
        ("Abbottabad — Supply Bazar", "Abbottabad Core", 2.0, 0, 34.1558, 73.2185),
        ("Abbottabad — Cantt / Mall Road / Lady Garden", "Abbottabad Cantt", 2.5, 0, 34.1518, 73.2195),
        ("Abbottabad — Mandian / KKH", "Abbottabad Commercial", 4.0, 0, 34.1852, 73.2315),
        ("Abbottabad — Ayub Medical Complex (AMC)", "Abbottabad Medical", 4.5, 0, 34.1982, 73.2375),
        ("Abbottabad — Jinnahabad", "Abbottabad Residential", 5.0, 0, 34.1815, 73.2412),
        ("Abbottabad — PMA Kakul Road / Kakul", "Abbottabad Cantt / PMA", 6.0, 10, 34.1795, 73.2575),
        ("Abbottabad — Mirpur / Sarban", "Abbottabad Residential", 5.5, 0, 34.1905, 73.2205),
        ("Abbottabad — Nawan Shehr", "Abbottabad East", 5.0, 0, 34.1655, 73.2470),
        ("Abbottabad — Kehal / Sarbhana Road", "Abbottabad Core", 2.5, 0, 34.1395, 73.2215),
        ("Abbottabad — Malikpura / Habibullah Colony", "Abbottabad Residential", 3.0, 0, 34.1438, 73.2045),
        ("Abbottabad — Bilal Town / Salhad", "Abbottabad South", 5.5, 10, 34.1225, 73.2015),
        ("Abbottabad — COMSATS University / Tobe Camp", "Abbottabad Education", 7.0, 15, 34.1975, 73.2435),
        ("Abbottabad — Sethi Masjid / Eidgah Road", "Abbottabad Core", 2.0, 0, 34.1492, 73.2102),
        ("Abbottabad — Muslimabad / Banda Pir Khan", "Abbottabad North", 6.5, 10, 34.1705, 73.2255),
        ("Abbottabad — Sheikhulbandi", "Abbottabad Residential", 4.5, 0, 34.1445, 73.2315),
        ("Abbottabad — Ilyasi Masjid / Thandiani Road", "Abbottabad Hills", 6.0, 15, 34.1685, 73.2555),
        ("Abbottabad — Shimla Hill / Pine View Road", "Abbottabad Hills", 3.5, 0, 34.1565, 73.2090),
        ("Abbottabad — Dhamtour / Murree Road", "Abbottabad East", 8.0, 20, 34.1325, 73.2595),
        ("Abbottabad — Havelian Town", "Abbottabad Tehsil", 15.0, 50, 34.0535, 73.1595),
        ("Abbottabad — Nathia Gali / Dunga Gali", "Galyat Hills", 34.0, 150, 34.0728, 73.3812),
        # --- Other Intercity & Airport Hubs ---
        ("Haripur (City / GT Road)", "Intercity Hub", 60.0, 200, 33.9978, 72.9348),
        ("Battagram (City Center)", "Intercity Hub", 65.0, 250, 34.6775, 73.0255),
        ("Islamabad Airport (New IIA)", "Airport Transfer", 125.0, 500, 33.5607, 72.8516),
    ]
    existing_zones = {z.name: z for z in db.query(MansehraZone).all()}
    new_zones = []
    for z_name, z_tag, z_km, z_sur, z_lat, z_lng in zone_specs:
        if z_name in existing_zones:
            ez = existing_zones[z_name]
            if ez.lat is None or ez.lng is None:
                ez.lat = z_lat
                ez.lng = z_lng
        else:
            new_zones.append(
                MansehraZone(
                    name=z_name,
                    area_tag=z_tag,
                    approx_km_from_center=z_km,
                    surcharge=z_sur,
                    lat=z_lat,
                    lng=z_lng,
                )
            )
    if new_zones:
        db.add_all(new_zones)

    # 2. Pricing & Commission Rules (idempotent by service_type)
    seed_rules = [
        PricingRule(
            service_type="bike_ride",
            display_name="Bike Ride (Sawari)",
            base_fare=100.0,
            per_km_rate=50.0,
            min_fare=100.0,
            commission_type="percent",
            commission_value=15.0,
            peak_multiplier=1.0,
            city_flat_km=0.0,
            city_flat_fare=0.0,
            wait_free_minutes=5,
            wait_charge_per_min=10.0,
        ),
        PricingRule(
            service_type="car_ride",
            display_name="Car Ride (City & Intercity)",
            base_fare=150.0,
            per_km_rate=80.0,
            min_fare=150.0,
            commission_type="percent",
            commission_value=15.0,
            peak_multiplier=1.0,
            city_flat_km=0.0,
            city_flat_fare=0.0,
            wait_free_minutes=5,
            wait_charge_per_min=10.0,
        ),
        PricingRule(
            service_type="parcel",
            display_name="Parcel Delivery",
            base_fare=100.0,
            per_km_rate=50.0,
            min_fare=100.0,
            commission_type="percent",
            commission_value=18.0,
            peak_multiplier=1.0,
            city_flat_km=3.0,
            city_flat_fare=250.0,
            wait_free_minutes=5,
            wait_charge_per_min=10.0,
        ),
        PricingRule(
            service_type="errand",
            display_name="Bazaar Errand",
            base_fare=100.0,
            per_km_rate=30.0,
            min_fare=120.0,
            commission_type="fixed",
            commission_value=40.0,
            peak_multiplier=1.0,
            city_flat_km=0.0,
            city_flat_fare=0.0,
            wait_free_minutes=5,
            wait_charge_per_min=10.0,
        ),
    ]
    existing_rule_types = {row[0] for row in db.query(PricingRule.service_type).all()}
    new_rules = [r for r in seed_rules if r.service_type not in existing_rule_types]
    if new_rules:
        db.add_all(new_rules)

    # 3. System Settings
    default_settings = {
        "business_name": "SafarGo",
        "city": "Hazara & Intercity",
        "default_credit_limit": "1500",
        "support_phone": "+92 300 1111111",
        "support_whatsapp": "+92 300 1111111",
    }
    for k, v in default_settings.items():
        if not db.query(SystemSetting).filter(SystemSetting.key == k).first():
            db.add(SystemSetting(key=k, value=v))

    # 4. Promo Codes
    if db.query(PromoCode).count() == 0:
        db.add(
            PromoCode(
                code="MANSEHRA20",
                discount_type="fixed",
                discount_value=20.0,
                max_discount=20.0,
                min_fare=120.0,
                is_active=True,
            )
        )

    # 5. App Releases (Download Center entries)
    apk_url = "https://github.com/ayeshamalic54-png/Mansehra-Bikeaya/releases/download/v1.0.0/MansehraBikeaya.apk"
    exe_url = "https://github.com/ayeshamalic54-png/Mansehra-Bikeaya/releases/download/v1.0.0/MansehraBikeayaDesk.exe"
    if db.query(AppRelease).count() == 0:
        db.add_all(
            [
                AppRelease(
                    platform="android_apk",
                    version="1.0.0",
                    file_name="MansehraBikeaya.apk",
                    download_url=apk_url,
                    file_size_mb=4.8,
                    release_notes="Official Android app (.apk) for Customers, Motorbike Captains & Admin connected to live Mansehra Bikeaya.",
                    is_latest=True,
                ),
                AppRelease(
                    platform="windows_exe",
                    version="1.0.0",
                    file_name="MansehraBikeayaDesk.exe",
                    download_url=exe_url,
                    file_size_mb=16.0,
                    release_notes="Standalone Windows Desktop app (.exe) for Mansehra Bikeaya Admin Dispatch, Settlements & P&L Reports.",
                    is_latest=True,
                ),
            ]
        )
    else:
        for rel in db.query(AppRelease).all():
            if rel.download_url.startswith("#"):
                if rel.platform == "android_apk":
                    rel.version = "1.0.0"
                    rel.file_name = "MansehraBikeaya.apk"
                    rel.download_url = apk_url
                    rel.file_size_mb = 4.8
                    rel.release_notes = "Official Android app (.apk) for Customers, Motorbike Captains & Admin connected to live Mansehra Bikeaya."
                elif rel.platform == "windows_exe":
                    rel.version = "1.0.0"
                    rel.file_name = "MansehraBikeayaDesk.exe"
                    rel.download_url = exe_url
                    rel.file_size_mb = 16.0
                    rel.release_notes = "Standalone Windows Desktop app (.exe) for Mansehra Bikeaya Admin Dispatch, Settlements & P&L Reports."

    db.commit()

    # 6. Default Users & Sample Data (only seed once on fresh empty database)
    if db.query(User).count() > 0:
        zone_coords = {z.name: (z.lat, z.lng) for z in db.query(MansehraZone).all()}
        changed = False
        for idx, rp in enumerate(db.query(RiderProfile).all()):
            if rp.current_lat is None or rp.current_lng is None:
                base = zone_coords.get(rp.zone_name, (34.3335, 73.1995))
                if base[0] is not None:
                    rp.current_lat = round(base[0] + (idx % 5) * 0.0018, 6)
                    rp.current_lng = round(base[1] + (idx % 3) * 0.0015, 6)
                    rp.location_updated_at = utcnow()
                    changed = True
        if changed:
            db.commit()
        return

    admin = User(
        full_name="Owner Admin (Mansehra)",
        phone="03001111111",
        email="admin@mansehrabikeaya.pk",
        password_hash=hash_password("admin123"),
        role="admin",
        is_active=True,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)

    rider1 = User(
        full_name="Usman Khan",
        phone="03112222222",
        email="usman.rider@mansehrabikeaya.pk",
        password_hash=hash_password("rider123"),
        role="rider",
        is_active=True,
    )
    db.add(rider1)
    db.commit()
    db.refresh(rider1)
    db.add(
        RiderProfile(
            user_id=rider1.id,
            cnic_number="13503-4821901-1",
            vehicle_type="bike",
            bike_model="Honda CD-70",
            bike_plate="MNA-4821",
            license_no="MNS-DL-2041",
            zone_name="Ghazikot Township",
            current_lat=34.3195,
            current_lng=73.1938,
            location_updated_at=utcnow(),
            is_verified=True,
            is_online=True,
            credit_limit=1500.0,
        )
    )
    db.commit()

    rider2 = User(
        full_name="Bilal Ahmed",
        phone="03123333333",
        email="bilal.rider@mansehrabikeaya.pk",
        password_hash=hash_password("rider123"),
        role="rider",
        is_active=True,
    )
    db.add(rider2)
    db.commit()
    db.refresh(rider2)
    db.add(
        RiderProfile(
            user_id=rider2.id,
            cnic_number="13503-9910421-3",
            vehicle_type="bike",
            bike_model="Honda CG-125",
            bike_plate="MNB-9104",
            license_no="MNS-DL-3192",
            zone_name="Shinkiari Road",
            current_lat=34.3420,
            current_lng=73.2022,
            location_updated_at=utcnow(),
            is_verified=True,
            is_online=True,
            credit_limit=1500.0,
        )
    )
    db.commit()

    customer = User(
        full_name="Hammad Raza",
        phone="03334444444",
        email="hammad@example.pk",
        password_hash=hash_password("user123"),
        role="customer",
        is_active=True,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)

    # 7. Sample initial bookings & expense on first launch
    b1 = Booking(
        booking_code="MNS-1001",
        customer_id=customer.id,
        rider_id=rider1.id,
        service_type="bike_ride",
        pickup_zone="Main Bazar / Lari Adda",
        pickup_address="Lari Adda Main Gate",
        drop_zone="Ghazikot Township",
        drop_address="Ghazikot Sector B Masjid",
        distance_km=4.0,
        estimated_fare=160.0,
        discount_amount=0.0,
        final_fare=160.0,
        payment_method="cash",
        payment_collector="rider",
        status="assigned",
        assigned_at=utcnow() - timedelta(hours=2),
    )
    db.add(b1)
    db.commit()
    db.refresh(b1)
    complete_booking_and_post_ledger(db, b1, admin)

    b2 = Booking(
        booking_code="MNS-1002",
        customer_id=customer.id,
        rider_id=rider2.id,
        service_type="parcel",
        pickup_zone="Abbottabad Road",
        pickup_address="Zafar Medical Store",
        drop_zone="Kaghan Colony",
        drop_address="House 14, Street 3",
        distance_km=3.5,
        estimated_fare=185.0,
        discount_amount=0.0,
        final_fare=185.0,
        payment_method="cash",
        payment_collector="rider",
        receiver_name="Salman Tariq",
        receiver_phone="03455551122",
        cod_amount=0.0,
        status="assigned",
        assigned_at=utcnow() - timedelta(hours=1),
    )
    db.add(b2)
    db.commit()
    db.refresh(b2)
    complete_booking_and_post_ledger(db, b2, admin)

    b3 = Booking(
        booking_code="MNS-1003",
        customer_id=customer.id,
        rider_id=None,
        service_type="bike_ride",
        pickup_zone="College Doraha",
        pickup_address="Govt Postgraduate College Gate",
        drop_zone="Hazara University (Dhodial)",
        drop_address="Main Admin Block",
        distance_km=10.5,
        estimated_fare=353.0,
        discount_amount=0.0,
        final_fare=353.0,
        payment_method="cash",
        payment_collector="rider",
        status="pending",
        customer_notes="Call on arrival near main gate",
    )
    db.add(b3)
    db.commit()

    db.add(
        AdminExpense(
            title="Mansehra Rider Pamphlets & Stand Stickers",
            category="marketing",
            amount=50.0,
            expense_date=date.today(),
            note="Initial launch print batch",
            recorded_by_id=admin.id,
        )
    )
    db.commit()
