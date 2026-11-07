"""Analytics summary — derived from the synthetic demo records only."""
from collections import Counter
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from lib.dates import as_aware, today_iso
from lib.db import db
from security.access import require_access, scoped
from security.identity import Principal
from security.roles import Action

router = APIRouter()

_SYMPTOM_LABELS = {
    "fever": "Fever",
    "persistent_cough": "Persistent cough",
    "chest_pain": "Chest pain",
    "breathlessness": "Breathlessness",
    "fatigue": "Fatigue",
    "headache": "Headache",
    "blurred_vision": "Blurred vision",
    "swelling": "Swelling",
    "abdominal_pain": "Abdominal pain",
    "dizziness": "Dizziness",
}


class Totals(BaseModel):
    patients: int
    screenings: int
    open_referrals: int
    communities: int


class LevelCount(BaseModel):
    level: str
    count: int


class StatusCount(BaseModel):
    status: str
    count: int


class DayCount(BaseModel):
    date: str
    count: int


class SymptomCount(BaseModel):
    symptom: str
    count: int


class AnalyticsSummary(BaseModel):
    totals: Totals
    risk_distribution: list[LevelCount]
    referral_pipeline: list[StatusCount]
    screenings_by_day: list[DayCount]
    top_symptoms: list[SymptomCount]
    avg_age: float
    today: str = ""
    demo: bool = True


@router.get("/analytics/summary", response_model=AnalyticsSummary)
async def analytics_summary(principal: Principal = Depends(require_access(Action.ANALYTICS_READ))):
    patients = await db.patients.find(scoped(principal, Action.ANALYTICS_READ)).to_list(5000)
    screenings = await db.screenings.find(scoped(principal, Action.ANALYTICS_READ)).to_list(5000)

    communities = len({p.get("community", "") for p in patients if p.get("community")})
    open_referrals = sum(1 for s in screenings if s.get("referral_status") in ("pending", "scheduled"))

    risk_counts = Counter(s.get("risk_level", "low") for s in screenings)
    referral_counts = Counter(s.get("referral_status", "none") for s in screenings)

    today = date.today()
    days = [today - timedelta(days=i) for i in range(13, -1, -1)]
    day_counts = {d.isoformat(): 0 for d in days}
    for s in screenings:
        key = as_aware(s["created_at"]).date().isoformat()
        if key in day_counts:
            day_counts[key] += 1

    symptom_counter = Counter()
    for s in screenings:
        for key in s.get("symptoms", []):
            symptom_counter[_SYMPTOM_LABELS.get(key, key.replace("_", " ").title())] += 1

    ages = [p["age"] for p in patients] or [0]
    return AnalyticsSummary(
        totals=Totals(
            patients=len(patients),
            screenings=len(screenings),
            open_referrals=open_referrals,
            communities=communities,
        ),
        risk_distribution=[
            LevelCount(level=level, count=risk_counts.get(level, 0))
            for level in ("low", "moderate", "high")
        ],
        referral_pipeline=[
            StatusCount(status=status, count=referral_counts.get(status, 0))
            for status in ("pending", "scheduled", "completed")
        ],
        screenings_by_day=[DayCount(date=k, count=v) for k, v in day_counts.items()],
        top_symptoms=[
            SymptomCount(symptom=name, count=count)
            for name, count in symptom_counter.most_common(6)
        ],
        avg_age=round(sum(ages) / len(ages), 1),
        today=today_iso(),
    )


class PublicStats(BaseModel):
    """Public, non-identifying aggregate counts for the landing page (no records, no clinical values)."""

    totals: Totals
    demo: bool = True


@router.get("/public/stats", response_model=PublicStats)
async def public_stats():
    screenings = await db.screenings.find({}, {"_id": 0, "referral_status": 1}).to_list(5000)
    return PublicStats(
        totals=Totals(
            patients=await db.patients.count_documents({}),
            screenings=len(screenings),
            open_referrals=sum(1 for s in screenings if s.get("referral_status") in ("pending", "scheduled")),
            communities=len([c for c in await db.patients.distinct("community") if c]),
        )
    )
