from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


# --- Auth ---
class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    phone: str = Field(..., min_length=7, max_length=32)
    email: Optional[str] = None
    password: str = Field(..., min_length=4, max_length=100)
    role: str = Field("customer", pattern="^(customer|rider)$")
    # Rider signup optional fields
    cnic_number: Optional[str] = None
    vehicle_type: Optional[str] = Field("bike", pattern="^(bike|car)$")
    bike_model: Optional[str] = "Honda CD-70"
    bike_plate: Optional[str] = None
    license_no: Optional[str] = None
    zone_name: Optional[str] = "Main Bazar / Lari Adda"
    rider_photo: Optional[str] = Field(None, max_length=950000)
    vehicle_photo: Optional[str] = Field(None, max_length=950000)
    cnic_front_photo: Optional[str] = Field(None, max_length=950000)
    cnic_back_photo: Optional[str] = Field(None, max_length=950000)


class LoginRequest(BaseModel):
    phone_or_email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=1)


# --- Pricing & Estimation ---
class FareEstimateRequest(BaseModel):
    service_type: str = Field("bike_ride", pattern="^(bike_ride|car_ride|parcel|errand)$")
    pickup_zone: str = "Main Bazar / Lari Adda"
    drop_zone: str = "Ghazikot Township"
    pickup_lat: Optional[float] = Field(None, ge=-90.0, le=90.0)
    pickup_lng: Optional[float] = Field(None, ge=-180.0, le=180.0)
    drop_lat: Optional[float] = Field(None, ge=-90.0, le=90.0)
    drop_lng: Optional[float] = Field(None, ge=-180.0, le=180.0)
    distance_km: float = Field(3.0, ge=0.5, le=300.0)
    wait_minutes: int = Field(0, ge=0, le=300)
    promo_code: Optional[str] = None


class PricingRuleUpdate(BaseModel):
    display_name: Optional[str] = None
    base_fare: Optional[float] = Field(None, ge=0)
    per_km_rate: Optional[float] = Field(None, ge=0)
    min_fare: Optional[float] = Field(None, ge=0)
    commission_type: Optional[str] = Field(None, pattern="^(percent|fixed)$")
    commission_value: Optional[float] = Field(None, ge=0)
    peak_multiplier: Optional[float] = Field(None, ge=0.5, le=5.0)
    city_flat_km: Optional[float] = Field(None, ge=0, le=100.0)
    city_flat_fare: Optional[float] = Field(None, ge=0)
    wait_free_minutes: Optional[int] = Field(None, ge=0, le=120)
    wait_charge_per_min: Optional[float] = Field(None, ge=0)
    is_active: Optional[bool] = None


# --- Bookings ---
class BookingCreate(BaseModel):
    service_type: str = Field("bike_ride", pattern="^(bike_ride|car_ride|parcel|errand)$")
    pickup_zone: str
    pickup_address: str = Field(..., min_length=2, max_length=255)
    pickup_lat: Optional[float] = Field(None, ge=-90.0, le=90.0)
    pickup_lng: Optional[float] = Field(None, ge=-180.0, le=180.0)
    drop_zone: str
    drop_address: str = Field(..., min_length=2, max_length=255)
    drop_lat: Optional[float] = Field(None, ge=-90.0, le=90.0)
    drop_lng: Optional[float] = Field(None, ge=-180.0, le=180.0)
    distance_km: float = Field(3.0, ge=0.5, le=300.0)
    wait_minutes: int = Field(0, ge=0, le=300)
    payment_method: str = Field("cash", pattern="^(cash|easypaisa|upaisa|jazzcash|bank|wallet)$")
    payment_reference: Optional[str] = Field(None, max_length=80)
    promo_code: Optional[str] = None
    receiver_name: Optional[str] = None
    receiver_phone: Optional[str] = None
    cod_amount: float = Field(0.0, ge=0)
    customer_notes: Optional[str] = None
    offer_fare: Optional[float] = Field(None, ge=50.0, le=200000.0)


class BookingRaiseFare(BaseModel):
    new_fare: float = Field(..., ge=50.0, le=200000.0)


class RideOfferCreate(BaseModel):
    offered_fare: float = Field(..., ge=50.0, le=200000.0)
    eta_minutes: int = Field(5, ge=1, le=120)
    note: Optional[str] = Field(None, max_length=200)


class RiderProfileSelfUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=120)
    vehicle_type: Optional[str] = Field(None, pattern="^(bike|car)$")
    bike_model: Optional[str] = Field(None, min_length=2, max_length=80)
    bike_plate: Optional[str] = Field(None, min_length=2, max_length=32)
    cnic_number: Optional[str] = Field(None, max_length=32)
    license_no: Optional[str] = Field(None, max_length=64)
    zone_name: Optional[str] = Field(None, max_length=100)
    rider_photo: Optional[str] = Field(None, max_length=950000)
    vehicle_photo: Optional[str] = Field(None, max_length=950000)
    cnic_front_photo: Optional[str] = Field(None, max_length=950000)
    cnic_back_photo: Optional[str] = Field(None, max_length=950000)


class BookingPaymentSubmit(BaseModel):
    payment_method: str = Field(..., pattern="^(easypaisa|upaisa|jazzcash|bank)$")
    payment_reference: str = Field(..., min_length=2, max_length=80)


class AdminManualBookingCreate(BookingCreate):
    customer_phone: str = Field(..., min_length=7, max_length=32)
    customer_name: Optional[str] = "Walk-in / Phone Customer"
    rider_id: Optional[int] = None
    custom_fare: Optional[float] = Field(None, ge=10)
    discount_amount: float = Field(0.0, ge=0)


class BookingAssignRider(BaseModel):
    rider_id: int


class BookingStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(arrived|in_progress|completed|cancelled)$")
    final_fare_override: Optional[float] = Field(None, ge=10)
    wait_minutes: Optional[int] = Field(None, ge=0, le=300)
    payment_collector: Optional[str] = Field(None, pattern="^(rider|admin)$")
    cancelled_reason: Optional[str] = None


class BookingRatingCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    feedback: Optional[str] = Field(None, max_length=255)


# --- Riders & Admin Management ---
class AdminCreateRider(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    phone: str = Field(..., min_length=7, max_length=32)
    password: str = Field("123456", min_length=4)
    cnic_number: Optional[str] = None
    vehicle_type: str = Field("bike", pattern="^(bike|car)$")
    bike_model: str = "Honda CD-70"
    bike_plate: str = Field(..., min_length=2, max_length=32)
    license_no: Optional[str] = None
    zone_name: str = "Main Bazar / Lari Adda"
    credit_limit: float = Field(1500.0, ge=0)
    remaining_paid_rides: int = Field(0, ge=0)
    topup_wallet_balance: float = Field(0.0, ge=0)
    custom_commission_type: Optional[str] = Field(None, pattern="^(percent|fixed)$")
    custom_commission_value: Optional[float] = Field(None, ge=0)
    rider_photo: Optional[str] = Field(None, max_length=950000)
    vehicle_photo: Optional[str] = Field(None, max_length=950000)
    cnic_front_photo: Optional[str] = Field(None, max_length=950000)
    cnic_back_photo: Optional[str] = Field(None, max_length=950000)
    is_verified: bool = False


class RiderConfigUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=120)
    phone: Optional[str] = Field(None, min_length=7, max_length=32)
    email: Optional[str] = None
    password: Optional[str] = Field(None, min_length=4, max_length=100)
    cnic_number: Optional[str] = None
    vehicle_type: Optional[str] = Field(None, pattern="^(bike|car)$")
    bike_model: Optional[str] = None
    bike_plate: Optional[str] = None
    license_no: Optional[str] = None
    is_verified: Optional[bool] = None
    is_online: Optional[bool] = None
    verification_status: Optional[str] = Field(None, pattern="^(incomplete|pending|verified|rejected)$")
    verification_note: Optional[str] = Field(None, max_length=255)
    is_active: Optional[bool] = None
    zone_name: Optional[str] = None
    sync_zone_coords: Optional[bool] = None
    rider_photo: Optional[str] = Field(None, max_length=950000)
    vehicle_photo: Optional[str] = Field(None, max_length=950000)
    cnic_front_photo: Optional[str] = Field(None, max_length=950000)
    cnic_back_photo: Optional[str] = Field(None, max_length=950000)
    current_lat: Optional[float] = Field(None, ge=-90.0, le=90.0)
    current_lng: Optional[float] = Field(None, ge=-180.0, le=180.0)
    credit_limit: Optional[float] = Field(None, ge=0)
    remaining_paid_rides: Optional[int] = Field(None, ge=0)
    topup_wallet_balance: Optional[float] = Field(None, ge=0)
    topup_per_ride_fee: Optional[float] = Field(None, ge=0)
    custom_commission_type: Optional[str] = Field(None, pattern="^(percent|fixed|none)$")
    custom_commission_value: Optional[float] = Field(None, ge=0)


class RiderLocationUpdate(BaseModel):
    lat: float = Field(..., ge=-90.0, le=90.0)
    lng: float = Field(..., ge=-180.0, le=180.0)
    is_online: Optional[bool] = None


class AdminPasswordReset(BaseModel):
    new_password: str = Field(..., min_length=4, max_length=100)


class AdminSelfUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=120)
    phone: Optional[str] = Field(None, min_length=7, max_length=32)
    email: Optional[str] = None


class AdminCustomerCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    phone: str = Field(..., min_length=7, max_length=32)
    email: Optional[str] = None
    password: str = Field("user123", min_length=4, max_length=100)


class AdminCustomerUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=120)
    phone: Optional[str] = Field(None, min_length=7, max_length=32)
    email: Optional[str] = None
    password: Optional[str] = Field(None, min_length=4, max_length=100)
    is_active: Optional[bool] = None


class AdminBookingUpdate(BaseModel):
    service_type: Optional[str] = Field(None, pattern="^(bike_ride|car_ride|parcel|errand)$")
    pickup_zone: Optional[str] = None
    pickup_address: Optional[str] = None
    drop_zone: Optional[str] = None
    drop_address: Optional[str] = None
    distance_km: Optional[float] = Field(None, ge=0.5, le=300.0)
    wait_minutes: Optional[int] = Field(None, ge=0, le=300)
    wait_charge: Optional[float] = Field(None, ge=0)
    discount_amount: Optional[float] = Field(None, ge=0)
    final_fare: Optional[float] = Field(None, ge=10)
    payment_method: Optional[str] = Field(None, pattern="^(cash|easypaisa|upaisa|jazzcash|bank|wallet)$")
    payment_collector: Optional[str] = Field(None, pattern="^(rider|admin)$")
    payment_status: Optional[str] = Field(None, pattern="^(pending|submitted|paid)$")
    payment_reference: Optional[str] = Field(None, max_length=80)
    receiver_name: Optional[str] = None
    receiver_phone: Optional[str] = None
    cod_amount: Optional[float] = Field(None, ge=0)
    customer_notes: Optional[str] = None


class SettlementCreate(BaseModel):
    rider_id: int
    amount: float = Field(..., gt=0)
    entry_type: str = Field("settlement_to_admin", pattern="^(settlement_to_admin|payout_to_rider|adjustment_reduce|adjustment_add)$")
    payment_channel: str = Field("cash", pattern="^(cash|easypaisa|upaisa|jazzcash|bank|system)$")
    reference_no: Optional[str] = None
    note: Optional[str] = None


class RiderSettlementSubmit(BaseModel):
    amount: float = Field(..., gt=0)
    payment_channel: str = Field(..., pattern="^(cash|easypaisa|upaisa|jazzcash|bank)$")
    reference_no: Optional[str] = Field(None, max_length=80)
    note: Optional[str] = Field(None, max_length=255)


class RiderTopupSubmit(BaseModel):
    amount: float = Field(..., gt=0)
    rides_requested: Optional[int] = Field(None, ge=1, le=500)
    payment_channel: str = Field("easypaisa", pattern="^(cash|easypaisa|upaisa|jazzcash|bank)$")
    reference_no: Optional[str] = Field(None, max_length=80)
    note: Optional[str] = Field(None, max_length=255)


class RiderTopupProofSubmit(BaseModel):
    reference_no: str = Field(..., min_length=2, max_length=80)
    note: Optional[str] = Field(None, max_length=255)


class AdminTopupReview(BaseModel):
    rides_granted: Optional[int] = Field(None, ge=1, le=500)
    amount: Optional[float] = Field(None, gt=0)
    admin_note: Optional[str] = Field(None, max_length=255)


class ExpenseCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=150)
    category: str = Field("other", pattern="^(office_rent|marketing|staff|phone_internet|rider_bonus|other)$")
    amount: float = Field(..., gt=0)
    expense_date: date
    note: Optional[str] = None


class ExpenseUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=150)
    category: Optional[str] = Field(None, pattern="^(office_rent|marketing|staff|phone_internet|rider_bonus|other)$")
    amount: Optional[float] = Field(None, gt=0)
    expense_date: Optional[date] = None
    note: Optional[str] = None


class LedgerEntryUpdate(BaseModel):
    payment_channel: Optional[str] = Field(None, pattern="^(cash|easypaisa|upaisa|jazzcash|bank|system)$")
    reference_no: Optional[str] = None
    note: Optional[str] = None


class ZoneCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    area_tag: str = "City Core"
    approx_km_from_center: float = Field(2.0, ge=0)
    surcharge: float = Field(0.0, ge=0)
    lat: Optional[float] = Field(None, ge=-90.0, le=90.0)
    lng: Optional[float] = Field(None, ge=-180.0, le=180.0)


class ZoneUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=120)
    area_tag: Optional[str] = None
    approx_km_from_center: Optional[float] = Field(None, ge=0)
    surcharge: Optional[float] = Field(None, ge=0)
    lat: Optional[float] = Field(None, ge=-90.0, le=90.0)
    lng: Optional[float] = Field(None, ge=-180.0, le=180.0)
    is_active: Optional[bool] = None


class PromoCreate(BaseModel):
    code: str = Field(..., min_length=2, max_length=40)
    discount_type: str = Field("fixed", pattern="^(fixed|percent)$")
    discount_value: float = Field(..., gt=0)
    max_discount: float = Field(100.0, ge=0)
    min_fare: float = Field(80.0, ge=0)


class PromoUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=2, max_length=40)
    discount_type: Optional[str] = Field(None, pattern="^(fixed|percent)$")
    discount_value: Optional[float] = Field(None, gt=0)
    max_discount: Optional[float] = Field(None, ge=0)
    min_fare: Optional[float] = Field(None, ge=0)
    is_active: Optional[bool] = None


class SupportTicketCreate(BaseModel):
    booking_id: Optional[int] = None
    subject: str = Field(..., min_length=3, max_length=150)
    category: str = "general"
    message: str = Field(..., min_length=5)


class SupportTicketReply(BaseModel):
    status: str = Field(..., pattern="^(open|in_review|resolved)$")
    admin_reply: str = Field(..., min_length=2)


class ReleaseCreate(BaseModel):
    platform: str = Field(..., pattern="^(android_apk|windows_exe)$")
    version: str = Field(..., min_length=1, max_length=32)
    file_name: str = Field(..., min_length=2, max_length=150)
    download_url: str = Field(..., min_length=1, max_length=500)
    file_size_mb: float = Field(14.0, gt=0)
    release_notes: Optional[str] = None
    is_latest: bool = True


class ReleaseUpdate(BaseModel):
    platform: Optional[str] = Field(None, pattern="^(android_apk|windows_exe)$")
    version: Optional[str] = Field(None, min_length=1, max_length=32)
    file_name: Optional[str] = Field(None, min_length=2, max_length=150)
    download_url: Optional[str] = Field(None, min_length=1, max_length=500)
    file_size_mb: Optional[float] = Field(None, gt=0)
    release_notes: Optional[str] = None
    is_latest: Optional[bool] = None


class SystemSettingUpdate(BaseModel):
    value: str = Field("", max_length=255)


class EmergencySosCreate(BaseModel):
    emergency_type: str = Field("police_1122", max_length=40)
    lat: Optional[float] = Field(None, ge=-90.0, le=90.0)
    lng: Optional[float] = Field(None, ge=-180.0, le=180.0)
    booking_id: Optional[int] = None
    note: Optional[str] = Field(None, max_length=500)
    called_number: Optional[str] = Field("1122", max_length=32)


class EmergencySosStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(active|acknowledged|resolved)$")
    resolution_note: Optional[str] = Field(None, max_length=255)
