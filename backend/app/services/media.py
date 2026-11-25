from typing import Optional
from fastapi import HTTPException


def clean_image_data_uri(raw: Optional[str]) -> Optional[str]:
    """Validate optional client-compressed image data URI safely."""
    if raw is None:
        return None
    val = raw.strip()
    if not val:
        return ""
    if not val.startswith("data:image/") or ";base64," not in val[:48]:
        raise HTTPException(
            status_code=400,
            detail="Invalid image format. Please upload a valid JPG/PNG/WebP photo.",
        )
    return val


def get_missing_captain_docs(rp) -> list[str]:
    """Return human-readable list of missing required Captain verification documents."""
    if not rp:
        return [
            "Captain Selfie / Photo",
            "Bike / Car Photo",
            "CNIC Front Photo",
            "CNIC Back / Driving License Photo",
            "CNIC Number",
            "Vehicle Model",
            "Number Plate",
        ]
    missing = []
    vehicle_label = "Car Photo" if getattr(rp, "vehicle_type", "bike") == "car" else "Bike Photo"
    if not (getattr(rp, "rider_photo", None) or "").strip():
        missing.append("Captain Selfie / Photo")
    if not (getattr(rp, "vehicle_photo", None) or "").strip():
        missing.append(vehicle_label)
    if not (getattr(rp, "cnic_front_photo", None) or "").strip():
        missing.append("CNIC Front Photo")
    if not (getattr(rp, "cnic_back_photo", None) or "").strip():
        missing.append("CNIC Back / Driving License Photo")
    if not (getattr(rp, "cnic_number", None) or "").strip():
        missing.append("CNIC Number")
    if not (getattr(rp, "bike_model", None) or "").strip():
        missing.append("Vehicle Model")
    if not (getattr(rp, "bike_plate", None) or "").strip():
        missing.append("Number Plate")
    return missing


def has_complete_captain_docs(rp) -> bool:
    return len(get_missing_captain_docs(rp)) == 0
