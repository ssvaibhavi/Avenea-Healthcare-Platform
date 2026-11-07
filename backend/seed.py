"""Seed Avenea with clearly-synthetic demo patients + screenings.

Run:  cd /app/backend && python seed.py
Idempotent: skipped when patients already exist (FORCE=1 to reseed).
"""

import asyncio
import os
from datetime import datetime, timedelta, timezone

from lib.db import db, ensure_indexes
from models.patients import Patient
from models.screenings import Lifestyle, Screening, Vitals, compute_risk

# (name, age, sex, community, phone, days_ago, profile)
# profile keys: sbp, dbp, pulse, weight, height, glucose, smoker, alcohol, activity,
#               symptoms, notes, referral (overrides the level default), extra_days_ago (2nd visit)
PATIENTS: list[dict] = [
    dict(name="Asha Devi", age=54, sex="female", community="Rampur", phone="+91 98xxxx1201",
         visits=[
             dict(days_ago=12, sbp=168, dbp=102, pulse=88, weight=64, height=157, glucose=186,
                  smoker=False, alcohol=False, activity="low", symptoms=["fatigue", "swelling"],
                  notes="Raised BP at camp visit. Advised low-salt diet; referral initiated.",
                  referral="completed"),
             dict(days_ago=2, sbp=152, dbp=96, pulse=84, weight=63, height=157, glucose=172,
                  smoker=False, alcohol=False, activity="low", symptoms=["fatigue"],
                  notes="Follow-up at Rampur sub-centre. BP improving on plan; keep monitoring.",
                  referral="scheduled"),
         ]),
    dict(name="Ramesh Kumar", age=61, sex="male", community="Rampur", phone="+91 98xxxx1202",
         visits=[
             dict(days_ago=9, sbp=172, dbp=104, pulse=95, weight=71, height=168, glucose=142,
                  smoker=True, alcohol=False, activity="low", symptoms=["chest_pain", "breathlessness"],
                  notes="Chest pain on exertion reported. Escalated for clinic review.",
                  referral="pending"),
         ]),
    dict(name="Kamla Bai", age=47, sex="female", community="Kishanganj", phone="+91 98xxxx1203",
         visits=[
             dict(days_ago=7, sbp=146, dbp=92, pulse=82, weight=58, height=152, glucose=118,
                  smoker=False, alcohol=False, activity="moderate", symptoms=["fatigue", "headache"],
                  notes="Borderline BP. Recheck advised in two weeks.",
                  referral="pending"),
         ]),
    dict(name="Sunita Kumari", age=29, sex="female", community="Belgaon", phone="+91 98xxxx1204",
         visits=[
             dict(days_ago=6, sbp=112, dbp=74, pulse=76, weight=52, height=158, glucose=92,
                  smoker=False, alcohol=False, activity="active", symptoms=[],
                  notes="Routine camp screening. All readings within normal range."),
         ]),
    dict(name="Vijay Paswan", age=38, sex="male", community="Sonapur", phone="+91 98xxxx1205",
         visits=[
             dict(days_ago=5, sbp=124, dbp=80, pulse=78, weight=69, height=170, glucose=98,
                  smoker=True, alcohol=True, activity="moderate", symptoms=[],
                  notes="Counselled on tobacco and alcohol reduction."),
         ]),
    dict(name="Lakshmi Narayan", age=66, sex="female", community="Hariyali", phone="+91 98xxxx1206",
         visits=[
             dict(days_ago=8, sbp=158, dbp=98, pulse=90, weight=61, height=154, glucose=214,
                  smoker=False, alcohol=False, activity="low", symptoms=["blurred_vision", "fatigue"],
                  notes="Very high fasting glucose with visual symptoms. Urgent referral.",
                  referral="pending"),
         ]),
    dict(name="Arjun Yadav", age=52, sex="male", community="Kishanganj", phone="+91 98xxxx1207",
         visits=[
             dict(days_ago=4, sbp=144, dbp=90, pulse=80, weight=75, height=167, glucose=112,
                  smoker=False, alcohol=True, activity="moderate", symptoms=["dizziness"],
                  notes="Occasional dizziness reported. BP to be rechecked."),
         ]),
    dict(name="Pooja Sharma", age=34, sex="female", community="Rampur", phone="+91 98xxxx1208",
         visits=[
             dict(days_ago=3, sbp=116, dbp=76, pulse=74, weight=57, height=161, glucose=88,
                  smoker=False, alcohol=False, activity="active", symptoms=[],
                  notes="Wellness visit. No concerns noted."),
         ]),
    dict(name="Mohammed Ansari", age=58, sex="male", community="Sonapur", phone="+91 98xxxx1209",
         visits=[
             dict(days_ago=10, sbp=142, dbp=88, pulse=84, weight=66, height=165, glucose=128,
                  smoker=True, alcohol=False, activity="low", symptoms=["persistent_cough"],
                  notes="Persistent cough over three weeks. Referred for review.",
                  referral="pending"),
         ]),
    dict(name="Gita Devi", age=71, sex="female", community="Hariyali", phone="+91 98xxxx1210",
         visits=[
             dict(days_ago=6, sbp=162, dbp=96, pulse=92, weight=54, height=150, glucose=138,
                  smoker=False, alcohol=False, activity="low", symptoms=["fatigue", "dizziness", "swelling"],
                  notes="Elderly, elevated BP with swelling. Clinic visit being arranged.",
                  referral="scheduled"),
         ]),
    dict(name="Rahul Mishra", age=26, sex="male", community="Belgaon", phone="+91 98xxxx1211",
         visits=[
             dict(days_ago=2, sbp=118, dbp=78, pulse=72, weight=63, height=172, glucose=90,
                  smoker=False, alcohol=False, activity="active", symptoms=[],
                  notes="First camp visit. Healthy readings."),
         ]),
    dict(name="Sarita Munda", age=43, sex="female", community="Kishanganj", phone="+91 98xxxx1212",
         visits=[
             dict(days_ago=1, sbp=132, dbp=84, pulse=80, weight=62, height=155, glucose=158,
                  smoker=False, alcohol=False, activity="moderate", symptoms=["fatigue"],
                  notes="Raised fasting glucose. Diet counselling given; glucose recheck planned.",
                  referral="pending"),
         ]),
    dict(name="Devi Lal", age=68, sex="male", community="Rampur", phone="+91 98xxxx1213",
         visits=[
             dict(days_ago=0, sbp=154, dbp=100, pulse=86, weight=68, height=164, glucose=134,
                  smoker=False, alcohol=True, activity="low", symptoms=["breathlessness"],
                  notes="Breathlessness on walking. Same-day escalation to coordination team.",
                  referral="pending"),
         ]),
    dict(name="Nisha Verma", age=31, sex="female", community="Sonapur", phone="+91 98xxxx1214",
         visits=[]),
]


async def seed() -> None:
    await ensure_indexes()
    if await db.patients.count_documents({}) > 0 and os.environ.get("FORCE") != "1":
        print("patients collection not empty — seed skipped (FORCE=1 to reseed)")
        return

    await db.patients.delete_many({"seeded_demo": True})
    await db.screenings.delete_many({"seeded_demo": True})

    now = datetime.now(timezone.utc)
    patient_count = 0
    screening_count = 0
    for entry in PATIENTS:
        patient = Patient(
            name=entry["name"], age=entry["age"], sex=entry["sex"],
            community=entry["community"], phone=entry["phone"],
            created_at=now - timedelta(days=30), seeded_demo=True,
        )
        await db.patients.insert_one(patient.model_dump())
        patient_count += 1
        for visit in entry["visits"]:
            vitals = Vitals(
                systolic=visit["sbp"], diastolic=visit["dbp"], pulse=visit["pulse"],
                weight_kg=visit["weight"], height_cm=visit["height"], glucose=visit["glucose"],
            )
            lifestyle = Lifestyle(smoker=visit["smoker"], alcohol=visit["alcohol"], activity=visit["activity"])
            symptoms = visit["symptoms"]
            score, level, flags = compute_risk(vitals, lifestyle, symptoms, entry["age"])
            referral = visit.get("referral") or ("none" if level == "low" else "pending")
            created = now - timedelta(days=visit["days_ago"], hours=9 + screening_count % 6)
            screening = Screening(
                patient_id=patient.id, patient_name=patient.name, patient_age=patient.age,
                patient_sex=patient.sex, community=patient.community,
                vitals=vitals, lifestyle=lifestyle, symptoms=symptoms, notes=visit.get("notes", ""),
                flags=flags, risk_score=score, risk_level=level, referral_status=referral,
                created_at=created, seeded_demo=True,
            )
            await db.screenings.insert_one(screening.model_dump())
            screening_count += 1

    print(f"seeded {patient_count} demo patients, {screening_count} demo screenings")


if __name__ == "__main__":
    asyncio.run(seed())
