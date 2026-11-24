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
    # 1. Full City & Intercity Hubs / Zones (idempotent by zone name)
    seed_zones = [
        # --- Mansehra City Core & Tehsil ---
        MansehraZone(name="Main Bazar / Lari Adda", area_tag="City Core", approx_km_from_center=1.0, surcharge=0),
        MansehraZone(name="Abbottabad Road", area_tag="City Core", approx_km_from_center=2.5, surcharge=0),
        MansehraZone(name="Ghazikot Township", area_tag="Residential", approx_km_from_center=3.5, surcharge=0),
        MansehraZone(name="Shinkiari Road", area_tag="City North", approx_km_from_center=3.0, surcharge=0),
        MansehraZone(name="College Doraha", area_tag="Education Hub", approx_km_from_center=2.0, surcharge=0),
        MansehraZone(name="Kaghan Colony", area_tag="Residential", approx_km_from_center=3.5, surcharge=0),
        MansehraZone(name="Channai", area_tag="Suburb", approx_km_from_center=4.5, surcharge=10),
        MansehraZone(name="King Abdullah Hospital", area_tag="Medical", approx_km_from_center=2.5, surcharge=0),
        MansehraZone(name="Hazara University (Dhodial)", area_tag="University", approx_km_from_center=11.0, surcharge=30),
        MansehraZone(name="Baffa Town", area_tag="Outer Town", approx_km_from_center=12.5, surcharge=40),
        MansehraZone(name="Mansehra — Kashmir Road", area_tag="Mansehra Core", approx_km_from_center=2.0, surcharge=0),
        MansehraZone(name="Mansehra — Zafar Road / Pehlwan Bagh", area_tag="Mansehra Core", approx_km_from_center=2.0, surcharge=0),
        MansehraZone(name="Mansehra — Sabzi Mandi / GT Bypass", area_tag="Mansehra Commercial", approx_km_from_center=3.5, surcharge=0),
        MansehraZone(name="Mansehra — Data Bypass / Chakal", area_tag="Mansehra Residential", approx_km_from_center=4.0, surcharge=0),
        MansehraZone(name="Mansehra — Muftiabad / Shahrah-e-Resham", area_tag="Mansehra City", approx_km_from_center=2.5, surcharge=0),
        MansehraZone(name="Mansehra — Nogazi / Bherkund Road", area_tag="Mansehra Suburb", approx_km_from_center=5.0, surcharge=10),
        MansehraZone(name="Mansehra — Khaki Road / Kotli Bala", area_tag="Mansehra Suburb", approx_km_from_center=5.5, surcharge=15),
        MansehraZone(name="Mansehra — Labarkot / Chakia", area_tag="Mansehra Residential", approx_km_from_center=4.5, surcharge=10),
        MansehraZone(name="Mansehra — Dhangri / KKH", area_tag="Mansehra South", approx_km_from_center=6.0, surcharge=15),
        MansehraZone(name="Mansehra — Safada / Atter Shisha", area_tag="Mansehra Route", approx_km_from_center=8.5, surcharge=25),
        MansehraZone(name="Mansehra — Qalandarabad", area_tag="Mansehra Route", approx_km_from_center=12.0, surcharge=40),
        MansehraZone(name="Mansehra — Shinkiari Town", area_tag="Mansehra Tehsil", approx_km_from_center=18.0, surcharge=60),
        MansehraZone(name="Mansehra — Pakhal / Chattar Plain / Battal", area_tag="Mansehra North", approx_km_from_center=28.0, surcharge=90),
        MansehraZone(name="Mansehra — Oghi / Susal Gali", area_tag="Mansehra Tehsil", approx_km_from_center=36.0, surcharge=120),
        MansehraZone(name="Mansehra — Balakot / Garhi Habibullah", area_tag="Mansehra / Kaghan", approx_km_from_center=40.0, surcharge=150),
        MansehraZone(name="Mansehra — Lassan Nawab", area_tag="Mansehra Tehsil", approx_km_from_center=16.0, surcharge=50),
        # --- Abbottabad City, Cantt & Surrounding ---
        MansehraZone(name="Abbottabad (City / Fawara Chowk)", area_tag="Intercity Hub", approx_km_from_center=25.0, surcharge=100),
        MansehraZone(name="Abbottabad — Main Bazar / Sabzi Mandi", area_tag="Abbottabad Core", approx_km_from_center=1.5, surcharge=0),
        MansehraZone(name="Abbottabad — Supply Bazar", area_tag="Abbottabad Core", approx_km_from_center=2.0, surcharge=0),
        MansehraZone(name="Abbottabad — Cantt / Mall Road / Lady Garden", area_tag="Abbottabad Cantt", approx_km_from_center=2.5, surcharge=0),
        MansehraZone(name="Abbottabad — Mandian / KKH", area_tag="Abbottabad Commercial", approx_km_from_center=4.0, surcharge=0),
        MansehraZone(name="Abbottabad — Ayub Medical Complex (AMC)", area_tag="Abbottabad Medical", approx_km_from_center=4.5, surcharge=0),
        MansehraZone(name="Abbottabad — Jinnahabad", area_tag="Abbottabad Residential", approx_km_from_center=5.0, surcharge=0),
        MansehraZone(name="Abbottabad — PMA Kakul Road / Kakul", area_tag="Abbottabad Cantt / PMA", approx_km_from_center=6.0, surcharge=10),
        MansehraZone(name="Abbottabad — Mirpur / Sarban", area_tag="Abbottabad Residential", approx_km_from_center=5.5, surcharge=0),
        MansehraZone(name="Abbottabad — Nawan Shehr", area_tag="Abbottabad East", approx_km_from_center=5.0, surcharge=0),
        MansehraZone(name="Abbottabad — Kehal / Sarbhana Road", area_tag="Abbottabad Core", approx_km_from_center=2.5, surcharge=0),
        MansehraZone(name="Abbottabad — Malikpura / Habibullah Colony", area_tag="Abbottabad Residential", approx_km_from_center=3.0, surcharge=0),
        MansehraZone(name="Abbottabad — Bilal Town / Salhad", area_tag="Abbottabad South", approx_km_from_center=5.5, surcharge=10),
        MansehraZone(name="Abbottabad — COMSATS University / Tobe Camp", area_tag="Abbottabad Education", approx_km_from_center=7.0, surcharge=15),
        MansehraZone(name="Abbottabad — Sethi Masjid / Eidgah Road", area_tag="Abbottabad Core", approx_km_from_center=2.0, surcharge=0),
        MansehraZone(name="Abbottabad — Muslimabad / Banda Pir Khan", area_tag="Abbottabad North", approx_km_from_center=6.5, surcharge=10),
        MansehraZone(name="Abbottabad — Sheikhulbandi", area_tag="Abbottabad Residential", approx_km_from_center=4.5, surcharge=0),
        MansehraZone(name="Abbottabad — Ilyasi Masjid / Thandiani Road", area_tag="Abbottabad Hills", approx_km_from_center=6.0, surcharge=15),
        MansehraZone(name="Abbottabad — Shimla Hill / Pine View Road", area_tag="Abbottabad Hills", approx_km_from_center=3.5, surcharge=0),
        MansehraZone(name="Abbottabad — Dhamtour / Murree Road", area_tag="Abbottabad East", approx_km_from_center=8.0, surcharge=20),
        MansehraZone(name="Abbottabad — Havelian Town", area_tag="Abbottabad Tehsil", approx_km_from_center=15.0, surcharge=50),
        MansehraZone(name="Abbottabad — Nathia Gali / Dunga Gali", area_tag="Galyat Hills", approx_km_from_center=34.0, surcharge=150),
        # --- Other Intercity & Airport Hubs ---
        MansehraZone(name="Haripur (City / GT Road)", area_tag="Intercity Hub", approx_km_from_center=60.0, surcharge=200),
        MansehraZone(name="Battagram (City Center)", area_tag="Intercity Hub", approx_km_from_center=65.0, surcharge=250),
        MansehraZone(name="Islamabad Airport (New IIA)", area_tag="Airport Transfer", approx_km_from_center=125.0, surcharge=500),
    ]
    existing_zone_names = {row[0] for row in db.query(MansehraZone.name).all()}
    new_zones = [z for z in seed_zones if z.name not in existing_zone_names]
    if new_zones:
        db.add_all(new_zones)

    # 2. Pricing & Commission Rules (idempotent by service_type)
    seed_rules = [
        PricingRule(
            service_type="bike_ride",
            display_name="Bike Ride (Sawari)",
            base_fare=60.0,
            per_km_rate=25.0,
            min_fare=80.0,
            commission_type="percent",
            commission_value=15.0,
            peak_multiplier=1.0,
        ),
        PricingRule(
            service_type="car_ride",
            display_name="Car Ride (City & Intercity)",
            base_fare=250.0,
            per_km_rate=55.0,
            min_fare=350.0,
            commission_type="percent",
            commission_value=15.0,
            peak_multiplier=1.0,
        ),
        PricingRule(
            service_type="parcel",
            display_name="Parcel Delivery",
            base_fare=80.0,
            per_km_rate=30.0,
            min_fare=100.0,
            commission_type="percent",
            commission_value=18.0,
            peak_multiplier=1.0,
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
        ),
    ]
    existing_rule_types = {row[0] for row in db.query(PricingRule.service_type).all()}
    new_rules = [r for r in seed_rules if r.service_type not in existing_rule_types]
    if new_rules:
        db.add_all(new_rules)

    # 3. System Settings
    default_settings = {
        "business_name": "Bikeaya",
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
            bike_model="Honda CD-70",
            bike_plate="MNA-4821",
            license_no="MNS-DL-2041",
            zone_name="Ghazikot Township",
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
            bike_model="Honda CG-125",
            bike_plate="MNB-9104",
            license_no="MNS-DL-3192",
            zone_name="Shinkiari Road",
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
