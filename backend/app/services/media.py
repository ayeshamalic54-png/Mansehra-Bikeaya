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
