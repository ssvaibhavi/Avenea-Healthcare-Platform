"""Screening models + the demo risk heuristic.

The heuristic below is a transparent, rule-based demo scoring aid — it is NOT a
clinically validated risk model and must never be presented as one.
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

from .patients import PatientSummary

SYMPTOM_KEYS = [
    "fever",
    "persistent_cough",
    "chest_pain",
    "breathlessness",
    "fatigue",
    "headache",
    "blurred_vision",
    "swelling",
    "abdominal_pain",
    "dizziness",
]
RED_FLAG_SYMPTOMS = {"chest_pain", "breathlessness"}
ACTIVITY_LEVELS = {"low", "moderate", "active"}
REFERRAL_STATUSES = {"none", "pending", "scheduled", "completed"}


class Vitals(BaseModel):
    systolic: Optional[int] = Field(None, ge=50, le=300)
    diastolic: Optional[int] = Field(None, ge=30, le=200)
    pulse: Optional[int] = Field(None, ge=30, le=220)
    weight_kg: Optional[float] = Field(None, gt=0, le=400)
    height_cm: Optional[float] = Field(None, gt=0, le=260)
    glucose: Optional[int] = Field(None, ge=20, le=700)


class Lifestyle(BaseModel):
    smoker: bool = False
    alcohol: bool = False
    activity: str = "moderate"

    @field_validator("activity")
    @classmethod
    def check_activity(cls, v: str) -> str:
        if v not in ACTIVITY_LEVELS:
            raise ValueError("activity must be low, moderate or active")
        return v


class ScreeningCreate(BaseModel):
    """Either `patient_id` (existing patient, demographics update in place) or
    `new_patient_name` (+ age) to create the patient inline."""

    patient_id: Optional[str] = None
    new_patient_name: Optional[str] = Field(None, max_length=120)
    age: Optional[int] = Field(None, ge=0, le=120)
    sex: Optional[str] = None
    community: Optional[str] = Field(None, max_length=120)
    phone: Optional[str] = Field(None, max_length=40)
    vitals: Vitals = Field(default_factory=Vitals)
    lifestyle: Lifestyle = Field(default_factory=Lifestyle)
    symptoms: List[str] = Field(default_factory=list)
    notes: str = Field("", max_length=2000)


class Screening(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    patient_id: str
    patient_name: str
    patient_age: int
    patient_sex: str
    community: str = ""
    vitals: Vitals
    lifestyle: Lifestyle
    symptoms: List[str] = Field(default_factory=list)
    notes: str = ""
    flags: List[str] = Field(default_factory=list)
    risk_score: int = 0
    risk_level: str = "low"
    referral_status: str = "none"
    referral_note: str = ""
    coordinator: str = ""
    referral_due_date: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    seeded_demo: bool = False


class ReferralUpdate(BaseModel):
    referral_status: str
    referral_note: Optional[str] = None
    coordinator: Optional[str] = Field(None, max_length=120)
    referral_due_date: Optional[str] = None

    @field_validator("referral_due_date")
    @classmethod
    def check_due_date(cls, v: Optional[str]) -> Optional[str]:
        if v not in (None, ""):
            try:
                datetime.strptime(v, "%Y-%m-%d")
            except ValueError as exc:
                raise ValueError("referral_due_date must be YYYY-MM-DD") from exc
        return v

    @field_validator("referral_status")
    @classmethod
    def check_status(cls, v: str) -> str:
        if v not in REFERRAL_STATUSES:
            raise ValueError("referral_status must be none, pending, scheduled or completed")
        return v


class PatientDetail(PatientSummary):
    screenings: List[Screening] = Field(default_factory=list)


def compute_risk(vitals: Vitals, lifestyle: Lifestyle, symptoms: List[str], age: int) -> tuple[int, str, List[str]]:
    """Demo heuristic: transparent additive score. Not clinically validated."""
    score = 0
    flags: List[str] = []

    if vitals.systolic is not None and vitals.diastolic is not None:
        if vitals.systolic >= 160 or vitals.diastolic >= 100:
            score += 3
            flags.append("Severely elevated blood pressure")
        elif vitals.systolic >= 140 or vitals.diastolic >= 90:
            score += 2
            flags.append("Elevated blood pressure")

    if vitals.glucose is not None:
        if vitals.glucose >= 200:
            score += 3
            flags.append("High fasting glucose")
        elif vitals.glucose >= 140:
            score += 2
            flags.append("Borderline fasting glucose")

    if vitals.pulse is not None and vitals.pulse > 100:
        score += 1
        flags.append("Resting tachycardia")

    if age >= 60:
        score += 2
    elif age >= 45:
        score += 1

    if lifestyle.smoker:
        score += 1
        flags.append("Tobacco use")
    if lifestyle.alcohol:
        score += 1
        flags.append("Regular alcohol use")
    if lifestyle.activity == "low":
        score += 1
        flags.append("Sedentary lifestyle")

    if symptoms:
        score += min(len(symptoms), 3)
        if RED_FLAG_SYMPTOMS.intersection(symptoms):
            score += 2
            flags.append("Red-flag symptom reported")

    level = "high" if score >= 7 else "moderate" if score >= 4 else "low"
    return score, level, flags
