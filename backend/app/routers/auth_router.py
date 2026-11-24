from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.auth import create_access_token, get_current_user, hash_password, verify_password
from app.database import get_db
from app.models import MansehraZone, RiderProfile, SystemSetting, User
from app.schemas import LoginRequest, RegisterRequest

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


def serialize_user(user: User) -> dict:
    data = {
        "id": user.id,
        "full_name": user.full_name,
        "phone": user.phone,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "created_at": user.created_at,
        "rider_profile": None,
    }
    if user.rider_profile:
        rp = user.rider_profile
        data["rider_profile"] = {
            "id": rp.id,
            "cnic_number": rp.cnic_number,
            "vehicle_type": rp.vehicle_type,
            "bike_model": rp.bike_model,
            "bike_plate": rp.bike_plate,
            "license_no": rp.license_no,
            "zone_name": rp.zone_name,
            "current_lat": rp.current_lat,
            "current_lng": rp.current_lng,
            "location_updated_at": rp.location_updated_at,
            "is_verified": rp.is_verified,
            "is_online": rp.is_online,
            "credit_limit": rp.credit_limit,
            "balance_due_to_admin": rp.balance_due_to_admin,
            "custom_commission_type": rp.custom_commission_type,
            "custom_commission_value": rp.custom_commission_value,
            "total_trips": rp.total_trips,
            "total_gross_collected": rp.total_gross_collected,
            "total_net_earned": rp.total_net_earned,
            "total_commission_generated": rp.total_commission_generated,
            "total_settled_to_admin": rp.total_settled_to_admin,
            "rating_avg": rp.rating_avg,
        }
    return data


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    clean_phone = payload.phone.strip()
    if db.query(User).filter(User.phone == clean_phone).first():
        raise HTTPException(status_code=400, detail="Phone number is already registered")
    if payload.email and db.query(User).filter(User.email == payload.email.strip()).first():
        raise HTTPException(status_code=400, detail="Email is already registered")
    if payload.role == "rider" and not payload.bike_plate:
        raise HTTPException(status_code=400, detail="Bike number plate is required for Rider registration")

    user = User(
        full_name=payload.full_name.strip(),
        phone=clean_phone,
        email=payload.email.strip() if payload.email else None,
        password_hash=hash_password(payload.password),
        role=payload.role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    if payload.role == "rider":
        cap_setting = db.query(SystemSetting).filter(SystemSetting.key == "default_credit_limit").first()
        credit_limit = float(cap_setting.value) if cap_setting else 1500.0
        z = db.query(MansehraZone).filter(MansehraZone.name == (payload.zone_name or "Main Bazar / Lari Adda")).first()
        vtype = payload.vehicle_type or (
            "car" if payload.bike_model and any(w in payload.bike_model.lower() for w in ("alto", "corolla", "civic", "mehran", "cultus", "car", "vitz", "wagon", "hiace")) else "bike"
        )
        rp = RiderProfile(
            user_id=user.id,
            cnic_number=payload.cnic_number,
            vehicle_type=vtype,
            bike_model=payload.bike_model or ("Suzuki Alto" if vtype == "car" else "Honda CD-70"),
            bike_plate=payload.bike_plate.strip().upper(),
            license_no=payload.license_no,
            zone_name=payload.zone_name or "Main Bazar / Lari Adda",
            current_lat=z.lat if z else 34.3335,
            current_lng=z.lng if z else 73.1995,
            is_verified=False,  # Requires Admin verification before going online
            is_online=False,
            credit_limit=credit_limit,
        )
        db.add(rp)
        db.commit()
        db.refresh(user)

    token = create_access_token(user)
    return {"access_token": token, "token_type": "bearer", "user": serialize_user(user)}


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    identifier = payload.phone_or_email.strip()
    user = (
        db.query(User)
        .filter((User.phone == identifier) | (User.email == identifier))
        .first()
    )
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid phone/email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account has been deactivated by Admin")

    token = create_access_token(user)
    return {"access_token": token, "token_type": "bearer", "user": serialize_user(user)}


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return {"user": serialize_user(current_user)}
