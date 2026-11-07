"""Patient models — Avenea. All data in this environment is synthetic demo data."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


class PatientCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    age: int = Field(ge=0, le=120)
    sex: str = "female"
    community: str = Field("", max_length=120)
    phone: str = Field("", max_length=40)


class PatientUpdate(BaseModel):
    """Partial update — only the fields provided are applied."""

    name: Optional[str] = Field(None, min_length=1, max_length=120)
    age: Optional[int] = Field(None, ge=0, le=120)
    sex: Optional[str] = None
    community: Optional[str] = Field(None, max_length=120)
    phone: Optional[str] = Field(None, max_length=40)


class Patient(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    age: int
    sex: str = "female"
    community: str = ""
    phone: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    seeded_demo: bool = False


class PatientSummary(Patient):
    """Patient plus a roll-up of their most recent screening."""

    screening_count: int = 0
    last_screening_at: Optional[datetime] = None
    risk_level: Optional[str] = None
    referral_status: Optional[str] = None
