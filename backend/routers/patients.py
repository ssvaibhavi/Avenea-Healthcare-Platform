"""Patient registry routes — /api/patients. Every route requires an authorised principal;
queries are folded with the caller's org + relationship scope (out-of-scope -> 404)."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pymongo import DESCENDING

from lib.dates import as_aware
from lib.db import db
from models.patients import Patient, PatientCreate, PatientSummary, PatientUpdate
from models.screenings import PatientDetail, Screening
from security.access import audit, deny, new_patient_envelope, require_access, scoped, screening_read_action
from security.audit import AuditEventType, AuditOutcome
from security.identity import Principal
from security.roles import Action

router = APIRouter()


def _norm_patient(doc: dict) -> dict:
    doc = dict(doc)
    if doc.get("created_at") is not None:
        doc["created_at"] = as_aware(doc["created_at"])
    return doc


async def _scoped_screenings(principal: Principal, query: dict | None = None, limit: int = 5000) -> list[dict]:
    return await db.screenings.find(scoped(principal, screening_read_action(principal), query)).sort("created_at", DESCENDING).to_list(limit)


def _summary(p: dict, history: list[dict]) -> PatientSummary:
    latest = history[0] if history else None
    return PatientSummary(
        **p,
        screening_count=len(history),
        last_screening_at=as_aware(latest["created_at"]) if latest else None,
        risk_level=(latest or {}).get("risk_level"),
        referral_status=(latest or {}).get("referral_status"),
    )


@router.get("/patients", response_model=List[PatientSummary])
async def list_patients(principal: Principal = Depends(require_access(Action.PATIENT_READ))):
    patients = await db.patients.find(scoped(principal, Action.PATIENT_READ)).sort("created_at", DESCENDING).to_list(2000)
    by_patient: dict[str, list[dict]] = {}
    for s in await _scoped_screenings(principal):
        by_patient.setdefault(s.get("patient_id", ""), []).append(s)
    return [_summary(_norm_patient(doc), by_patient.get(doc["id"], [])) for doc in patients]


@router.post("/patients", response_model=Patient, status_code=201)
async def create_patient(input: PatientCreate, principal: Principal = Depends(require_access(Action.PATIENT_CREATE))):
    patient = Patient(**input.model_dump())
    await db.patients.insert_one({**patient.model_dump(), **await new_patient_envelope(principal)})
    await audit().record(AuditEventType.ADMIN_ACTION, AuditOutcome.SUCCESS, principal=principal, action=Action.PATIENT_CREATE, resource_type="patient", resource_id=patient.id)
    return patient


@router.put("/patients/{id}", response_model=PatientSummary)
async def update_patient(id: str, input: PatientUpdate, principal: Principal = Depends(require_access(Action.PATIENT_UPDATE))):
    query = scoped(principal, Action.PATIENT_UPDATE, {"id": id})
    doc = await db.patients.find_one(query)
    if not doc:
        await deny(principal, Action.PATIENT_UPDATE, "patient not found or not visible", 404, id, "patient not found")
    updates = {f: getattr(input, f) for f in ("name", "age", "sex", "community", "phone") if getattr(input, f) is not None}
    if updates:
        await db.patients.update_one(query, {"$set": updates})
        doc.update(updates)
        await audit().record(AuditEventType.SCREENING_UPDATE, AuditOutcome.SUCCESS, principal=principal, action=Action.PATIENT_UPDATE, resource_type="patient", resource_id=id, metadata={"fields_changed": len(updates)})
    return _summary(_norm_patient(doc), await _scoped_screenings(principal, {"patient_id": id}, 500))


@router.get("/patients/{id}", response_model=PatientDetail)
async def get_patient(id: str, principal: Principal = Depends(require_access(Action.PATIENT_READ))):
    doc = await db.patients.find_one(scoped(principal, Action.PATIENT_READ, {"id": id}))
    if not doc:
        await deny(principal, Action.PATIENT_READ, "patient not found or not visible", 404, id, "patient not found")
    await audit().record(AuditEventType.PATIENT_ACCESS, AuditOutcome.ALLOW, principal=principal, action=Action.PATIENT_READ, resource_type="patient", resource_id=id)
    raw = await _scoped_screenings(principal, {"patient_id": id}, 500)
    screenings = [Screening(**{**s, "created_at": as_aware(s["created_at"])}) for s in raw]
    summary = _summary(_norm_patient(doc), raw)
    return PatientDetail(**summary.model_dump(), screenings=screenings)
