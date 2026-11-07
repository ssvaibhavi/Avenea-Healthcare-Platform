"""Isolated API tests for the existing Avenea endpoints.

ISOLATION: these tests never touch the live preview database or the running
uvicorn process. Each test runs the FastAPI app in-process (httpx ASGITransport,
no lifespan) and re-points every router's `db` handle at a fresh, uniquely
named database `avenea_test_<uuid>`, which is dropped afterwards. A guard
refuses to run if that name ever equals the live DB_NAME.
"""

import os
import uuid
from datetime import datetime, timezone

import httpx
import pytest
import pytest_asyncio
from motor.motor_asyncio import AsyncIOMotorClient

import routers.analytics
import routers.patients
import routers.screenings
import security.access
import server
from security.identity import Principal
from security.roles import TenantRole
from lib.dates import today_iso
from models.screenings import Lifestyle, Vitals, compute_risk

LIVE_DB = os.environ["DB_NAME"]
TEST_PREFIX = "avenea_test_"

PATIENT_KEYS = {"id", "name", "age", "sex", "community", "phone", "created_at", "seeded_demo"}
SUMMARY_KEYS = PATIENT_KEYS | {"screening_count", "last_screening_at", "risk_level", "referral_status"}
SCREENING_KEYS = {
    "id", "patient_id", "patient_name", "patient_age", "patient_sex", "community", "vitals",
    "lifestyle", "symptoms", "notes", "flags", "risk_score", "risk_level", "referral_status",
    "referral_note", "coordinator", "referral_due_date", "created_at", "seeded_demo",
}

HIGH_RISK = {
    "vitals": {"systolic": 170, "diastolic": 104, "pulse": 96, "glucose": 210},
    "lifestyle": {"smoker": True, "alcohol": False, "activity": "low"},
    "symptoms": ["chest_pain"],
    "notes": "synthetic test record",
}
LOW_RISK = {
    "vitals": {"systolic": 116, "diastolic": 76, "pulse": 72, "glucose": 90},
    "lifestyle": {"smoker": False, "alcohol": False, "activity": "active"},
    "symptoms": [],
}


@pytest_asyncio.fixture
async def test_db(monkeypatch):
    name = f"{TEST_PREFIX}{uuid.uuid4().hex[:12]}"
    assert name != LIVE_DB and name.startswith(TEST_PREFIX), "refusing to use the live database"
    mclient = AsyncIOMotorClient(os.environ["MONGO_URL"])
    tdb = mclient[name]
    for module in (routers.patients, routers.screenings, routers.analytics, server, security.access):
        monkeypatch.setattr(module, "db", tdb)
    # Authenticate as a synthetic nurse in an isolated test org (test-only dependency override).
    nurse = Principal(user_id="test-nurse", org_id="org-test", tenant_role=TenantRole.NURSE)
    server.app.dependency_overrides[security.access.current_principal] = lambda: nurse
    try:
        yield tdb
    finally:
        server.app.dependency_overrides.pop(security.access.current_principal, None)
        if tdb.name.startswith(TEST_PREFIX) and tdb.name != LIVE_DB:
            await mclient.drop_database(tdb.name)
        mclient.close()


@pytest_asyncio.fixture
async def api(test_db):
    transport = httpx.ASGITransport(app=server.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test/api") as c:
        yield c


async def make_patient(api, **overrides):
    body = {"name": "Test Person", "age": 50, "sex": "female", "community": "Testville", "phone": "+00 000"}
    body.update(overrides)
    r = await api.post("/patients", json=body)
    assert r.status_code == 201, r.text
    return r.json()


async def make_screening(api, payload):
    r = await api.post("/screenings", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


# --- isolation guard --------------------------------------------------------


async def test_routers_are_pointed_at_isolated_database(test_db):
    for module in (routers.patients, routers.screenings, routers.analytics):
        assert module.db.name.startswith(TEST_PREFIX)
        assert module.db.name != LIVE_DB


# --- patients ---------------------------------------------------------------


async def test_create_and_list_patient(api):
    p = await make_patient(api)
    assert set(p) == PATIENT_KEYS
    assert p["seeded_demo"] is False
    r = await api.get("/patients")
    assert r.status_code == 200
    [summary] = r.json()
    assert set(summary) == SUMMARY_KEYS
    assert summary["id"] == p["id"]
    assert (summary["screening_count"], summary["last_screening_at"]) == (0, None)
    assert (summary["risk_level"], summary["referral_status"]) == (None, None)


async def test_patient_list_has_no_mongo_id_leak(api):
    await make_patient(api)
    r = await api.get("/patients")
    assert "_id" not in r.json()[0]


async def test_get_patient_detail(api):
    p = await make_patient(api)
    r = await api.get(f"/patients/{p['id']}")
    assert r.status_code == 200
    detail = r.json()
    assert set(detail) == SUMMARY_KEYS | {"screenings"}
    assert detail["screenings"] == []


async def test_get_unknown_patient_404(api):
    r = await api.get("/patients/does-not-exist")
    assert r.status_code == 404
    assert r.json()["detail"] == "patient not found"


@pytest.mark.parametrize(
    "body",
    [{"age": 40}, {"name": "A"}, {"name": "A", "age": -1}, {"name": "A", "age": 121}, {"name": "", "age": 30}],
)
async def test_create_patient_invalid_422(api, body):
    r = await api.post("/patients", json=body)
    assert r.status_code == 422
    assert "detail" in r.json()


async def test_update_patient_partial(api):
    p = await make_patient(api)
    r = await api.put(f"/patients/{p['id']}", json={"community": "Newtown", "phone": "+11"})
    assert r.status_code == 200
    updated = r.json()
    assert set(updated) == SUMMARY_KEYS
    assert (updated["community"], updated["phone"]) == ("Newtown", "+11")
    assert (updated["name"], updated["age"]) == (p["name"], p["age"])


async def test_update_patient_empty_body_is_noop(api):
    p = await make_patient(api)
    r = await api.put(f"/patients/{p['id']}", json={})
    assert r.status_code == 200
    assert r.json()["name"] == p["name"]


async def test_update_unknown_patient_404(api):
    r = await api.put("/patients/nope", json={"age": 30})
    assert r.status_code == 404


async def test_update_patient_invalid_422(api):
    p = await make_patient(api)
    r = await api.put(f"/patients/{p['id']}", json={"age": 500})
    assert r.status_code == 422


# --- screenings -------------------------------------------------------------


async def test_screening_with_inline_new_patient(api):
    s = await make_screening(api, {"new_patient_name": "Inline Person", "age": 63, "sex": "male", **HIGH_RISK})
    assert set(s) == SCREENING_KEYS
    expected = compute_risk(
        Vitals(**HIGH_RISK["vitals"]), Lifestyle(**HIGH_RISK["lifestyle"]), HIGH_RISK["symptoms"], 63
    )
    assert (s["risk_score"], s["risk_level"], s["flags"]) == (expected[0], expected[1], expected[2])
    assert s["risk_level"] == "high" and s["referral_status"] == "pending"
    assert (s["coordinator"], s["referral_due_date"], s["referral_note"]) == ("", None, "")
    patients = (await api.get("/patients")).json()
    assert [p["name"] for p in patients] == ["Inline Person"]
    assert patients[0]["screening_count"] == 1


async def test_low_risk_screening_has_no_referral(api):
    p = await make_patient(api, age=30)
    s = await make_screening(api, {"patient_id": p["id"], **LOW_RISK})
    assert (s["risk_level"], s["referral_status"]) == ("low", "none")


async def test_moderate_risk_screening_opens_pending_referral(api):
    p = await make_patient(api, age=60)
    payload = {"patient_id": p["id"], "vitals": {"systolic": 145, "diastolic": 85}, "lifestyle": {"activity": "moderate"}}
    s = await make_screening(api, payload)
    assert (s["risk_score"], s["risk_level"], s["referral_status"]) == (4, "moderate", "pending")


async def test_existing_patient_screening_updates_demographics(api):
    p = await make_patient(api, age=40, community="Old")
    s = await make_screening(api, {"patient_id": p["id"], "age": 61, "community": "New", **LOW_RISK})
    assert (s["patient_age"], s["community"]) == (61, "New")
    detail = (await api.get(f"/patients/{p['id']}")).json()
    assert (detail["age"], detail["community"]) == (61, "New")


async def test_screening_new_patient_without_age_422(api):
    r = await api.post("/screenings", json={"new_patient_name": "No Age", **LOW_RISK})
    assert r.status_code == 422
    assert r.json()["detail"] == "age is required when creating a new patient"


async def test_screening_without_patient_selector_422(api):
    r = await api.post("/screenings", json=LOW_RISK)
    assert r.status_code == 422


async def test_screening_unknown_patient_404(api):
    r = await api.post("/screenings", json={"patient_id": "nope", **LOW_RISK})
    assert r.status_code == 404


@pytest.mark.parametrize(
    "bad",
    [
        {"vitals": {"systolic": 10}},
        {"lifestyle": {"activity": "sedentary"}},
        {"symptoms": "fever"},
        {"notes": "x" * 2001},
    ],
)
async def test_screening_malformed_422(api, bad):
    p = await make_patient(api)
    r = await api.post("/screenings", json={"patient_id": p["id"], **bad})
    assert r.status_code == 422


async def test_list_screenings_filters_and_order(api):
    a = await make_patient(api, name="A", age=30)
    b = await make_patient(api, name="B", age=63)
    low = await make_screening(api, {"patient_id": a["id"], **LOW_RISK})
    high = await make_screening(api, {"patient_id": b["id"], **HIGH_RISK})

    all_ = (await api.get("/screenings")).json()
    assert [s["id"] for s in all_] == [high["id"], low["id"]]  # newest first
    assert [s["id"] for s in (await api.get("/screenings?risk=high")).json()] == [high["id"]]
    assert [s["id"] for s in (await api.get("/screenings?referral=none")).json()] == [low["id"]]
    assert [s["id"] for s in (await api.get(f"/screenings?patient_id={a['id']}")).json()] == [low["id"]]


@pytest.mark.parametrize("limit", [0, 501])
async def test_list_screenings_limit_bounds_422(api, limit):
    r = await api.get(f"/screenings?limit={limit}")
    assert r.status_code == 422


async def test_patient_summary_reflects_latest_screening(api):
    p = await make_patient(api, age=63)
    await make_screening(api, {"patient_id": p["id"], **LOW_RISK})
    latest = await make_screening(api, {"patient_id": p["id"], **HIGH_RISK})
    [summary] = (await api.get("/patients")).json()
    assert summary["screening_count"] == 2
    assert (summary["risk_level"], summary["referral_status"]) == ("high", "pending")
    assert summary["last_screening_at"].startswith(latest["created_at"][:19])
    detail = (await api.get(f"/patients/{p['id']}")).json()
    assert [s["id"] for s in detail["screenings"]][0] == latest["id"]


# --- referrals --------------------------------------------------------------


async def test_referral_update_full(api):
    s = await make_screening(api, {"new_patient_name": "Ref", "age": 63, **HIGH_RISK})
    body = {"referral_status": "scheduled", "referral_note": "clinic booked", "coordinator": "Test CHW", "referral_due_date": "2026-12-01"}
    r = await api.patch(f"/screenings/{s['id']}/referral", json=body)
    assert r.status_code == 200
    out = r.json()
    assert set(out) == SCREENING_KEYS
    assert (out["referral_status"], out["referral_note"], out["coordinator"], out["referral_due_date"]) == (
        "scheduled", "clinic booked", "Test CHW", "2026-12-01",
    )


async def test_referral_update_omitted_fields_are_preserved(api):
    s = await make_screening(api, {"new_patient_name": "Ref", "age": 63, **HIGH_RISK})
    await api.patch(f"/screenings/{s['id']}/referral", json={"referral_status": "pending", "referral_note": "keep me", "coordinator": "C"})
    r = await api.patch(f"/screenings/{s['id']}/referral", json={"referral_status": "completed"})
    out = r.json()
    assert (out["referral_status"], out["referral_note"], out["coordinator"]) == ("completed", "keep me", "C")


async def test_referral_any_transition_allowed(api):
    # current behaviour: no state machine, e.g. completed -> none is accepted
    s = await make_screening(api, {"new_patient_name": "Ref", "age": 63, **HIGH_RISK})
    await api.patch(f"/screenings/{s['id']}/referral", json={"referral_status": "completed"})
    r = await api.patch(f"/screenings/{s['id']}/referral", json={"referral_status": "none"})
    assert r.status_code == 200 and r.json()["referral_status"] == "none"


async def test_referral_unknown_screening_404(api):
    r = await api.patch("/screenings/nope/referral", json={"referral_status": "pending"})
    assert r.status_code == 404


@pytest.mark.parametrize(
    "body",
    [{"referral_status": "done"}, {"referral_status": "pending", "referral_due_date": "tomorrow"}, {}],
)
async def test_referral_invalid_422(api, body):
    s = await make_screening(api, {"new_patient_name": "Ref", "age": 63, **HIGH_RISK})
    r = await api.patch(f"/screenings/{s['id']}/referral", json=body)
    assert r.status_code == 422


# --- analytics --------------------------------------------------------------


async def test_analytics_empty_database(api):
    r = await api.get("/analytics/summary")
    assert r.status_code == 200
    a = r.json()
    assert set(a) == {"totals", "risk_distribution", "referral_pipeline", "screenings_by_day", "top_symptoms", "avg_age", "today", "demo"}
    assert a["totals"] == {"patients": 0, "screenings": 0, "open_referrals": 0, "communities": 0}
    assert [x["level"] for x in a["risk_distribution"]] == ["low", "moderate", "high"]
    assert [x["status"] for x in a["referral_pipeline"]] == ["pending", "scheduled", "completed"]
    assert len(a["screenings_by_day"]) == 14 and all(d["count"] == 0 for d in a["screenings_by_day"])
    assert (a["top_symptoms"], a["avg_age"], a["demo"]) == ([], 0.0, True)
    assert a["today"] == today_iso()


async def test_analytics_consistency_with_records(api):
    p1 = await make_patient(api, age=30, community="North")
    p2 = await make_patient(api, age=60, community="South")
    await make_patient(api, age=45, community="")
    await make_screening(api, {"patient_id": p1["id"], **LOW_RISK})
    high = await make_screening(api, {"patient_id": p2["id"], **HIGH_RISK})
    await api.patch(f"/screenings/{high['id']}/referral", json={"referral_status": "scheduled"})

    a = (await api.get("/analytics/summary")).json()
    assert a["totals"] == {"patients": 3, "screenings": 2, "open_referrals": 1, "communities": 2}
    assert {x["level"]: x["count"] for x in a["risk_distribution"]} == {"low": 1, "moderate": 0, "high": 1}
    assert sum(x["count"] for x in a["risk_distribution"]) == a["totals"]["screenings"]
    assert {x["status"]: x["count"] for x in a["referral_pipeline"]} == {"pending": 0, "scheduled": 1, "completed": 0}
    assert a["top_symptoms"] == [{"symptom": "Chest pain", "count": 1}]
    assert a["avg_age"] == 45.0
    today = datetime.now(timezone.utc).date().isoformat()
    assert {d["date"]: d["count"] for d in a["screenings_by_day"]}[today] == 2
