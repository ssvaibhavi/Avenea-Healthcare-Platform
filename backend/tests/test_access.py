"""Security tests for the ACTIVATED routes (isolated `avenea_test_*` DB, synthetic principals).

Identity verification itself is Clerk's (JWKS) and is exercised with real synthetic tokens in the
tier-1 smoke; here `require_user` / `current_principal` are stubbed per test to drive the matrix.
"""

import os
import uuid

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
from security.roles import TenantRole as R

A, B = "org-a", "org-b"


def doc(pid, org, workers=(), team=(), coords=()):
    return {"id": pid, "name": f"Synthetic {pid}", "age": 50, "sex": "female", "community": "T", "phone": "",
            "created_at": "2026-01-01T00:00:00+00:00", "seeded_demo": True, "org_id": org,
            "assigned_worker_ids": list(workers), "care_team_ids": list(team), "referral_coordinator_ids": list(coords)}


def scr(sid, pid, org, workers=(), team=(), coordinator=None, referral="pending"):
    d = {"id": sid, "patient_id": pid, "patient_name": f"Synthetic {pid}", "patient_age": 50, "patient_sex": "female",
         "community": "T", "vitals": {}, "lifestyle": {}, "symptoms": [], "notes": "", "flags": [], "risk_score": 5,
         "risk_level": "moderate", "referral_status": referral, "referral_note": "", "coordinator": "",
         "referral_due_date": None, "created_at": "2026-01-02T00:00:00+00:00", "seeded_demo": True,
         "org_id": org, "assigned_worker_ids": list(workers), "care_team_ids": list(team)}
    if coordinator:
        d["coordinator_user_id"] = coordinator
    return d


@pytest_asyncio.fixture
async def env(monkeypatch):
    name = f"avenea_test_{uuid.uuid4().hex[:12]}"
    assert name != os.environ["DB_NAME"]
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    tdb = client[name]
    for module in (routers.patients, routers.screenings, routers.analytics, server, security.access):
        monkeypatch.setattr(module, "db", tdb)
    from datetime import datetime
    for d in [doc("a1", A, workers=["chw1"], team=["nurse1"], coords=["coord1"]), doc("a2", A, workers=["chw2"]), doc("b1", B, workers=["chw1"], team=["nurse1"])]:
        d["created_at"] = datetime.fromisoformat(d["created_at"])
        await tdb.patients.insert_one(d)
    for s in [scr("s1", "a1", A, ["chw1"], ["nurse1"], "coord1"), scr("s2", "a2", A, ["chw2"]), scr("s3", "b1", B, ["chw1"], ["nurse1"], "coord1")]:
        s["created_at"] = datetime.fromisoformat(s["created_at"])
        await tdb.screenings.insert_one(s)

    def as_user(uid, role, org=A):
        server.app.dependency_overrides[security.access.current_principal] = lambda: Principal(user_id=uid, org_id=org, tenant_role=role)

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url="http://test/api") as c:
        c.as_user, c.db = as_user, tdb
        try:
            yield c
        finally:
            server.app.dependency_overrides.pop(security.access.current_principal, None)
            if tdb.name.startswith("avenea_test_"):
                await client.drop_database(tdb.name)
            client.close()


PROTECTED = [("GET", "/patients"), ("POST", "/patients"), ("GET", "/patients/a1"), ("PUT", "/patients/a1"),
             ("GET", "/screenings"), ("POST", "/screenings"), ("PATCH", "/screenings/s1/referral"), ("GET", "/analytics/summary")]


@pytest.mark.parametrize("method,path", PROTECTED)
async def test_every_protected_route_requires_authentication(env, method, path):
    r = await env.request(method, path, json={} if method != "GET" else None)
    assert r.status_code == 401


async def test_garbage_bearer_token_rejected(env):
    r = await env.get("/patients", headers={"Authorization": "Bearer not.a.token"})
    assert r.status_code == 401


async def test_public_stats_is_aggregate_only(env):
    r = await env.get("/public/stats")
    assert r.status_code == 200 and set(r.json()) == {"totals", "demo"}
    assert set(r.json()["totals"]) == {"patients", "screenings", "open_referrals", "communities"}


async def test_chw_sees_only_assigned_in_own_org(env):
    env.as_user("chw1", R.COMMUNITY_HEALTH_WORKER)
    assert [p["id"] for p in (await env.get("/patients")).json()] == ["a1"]
    assert (await env.get("/patients/a1")).status_code == 200
    assert (await env.get("/patients/a2")).status_code == 404  # same org, not assigned
    assert (await env.get("/patients/b1")).status_code == 404  # other org (assigned there, but not my active org)
    assert (await env.put("/patients/b1", json={"community": "X"})).status_code == 404
    assert [s["id"] for s in (await env.get("/screenings")).json()] == ["s1"]


async def test_user_supplied_org_id_is_ignored(env):
    env.as_user("chw1", R.COMMUNITY_HEALTH_WORKER)
    r = await env.get("/screenings?org_id=org-b&patient_id=b1")
    assert r.status_code == 200 and r.json() == []
    r = await env.post("/patients", json={"name": "N", "age": 30, "org_id": B})
    stored = await env.db.patients.find_one({"id": r.json()["id"]})
    assert stored["org_id"] == A and stored["created_by"] == "chw1" and "chw1" in stored["assigned_worker_ids"]


async def test_unauthorized_referral_change_denied(env):
    env.as_user("chw1", R.COMMUNITY_HEALTH_WORKER)
    assert (await env.patch("/screenings/s1/referral", json={"referral_status": "completed"})).status_code == 403
    env.as_user("coord1", R.CARE_COORDINATOR)
    assert (await env.patch("/screenings/s2/referral", json={"referral_status": "completed"})).status_code == 404
    r = await env.patch("/screenings/s1/referral", json={"referral_status": "scheduled"})
    assert r.status_code == 200 and r.json()["referral_status"] == "scheduled"
    assert (await env.db.screenings.find_one({"id": "s2"}))["referral_status"] == "pending"


async def test_role_permissions(env):
    env.as_user("coord1", R.CARE_COORDINATOR)
    assert (await env.post("/screenings", json={"patient_id": "a1"})).status_code == 403
    assert [s["id"] for s in (await env.get("/screenings")).json()] == ["s1"]
    env.as_user("admin1", R.ORGANIZATION_ADMIN)
    assert (await env.get("/patients")).status_code == 403
    assert (await env.get("/patients/a1")).status_code == 403
    a = (await env.get("/analytics/summary")).json()
    assert a["totals"]["patients"] == 2 and a["totals"]["screenings"] == 2  # org A only
    env.as_user("nurse1", R.NURSE)
    r = await env.post("/screenings", json={"patient_id": "a1", "vitals": {"systolic": 120, "diastolic": 80}})
    assert r.status_code == 201
    stored = await env.db.screenings.find_one({"id": r.json()["id"]})
    assert stored["org_id"] == A and stored["care_team_ids"] == ["nurse1"]


async def test_response_structure_unchanged_for_authorised_reads(env):
    env.as_user("nurse1", R.NURSE)
    p = (await env.get("/patients")).json()[0]
    assert "org_id" not in p and "care_team_ids" not in p and "_id" not in p
    s = (await env.get("/screenings")).json()[0]
    assert "coordinator_user_id" not in s and "org_id" not in s


async def test_audit_events_created(env):
    env.as_user("nurse1", R.NURSE)
    await env.get("/patients/a1")
    await env.patch("/screenings/s1/referral", json={"referral_status": "scheduled", "referral_note": "private note"})
    env.as_user("chw2", R.COMMUNITY_HEALTH_WORKER)
    await env.get("/patients/a1")
    events = await env.db.audit_events.find({}, {"_id": 0}).to_list(50)
    kinds = [(e["event_type"], e["outcome"], e["actor_user_id"]) for e in events]
    assert ("patient.access", "allow", "nurse1") in kinds
    assert ("referral.update", "success", "nurse1") in kinds
    assert ("access.denied", "deny", "chw2") in kinds
    assert "private note" not in str(events) and "Synthetic a1" not in str(events)


async def test_membership_is_source_of_truth(env, monkeypatch):
    monkeypatch.setattr(security.access, "require_user", lambda request: {"user_id": "u-x", "session_id": "s"})
    monkeypatch.setattr(security.access, "_verified_emails", lambda uid: {"someone@example.com"})
    monkeypatch.setenv("ADMIN_EMAIL", "owner@example.com")
    assert (await env.get("/patients")).status_code == 403  # signed in, no membership, not owner
    await env.db.auth_memberships.insert_one({"user_id": "u-x", "org_id": A, "role": "nurse", "status": "active"})
    await env.db.patients.update_one({"id": "a1"}, {"$push": {"care_team_ids": "u-x"}})
    assert (await env.get("/patients")).status_code == 200
    await env.db.auth_memberships.update_one({"user_id": "u-x"}, {"$set": {"status": "revoked"}})
    assert (await env.get("/patients")).status_code == 403  # revoked takes effect on the next request


async def test_owner_bootstrap_requires_verified_admin_email(env, monkeypatch):
    monkeypatch.setattr(security.access, "require_user", lambda request: {"user_id": "u-owner", "session_id": "s"})
    monkeypatch.setattr(security.access, "_verified_emails", lambda uid: {"owner@example.com"})
    monkeypatch.setenv("ADMIN_EMAIL", "owner@example.com")
    assert (await env.get("/analytics/summary")).status_code == 200
    m = await env.db.auth_memberships.find_one({"user_id": "u-owner"})
    assert m["role"] == "organization_admin"
    assert (await env.get("/patients")).status_code == 403  # admin still has no clinical record access
