"""Screening routes — /api/screenings. Authorised + org/relationship scoped."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo import DESCENDING

from lib.dates import as_aware
from lib.db import db
from models.patients import Patient
from models.screenings import (
    ReferralUpdate,
    Screening,
    ScreeningCreate,
    compute_risk,
)
from security.access import (
    audit,
    current_principal,
    default_coordinator,
    deny,
    new_patient_envelope,
    require_access,
    scoped,
    screening_read_action,
)
from security.audit import AuditEventType, AuditOutcome
from security.identity import Principal
from security.policy import authorize
from security.roles import Action

router = APIRouter()

_DEMOGRAPHIC_FIELDS = ("age", "sex", "community", "phone")
_ENVELOPE = ("org_id", "assigned_worker_ids", "care_team_ids")


@router.post("/screenings", response_model=Screening, status_code=201)
async def create_screening(input: ScreeningCreate, principal: Principal = Depends(require_access(Action.SCREENING_CREATE))):
    if input.patient_id:
        query = scoped(principal, Action.SCREENING_CREATE, {"id": input.patient_id})
        doc = await db.patients.find_one(query)
        if not doc:
            raise HTTPException(status_code=404, detail="patient not found")
        p = dict(doc)
        updates = {f: getattr(input, f) for f in _DEMOGRAPHIC_FIELDS if getattr(input, f) is not None}
        if updates:
            await db.patients.update_one(query, {"$set": updates})
            p.update(updates)
    elif input.new_patient_name:
        if input.age is None:
            raise HTTPException(status_code=422, detail="age is required when creating a new patient")
        if not authorize(principal, Action.PATIENT_CREATE).allowed:
            await deny(principal, Action.PATIENT_CREATE, "role may not create patients")
        patient = Patient(
            name=input.new_patient_name,
            age=input.age,
            sex=input.sex or "female",
            community=input.community or "",
            phone=input.phone or "",
        )
        p = {**patient.model_dump(), **await new_patient_envelope(principal)}
        await db.patients.insert_one(dict(p))
    else:
        raise HTTPException(status_code=422, detail="select an existing patient or provide new_patient_name")

    score, level, flags = compute_risk(input.vitals, input.lifestyle, input.symptoms, p["age"])
    screening = Screening(
        patient_id=p["id"],
        patient_name=p["name"],
        patient_age=p["age"],
        patient_sex=p.get("sex", "female"),
        community=p.get("community", ""),
        vitals=input.vitals,
        lifestyle=input.lifestyle,
        symptoms=input.symptoms,
        notes=input.notes,
        flags=flags,
        risk_score=score,
        risk_level=level,
        referral_status="none" if level == "low" else "pending",
    )
    envelope = {k: p.get(k) for k in _ENVELOPE}
    envelope["org_id"] = principal.org_id
    if screening.referral_status != "none":
        coordinator = await default_coordinator(principal.org_id)
        if coordinator:
            envelope["coordinator_user_id"] = coordinator
            await db.patients.update_one({"id": p["id"], "org_id": principal.org_id}, {"$addToSet": {"referral_coordinator_ids": coordinator}})
    await db.screenings.insert_one({**screening.model_dump(), **envelope, "created_by": principal.user_id})
    await audit().record(AuditEventType.SCREENING_UPDATE, AuditOutcome.SUCCESS, principal=principal, action=Action.SCREENING_CREATE, resource_type="screening", resource_id=screening.id)
    return screening


@router.get("/screenings", response_model=List[Screening])
async def list_screenings(
    risk: Optional[str] = None,
    referral: Optional[str] = None,
    patient_id: Optional[str] = None,
    limit: int = Query(200, ge=1, le=500),
    principal: Principal = Depends(current_principal),
):
    action = screening_read_action(principal)
    decision = authorize(principal, action)
    if not decision.allowed:
        await deny(principal, action, decision.reason)
    q: dict = {}
    if risk:
        q["risk_level"] = risk
    if referral:
        q["referral_status"] = referral
    if patient_id:
        q["patient_id"] = patient_id
    docs = await db.screenings.find(scoped(principal, action, q)).sort("created_at", DESCENDING).to_list(limit)
    return [Screening(**{**d, "created_at": as_aware(d["created_at"])}) for d in docs]


@router.patch("/screenings/{id}/referral", response_model=Screening)
async def update_referral(id: str, input: ReferralUpdate, principal: Principal = Depends(require_access(Action.REFERRAL_UPDATE))):
    query = scoped(principal, Action.REFERRAL_UPDATE, {"id": id})
    doc = await db.screenings.find_one(query)
    if not doc:
        await deny(principal, Action.REFERRAL_UPDATE, "screening not found or not visible", 404, id, "screening not found")
    updates: dict = {"referral_status": input.referral_status}
    if input.referral_note is not None:
        updates["referral_note"] = input.referral_note
    if input.coordinator is not None:
        updates["coordinator"] = input.coordinator
    if input.referral_due_date is not None:
        updates["referral_due_date"] = input.referral_due_date
    await db.screenings.update_one(query, {"$set": updates})
    await audit().record(AuditEventType.REFERRAL_UPDATE, AuditOutcome.SUCCESS, principal=principal, action=Action.REFERRAL_UPDATE, resource_type="referral", resource_id=id, metadata={"new_status": input.referral_status})
    doc.update(updates)
    doc["created_at"] = as_aware(doc["created_at"])
    return Screening(**doc)
