from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(120), nullable=False)
    phone = Column(String(32), unique=True, index=True, nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(24), nullable=False, index=True)  # admin | rider | customer
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    rider_profile = relationship("RiderProfile", back_populates="user", uselist=False)


class RiderProfile(Base):
    __tablename__ = "rider_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    cnic_number = Column(String(32), nullable=True)
    vehicle_type = Column(String(20), nullable=False, default="bike")  # bike | car
    bike_model = Column(String(80), nullable=False, default="Honda CD-70")
    bike_plate = Column(String(32), nullable=False)
    license_no = Column(String(64), nullable=True)
    zone_name = Column(String(100), nullable=False, default="Main Bazar / Lari Adda")
    current_lat = Column(Float, nullable=True)
    current_lng = Column(Float, nullable=True)
    location_updated_at = Column(DateTime(timezone=True), nullable=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    is_online = Column(Boolean, default=False, nullable=False)

    # Optional per-rider commission override (editable anytime by Admin)
    custom_commission_type = Column(String(20), nullable=True)  # percent | fixed | None
    custom_commission_value = Column(Float, nullable=True)

    # Financial ledger counters (positive balance_due_to_admin = rider owes admin)
    credit_limit = Column(Float, default=1500.0, nullable=False)
    balance_due_to_admin = Column(Float, default=0.0, nullable=False)
    total_gross_collected = Column(Float, default=0.0, nullable=False)
    total_net_earned = Column(Float, default=0.0, nullable=False)
    total_commission_generated = Column(Float, default=0.0, nullable=False)
    total_settled_to_admin = Column(Float, default=0.0, nullable=False)

    total_trips = Column(Integer, default=0, nullable=False)
    rating_avg = Column(Float, default=5.0, nullable=False)
    rating_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    user = relationship("User", back_populates="rider_profile")


class MansehraZone(Base):
    __tablename__ = "mansehra_zones"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), unique=True, nullable=False)
    area_tag = Column(String(60), nullable=False, default="City Core")
    approx_km_from_center = Column(Float, default=2.0, nullable=False)
    surcharge = Column(Float, default=0.0, nullable=False)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)


class PricingRule(Base):
    __tablename__ = "pricing_rules"

    id = Column(Integer, primary_key=True, index=True)
    service_type = Column(String(32), unique=True, nullable=False)  # bike_ride | parcel | errand
    display_name = Column(String(80), nullable=False)
    base_fare = Column(Float, nullable=False)
    per_km_rate = Column(Float, nullable=False)
    min_fare = Column(Float, nullable=False)
    commission_type = Column(String(20), nullable=False, default="percent")  # percent | fixed
    commission_value = Column(Float, nullable=False, default=15.0)
    peak_multiplier = Column(Float, nullable=False, default=1.0)
    city_flat_km = Column(Float, nullable=False, default=0.0)
    city_flat_fare = Column(Float, nullable=False, default=0.0)
    wait_free_minutes = Column(Integer, nullable=False, default=5)
    wait_charge_per_min = Column(Float, nullable=False, default=10.0)
    is_active = Column(Boolean, default=True, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)


class PromoCode(Base):
    __tablename__ = "promo_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(40), unique=True, nullable=False, index=True)
    discount_type = Column(String(20), nullable=False, default="fixed")  # fixed | percent
    discount_value = Column(Float, nullable=False, default=20.0)
    max_discount = Column(Float, nullable=False, default=50.0)
    min_fare = Column(Float, nullable=False, default=100.0)
    uses_count = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    booking_code = Column(String(32), unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    rider_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    service_type = Column(String(32), nullable=False, default="bike_ride")
    pickup_zone = Column(String(120), nullable=False)
    pickup_address = Column(String(255), nullable=False)
    pickup_lat = Column(Float, nullable=True)
    pickup_lng = Column(Float, nullable=True)
    drop_zone = Column(String(120), nullable=False)
    drop_address = Column(String(255), nullable=False)
    drop_lat = Column(Float, nullable=True)
    drop_lng = Column(Float, nullable=True)
    distance_km = Column(Float, nullable=False, default=3.0)

    estimated_fare = Column(Float, nullable=False)
    discount_amount = Column(Float, default=0.0, nullable=False)
    promo_code = Column(String(40), nullable=True)
    wait_minutes = Column(Integer, default=0, nullable=False)
    wait_charge = Column(Float, default=0.0, nullable=False)
    final_fare = Column(Float, nullable=False)

    # Snapshot at booking/completion time so future rate edits never alter historical reports
    commission_type_snapshot = Column(String(20), nullable=False, default="percent")
    commission_rate_snapshot = Column(Float, nullable=False, default=15.0)
    commission_amount = Column(Float, default=0.0, nullable=False)
    rider_earning = Column(Float, default=0.0, nullable=False)

    payment_method = Column(String(32), nullable=False, default="cash")  # cash | easypaisa | jazzcash | wallet
    payment_collector = Column(String(20), nullable=False, default="rider")  # rider | admin
    status = Column(String(32), nullable=False, default="pending", index=True)
    # pending | assigned | arrived | in_progress | completed | cancelled

    receiver_name = Column(String(120), nullable=True)
    receiver_phone = Column(String(32), nullable=True)
    cod_amount = Column(Float, default=0.0, nullable=False)
    customer_notes = Column(Text, nullable=True)
    created_by_admin = Column(Boolean, default=False, nullable=False)

    customer_rating = Column(Integer, nullable=True)
    customer_feedback = Column(String(255), nullable=True)
    cancelled_reason = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    assigned_at = Column(DateTime(timezone=True), nullable=True)
    arrived_at = Column(DateTime(timezone=True), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    customer = relationship("User", foreign_keys=[customer_id])
    rider = relationship("User", foreign_keys=[rider_id])


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id = Column(Integer, primary_key=True, index=True)
    rider_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True, index=True)
    entry_type = Column(String(40), nullable=False)
    # commission_due | digital_payout_credit | settlement_to_admin | payout_to_rider | adjustment
    amount = Column(Float, nullable=False)
    signed_delta = Column(Float, nullable=False)
    balance_after = Column(Float, nullable=False)
    payment_channel = Column(String(32), nullable=False, default="system")
    reference_no = Column(String(80), nullable=True)
    note = Column(String(255), nullable=True)
    recorded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    rider = relationship("User", foreign_keys=[rider_id])
    recorded_by = relationship("User", foreign_keys=[recorded_by_id])


class AdminExpense(Base):
    __tablename__ = "admin_expenses"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(150), nullable=False)
    category = Column(String(50), nullable=False, default="other")
    amount = Column(Float, nullable=False)
    expense_date = Column(Date, nullable=False)
    note = Column(String(255), nullable=True)
    recorded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True)
    subject = Column(String(150), nullable=False)
    category = Column(String(40), nullable=False, default="general")
    message = Column(Text, nullable=False)
    status = Column(String(30), nullable=False, default="open")  # open | in_review | resolved
    admin_reply = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    user = relationship("User")
    booking = relationship("Booking")


class AppRelease(Base):
    __tablename__ = "app_releases"

    id = Column(Integer, primary_key=True, index=True)
    platform = Column(String(32), nullable=False, index=True)  # android_apk | windows_exe
    version = Column(String(32), nullable=False)
    file_name = Column(String(150), nullable=False)
    download_url = Column(String(500), nullable=False)
    file_size_mb = Column(Float, nullable=False, default=14.0)
    release_notes = Column(Text, nullable=True)
    is_latest = Column(Boolean, default=True, nullable=False)
    download_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String(80), primary_key=True)
    value = Column(String(255), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
