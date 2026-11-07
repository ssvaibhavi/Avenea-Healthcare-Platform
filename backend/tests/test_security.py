"""Security foundation tests: synthetic identities, in-memory stores, isolated DB only.

These test the INACTIVE `security` package. The live preview DB and running
server are never touched; a guard test also proves existing routes are still
unauthenticated (i.e. nothing was activated).
"""

import os
import pathlib
import secrets
import time
import uuid

import httpx
import jwt
import pytest
import pytest_asyncio
from fastapi import Depends, FastAPI, Request
from motor.motor_asyncio import AsyncIOMotorClient

import lib.db  # noqa: F401  loads backend/.env (MONGO_URL/DB_NAME) so this module also runs standalone

from security.audit import (
    AuditEvent,
    AuditEventType,
    AuditLogger,
    AuditOutcome,
    MemoryAuditSink,
    MongoAuditSink,
    sanitize_metadata,
)
from security.config import SecuritySettings, load_settings
from security.dependencies import authorize_resource, configure_security, require
from security.errors import (
    AuthNotConfigured,
    Denial,
    ExpiredCredentials,
    InvalidCredentials,
    PermissionDenied,
    SecurityError,
    security_exception_handler,
)
from security.identity import Membership, MemoryIdentityStore, Principal, UserIdentity
from security.passwords import hash_password, verify_password
from security.policy import ScopedCollection, _matches, authorize, project_patient, visibility_predicate
from security.roles import TENANT_PERMISSIONS, Action, PlatformRole, TenantRole, can_grant
from security.tokens import issue_access_token, verify_access_token

A = Action
R = TenantRole
SECRET = secrets.token_urlsafe(48)  # synthetic, generated per test run
SETTINGS = SecuritySettings(jwt_secret=SECRET)
ORG_A, ORG_B = "org-a", "org-b"


def principal(role: TenantRole | None, org: str | None = ORG_A, uid: str = "u1", platform: PlatformRole | None = None):
    return Principal(user_id=uid, org_id=org if role else None, tenant_role=role, platform_role=platform)


def patient_doc(**kw):
    base = {"id": "p1", "name": "Synthetic Person", "age": 40, "community": "Testville", "phone": "+00",
            "org_id": ORG_A, "assigned_worker_ids": ["chw1"], "care_team_ids": ["nurse1"],
            "referral_coordinator_ids": ["coord1"]}
    base.update(kw)
    return base


# --- configuration ----------------------------------------------------------


def test_settings_require_secret():
    with pytest.raises(AuthNotConfigured):
        load_settings({})


def test_settings_reject_short_secret():
    with pytest.raises(AuthNotConfigured):
        load_settings({"AUTH_JWT_SECRET": "short"})


@pytest.mark.parametrize("env", [{"AUTH_JWT_ALGORITHM": "none"}, {"AUTH_JWT_ALGORITHM": "RS256"}, {"AUTH_ACCESS_TOKEN_TTL_SECONDS": "86400"}])
def test_settings_reject_unsafe_values(env):
    with pytest.raises(AuthNotConfigured):
        load_settings({"AUTH_JWT_SECRET": SECRET, **env})


def test_settings_load_and_hide_secret_in_repr():
    s = load_settings({"AUTH_JWT_SECRET": SECRET})
    assert s.jwt_algorithm == "HS256" and SECRET not in repr(s)


def test_no_secret_configured_in_process_env():
    assert "AUTH_JWT_SECRET" not in os.environ


# --- passwords --------------------------------------------------------------


def test_password_hash_and_verify():
    pw = "correct horse battery"
    hashed = hash_password(pw, rounds=10)
    assert hashed != pw and hashed.startswith("$2")
    assert verify_password(pw, hashed)
    assert not verify_password("wrong password!!", hashed)


@pytest.mark.parametrize("pw", ["short", "x" * 73])
def test_password_length_rules(pw):
    with pytest.raises(ValueError):
        hash_password(pw, rounds=10)


def test_verify_against_malformed_hash_is_false():
    assert verify_password("whatever-password", "not-a-bcrypt-hash") is False


# --- tokens -----------------------------------------------------------------


def test_token_round_trip():
    token = issue_access_token(SETTINGS, user_id="u1", org_id=ORG_A)
    claims = verify_access_token(SETTINGS, token)
    assert (claims.sub, claims.org, claims.typ) == ("u1", ORG_A, "access")


def test_expired_token_rejected():
    token = issue_access_token(SETTINGS, user_id="u1", now=int(time.time()) - 3600, ttl_seconds=60)
    with pytest.raises(ExpiredCredentials):
        verify_access_token(SETTINGS, token)


@pytest.mark.parametrize(
    "settings",
    [
        SecuritySettings(jwt_secret=secrets.token_urlsafe(48)),
        SecuritySettings(jwt_secret=SECRET, audience="other"),
        SecuritySettings(jwt_secret=SECRET, issuer="other"),
    ],
)
def test_token_wrong_key_audience_or_issuer_rejected(settings):
    token = issue_access_token(SETTINGS, user_id="u1")
    with pytest.raises(InvalidCredentials):
        verify_access_token(settings, token)


def test_alg_none_token_rejected():
    now = int(time.time())
    claims = {"sub": "u1", "iat": now, "nbf": now, "exp": now + 60, "iss": "avenea-api", "aud": "avenea", "jti": "x", "typ": "access"}
    token = jwt.encode(claims, key="", algorithm="none")
    with pytest.raises(InvalidCredentials):
        verify_access_token(SETTINGS, token)


def test_token_missing_required_claim_rejected():
    now = int(time.time())
    token = jwt.encode({"sub": "u1", "exp": now + 60, "iss": "avenea-api", "aud": "avenea", "typ": "access"}, SECRET, algorithm="HS256")
    with pytest.raises(InvalidCredentials):
        verify_access_token(SETTINGS, token)


def test_tampered_and_wrong_type_tokens_rejected():
    token = issue_access_token(SETTINGS, user_id="u1")
    head, body, sig = token.split(".")
    with pytest.raises(InvalidCredentials):
        verify_access_token(SETTINGS, f"{head}.{body}.{sig[::-1]}")
    now = int(time.time())
    refresh = jwt.encode(
        {"sub": "u1", "iat": now, "nbf": now, "exp": now + 60, "iss": "avenea-api", "aud": "avenea", "jti": "j", "typ": "refresh"},
        SECRET, algorithm="HS256",
    )
    with pytest.raises(InvalidCredentials):
        verify_access_token(SETTINGS, refresh)


# --- role permissions (layer 1) ----------------------------------------------

ALL_TENANT_ACTIONS = [a for a in Action if not a.value.startswith("platform:")]


@pytest.mark.parametrize("role", list(TenantRole))
@pytest.mark.parametrize("action", ALL_TENANT_ACTIONS)
def test_role_permission_matrix(role, action):
    decision = authorize(principal(role), action)
    assert decision.allowed == (action in TENANT_PERMISSIONS[role])
    if not decision.allowed:
        assert decision.denial == Denial.FORBIDDEN


@pytest.mark.parametrize("action", ALL_TENANT_ACTIONS)
def test_system_admin_has_no_tenant_or_clinical_access(action):
    sysadmin = Principal(user_id="sa", platform_role=PlatformRole.SYSTEM_ADMIN)
    assert authorize(sysadmin, action).denial == Denial.FORBIDDEN
    assert authorize(sysadmin, A.PATIENT_READ, patient_doc()).allowed is False


def test_system_admin_platform_actions_and_tenant_roles_cannot_use_them():
    sysadmin = Principal(user_id="sa", platform_role=PlatformRole.SYSTEM_ADMIN)
    assert authorize(sysadmin, A.PLATFORM_HEALTH_READ).allowed
    assert authorize(principal(R.ORGANIZATION_ADMIN), A.PLATFORM_ORGS_MANAGE).denial == Denial.FORBIDDEN


def test_org_admin_cannot_read_individual_clinical_records():
    assert authorize(principal(R.ORGANIZATION_ADMIN), A.PATIENT_READ, patient_doc()).denial == Denial.FORBIDDEN
    assert authorize(principal(R.ORGANIZATION_ADMIN), A.ANALYTICS_READ).allowed


def test_principal_without_membership_denied():
    assert authorize(Principal(user_id="u"), A.PATIENT_READ).denial == Denial.FORBIDDEN


def test_role_grants():
    assert can_grant(R.ORGANIZATION_ADMIN, R.PHYSICIAN)
    assert not can_grant(R.PHYSICIAN, R.NURSE)
    assert not can_grant(None, R.COMMUNITY_HEALTH_WORKER)


# --- org + relationship scoping (layers 2 & 3) ------------------------------


def test_chw_sees_only_assigned_patients():
    assert authorize(principal(R.COMMUNITY_HEALTH_WORKER, uid="chw1"), A.PATIENT_READ, patient_doc()).allowed
    other = authorize(principal(R.COMMUNITY_HEALTH_WORKER, uid="chw2"), A.PATIENT_READ, patient_doc())
    assert other.denial == Denial.NOT_VISIBLE


def test_clinicians_scoped_by_care_team():
    assert authorize(principal(R.NURSE, uid="nurse1"), A.SCREENING_READ, patient_doc()).allowed
    assert authorize(principal(R.PHYSICIAN, uid="doc9"), A.PATIENT_READ, patient_doc()).denial == Denial.NOT_VISIBLE
    assert authorize(principal(R.PHYSICIAN, uid="doc9"), A.PATIENT_READ, patient_doc(care_team_ids=["doc9"])).allowed


def test_coordinator_scoped_to_assigned_referrals():
    referral = {"id": "s1", "org_id": ORG_A, "coordinator_user_id": "coord1"}
    assert authorize(principal(R.CARE_COORDINATOR, uid="coord1"), A.REFERRAL_UPDATE, referral).allowed
    assert authorize(principal(R.CARE_COORDINATOR, uid="coord2"), A.REFERRAL_UPDATE, referral).denial == Denial.NOT_VISIBLE
    assert authorize(principal(R.CARE_COORDINATOR, uid="coord1"), A.SCREENING_CREATE).denial == Denial.FORBIDDEN


@pytest.mark.parametrize("role,uid", [(R.COMMUNITY_HEALTH_WORKER, "chw1"), (R.NURSE, "nurse1"), (R.CARE_COORDINATOR, "coord1")])
def test_cross_organisation_access_is_not_visible(role, uid):
    p = principal(role, org=ORG_B, uid=uid)
    assert authorize(p, A.PATIENT_READ, patient_doc()).denial == Denial.NOT_VISIBLE


def test_visibility_predicates():
    assert visibility_predicate(principal(R.COMMUNITY_HEALTH_WORKER, uid="c"), A.PATIENT_READ) == {"org_id": ORG_A, "assigned_worker_ids": "c"}
    assert visibility_predicate(principal(R.NURSE, uid="n"), A.SCREENING_READ) == {"org_id": ORG_A, "care_team_ids": "n"}
    assert visibility_predicate(principal(R.CARE_COORDINATOR, uid="k"), A.REFERRAL_READ) == {"org_id": ORG_A, "coordinator_user_id": "k"}
    assert visibility_predicate(principal(R.ORGANIZATION_ADMIN), A.ANALYTICS_READ) == {"org_id": ORG_A}
    with pytest.raises(PermissionDenied):
        visibility_predicate(principal(R.ORGANIZATION_ADMIN), A.PATIENT_READ)


def test_coordinator_patient_projection_is_contact_only():
    out = project_patient(principal(R.CARE_COORDINATOR, uid="coord1"), {**patient_doc(), "notes": "x", "vitals": {}})
    assert set(out) == {"id", "name", "community", "phone"}


def test_clinician_projection_strips_internal_envelope():
    out = project_patient(principal(R.NURSE, uid="nurse1"), patient_doc())
    assert "org_id" not in out and "care_team_ids" not in out and out["age"] == 40


def test_service_principal_limited_to_scopes():
    svc = Principal(user_id="svc", principal_type="service", org_id=ORG_A, scopes=frozenset({A.ANALYTICS_READ}))
    assert authorize(svc, A.ANALYTICS_READ).allowed
    assert authorize(svc, A.PATIENT_READ).denial == Denial.FORBIDDEN


# --- audit ------------------------------------------------------------------


def test_sanitize_metadata_drops_sensitive_and_nested():
    meta = {"password": "p", "access_token": "t", "Authorization": "Bearer x", "patient_name": "n", "phone": "1",
            "systolic": 150, "notes": "n", "body": {"a": 1}, "route": "/patients/{id}", "status_code": 200, "ok": True}
    assert sanitize_metadata(meta) == {"route": "/patients/{id}", "status_code": 200, "ok": True}


def test_audit_event_rejects_unknown_fields():
    with pytest.raises(Exception):
        AuditEvent(event_type=AuditEventType.AUTH_SUCCESS, outcome=AuditOutcome.SUCCESS, password="x")


async def test_audit_logger_records_structured_event():
    sink = MemoryAuditSink()
    p = principal(R.NURSE, uid="nurse1")
    event = await AuditLogger(sink).record(
        AuditEventType.REFERRAL_UPDATE, AuditOutcome.SUCCESS, principal=p, action=A.REFERRAL_UPDATE,
        resource_type="referral", resource_id="s1", metadata={"new_status": "scheduled", "referral_note": "secret"},
    )
    assert sink.events == [event]
    assert (event.actor_user_id, event.actor_role, event.org_id) == ("nurse1", "nurse", ORG_A)
    assert event.metadata == {"new_status": "scheduled"} and event.timestamp.tzinfo is not None


async def test_audit_sink_failure_is_contained_unless_strict():
    class Broken:
        async def write(self, event):
            raise RuntimeError("sink down")

    await AuditLogger(Broken()).record(AuditEventType.ADMIN_ACTION, AuditOutcome.SUCCESS)
    with pytest.raises(RuntimeError):
        await AuditLogger(Broken(), strict=True).record(AuditEventType.ADMIN_ACTION, AuditOutcome.SUCCESS)


# --- HTTP integration on a throwaway app (never server.app) ------------------


def build_app(store, sink, records):
    app = FastAPI()
    app.add_exception_handler(SecurityError, security_exception_handler)
    configure_security(app, identity_store=store, audit=AuditLogger(sink), settings=SETTINGS)

    @app.get("/patients/{pid}")
    async def read_patient(pid: str, request: Request, p: Principal = Depends(require(A.PATIENT_READ))):
        doc = records.get(pid)
        visible = doc if doc and _matches(doc, visibility_predicate(p, A.PATIENT_READ)) else None
        await authorize_resource(request, p, A.PATIENT_READ, visible, resource_type="patient", resource_id=pid)
        return project_patient(p, visible)

    @app.get("/analytics")
    async def analytics(p: Principal = Depends(require(A.ANALYTICS_READ))):
        return {"org_id": p.org_id}

    @app.get("/platform/health")
    async def health(p: Principal = Depends(require(A.PLATFORM_HEALTH_READ))):
        return {"ok": True}

    return app


@pytest.fixture
def identities():
    store = MemoryIdentityStore()
    for uid, role, org in [("chw1", R.COMMUNITY_HEALTH_WORKER, ORG_A), ("chw2", R.COMMUNITY_HEALTH_WORKER, ORG_A),
                           ("nurseB", R.NURSE, ORG_B), ("admin1", R.ORGANIZATION_ADMIN, ORG_A), ("coord1", R.CARE_COORDINATOR, ORG_A)]:
        store.add_user(UserIdentity(id=uid, email=f"{uid}@example.test"))
        store.add_membership(Membership(user_id=uid, org_id=org, role=role))
    store.add_user(UserIdentity(id="sa", email="sa@example.test", platform_role=PlatformRole.SYSTEM_ADMIN))
    store.add_user(UserIdentity(id="gone", email="gone@example.test", status="disabled"))
    store.add_membership(Membership(user_id="gone", org_id=ORG_A, role=R.NURSE))
    return store


@pytest_asyncio.fixture
async def http(identities):
    sink = MemoryAuditSink()
    app = build_app(identities, sink, {"p1": patient_doc(), "pB": patient_doc(id="pB", org_id=ORG_B, care_team_ids=["nurseB"])})
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
        c.sink = sink
        c.store = identities
        yield c


def bearer(uid, org=ORG_A, **kw):
    return {"Authorization": f"Bearer {issue_access_token(SETTINGS, user_id=uid, org_id=org, **kw)}"}


async def test_valid_authentication_and_assigned_access(http):
    r = await http.get("/patients/p1", headers=bearer("chw1"))
    assert r.status_code == 200 and r.json()["id"] == "p1" and "org_id" not in r.json()
    kinds = [e.event_type for e in http.sink.events]
    assert kinds == [AuditEventType.AUTH_SUCCESS, AuditEventType.PATIENT_ACCESS]


async def test_missing_authentication_401(http):
    r = await http.get("/patients/p1")
    assert r.status_code == 401 and r.headers["www-authenticate"] == "Bearer"
    assert r.json() == {"detail": "Authentication required"}
    assert http.sink.events[-1].event_type == AuditEventType.AUTH_FAILURE


@pytest.mark.parametrize("header", ["Bearer not-a-jwt", "Basic dXNlcjpwYXNz"])
async def test_invalid_credentials_401(http, header):
    r = await http.get("/patients/p1", headers={"Authorization": header})
    assert r.status_code == 401


async def test_expired_credentials_401_with_generic_message(http):
    r = await http.get("/patients/p1", headers=bearer("chw1", now=int(time.time()) - 3600, ttl_seconds=60))
    assert r.status_code == 401 and r.json() == {"detail": "Invalid or expired credentials"}


async def test_disabled_or_unknown_user_401(http):
    assert (await http.get("/patients/p1", headers=bearer("gone"))).status_code == 401
    assert (await http.get("/patients/p1", headers=bearer("ghost"))).status_code == 401


async def test_wrong_role_403_and_denial_audited(http):
    r = await http.get("/patients/p1", headers=bearer("admin1"))
    assert r.status_code == 403
    last = http.sink.events[-1]
    assert (last.event_type, last.outcome, last.actor_user_id) == (AuditEventType.ACCESS_DENIED, AuditOutcome.DENY, "admin1")


async def test_unassigned_record_404(http):
    r = await http.get("/patients/p1", headers=bearer("chw2"))
    assert r.status_code == 404 and r.json() == {"detail": "Not found"}


async def test_cross_org_record_404(http):
    assert (await http.get("/patients/p1", headers=bearer("nurseB", org=ORG_B))).status_code == 404
    assert (await http.get("/patients/pB", headers=bearer("chw1"))).status_code == 404


async def test_user_supplied_org_id_is_ignored(http):
    r = await http.get("/patients/pB?org_id=org-b", headers={**bearer("chw1"), "X-Org-Id": ORG_B})
    assert r.status_code == 404


async def test_token_for_org_without_membership_401(http):
    assert (await http.get("/analytics", headers=bearer("chw1", org=ORG_B))).status_code == 401


async def test_revoked_membership_denied_on_next_request(http):
    headers = bearer("admin1")
    assert (await http.get("/analytics", headers=headers)).status_code == 200
    http.store.add_membership(Membership(user_id="admin1", org_id=ORG_A, role=R.ORGANIZATION_ADMIN, status="revoked"))
    assert (await http.get("/analytics", headers=headers)).status_code == 401


async def test_system_admin_platform_only(http):
    assert (await http.get("/platform/health", headers=bearer("sa", org=None))).status_code == 200
    assert (await http.get("/patients/p1", headers=bearer("sa", org=None))).status_code == 403
    assert (await http.get("/platform/health", headers=bearer("admin1"))).status_code == 403


async def test_coordinator_sees_contact_fields_only(http):
    r = await http.get("/patients/p1", headers=bearer("coord1"))
    assert r.status_code == 200 and set(r.json()) == {"id", "name", "community", "phone"}


async def test_audit_events_never_contain_tokens_or_clinical_data(http):
    token_header = bearer("chw1")
    await http.get("/patients/p1", headers=token_header)
    await http.get("/patients/p1", headers=bearer("chw2"))
    await http.get("/patients/p1", headers={"Authorization": "Bearer junk.junk.junk"})
    dumped = " ".join(e.model_dump_json() for e in http.sink.events)
    token = token_header["Authorization"].split()[1]
    for forbidden in (token, "junk.junk.junk", "Synthetic Person", "+00", "Testville", SECRET):
        assert forbidden not in dumped


async def test_unconfigured_app_fails_closed_503():
    app = FastAPI()
    app.add_exception_handler(SecurityError, security_exception_handler)

    @app.get("/x")
    async def x(p: Principal = Depends(require(A.PATIENT_READ))):
        return {}

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
        r = await c.get("/x", headers=bearer("chw1"))
    assert r.status_code == 503


# --- ScopedCollection against an isolated Mongo test DB ---------------------


@pytest_asyncio.fixture
async def iso_db():
    name = f"avenea_test_{uuid.uuid4().hex[:12]}"
    assert name != os.environ["DB_NAME"]
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[name]
    try:
        yield db
    finally:
        if db.name.startswith("avenea_test_") and db.name != os.environ["DB_NAME"]:
            await client.drop_database(db.name)
        client.close()


async def seed_patients(db):
    await db.patients.insert_many([
        patient_doc(id="a1"), patient_doc(id="a2", assigned_worker_ids=["chw2"]),
        patient_doc(id="b1", org_id=ORG_B), patient_doc(id="a3", assigned_worker_ids=["chw1", "chw2"]),
    ])


async def test_scoped_find_returns_only_in_scope_rows(iso_db):
    await seed_patients(iso_db)
    repo = ScopedCollection(iso_db.patients, principal(R.COMMUNITY_HEALTH_WORKER, uid="chw1"), A.PATIENT_READ)
    assert sorted(d["id"] for d in await repo.find()) == ["a1", "a3"]
    assert await repo.count() == 2
    assert await repo.find_one({"id": "b1"}) is None
    assert await repo.find_one({"id": "a2"}) is None


async def test_client_filter_cannot_widen_scope(iso_db):
    await seed_patients(iso_db)
    repo = ScopedCollection(iso_db.patients, principal(R.COMMUNITY_HEALTH_WORKER, uid="chw1"), A.PATIENT_READ)
    assert await repo.find({"org_id": ORG_B}) == []
    assert await repo.find({"$or": [{"id": "b1"}, {"id": "a2"}]}) == []


async def test_scoped_insert_stamps_server_fields(iso_db):
    repo = ScopedCollection(iso_db.patients, principal(R.COMMUNITY_HEALTH_WORKER, uid="chw1"), A.PATIENT_CREATE)
    doc = await repo.insert_one({"id": "n1", "name": "New", "org_id": ORG_B, "assigned_worker_ids": ["attacker"], "role": "admin"})
    stored = await iso_db.patients.find_one({"id": "n1"}, {"_id": 0})
    assert stored == doc
    assert (stored["org_id"], stored["created_by"], stored["assigned_worker_ids"]) == (ORG_A, "chw1", ["chw1"])
    assert "role" not in stored


async def test_scoped_update_rejects_protected_fields_and_out_of_scope(iso_db):
    await seed_patients(iso_db)
    repo = ScopedCollection(iso_db.patients, principal(R.COMMUNITY_HEALTH_WORKER, uid="chw1"), A.PATIENT_UPDATE)
    with pytest.raises(PermissionDenied):
        await repo.update_one({"id": "a1"}, {"org_id": ORG_B})
    assert await repo.update_one({"id": "a1"}, {"community": "Updated"}) is True
    assert await repo.update_one({"id": "b1"}, {"community": "Hacked"}) is False
    assert (await iso_db.patients.find_one({"id": "b1"}))["community"] == "Testville"


async def test_scoped_aggregate_prepends_match_and_blocks_lookup(iso_db):
    await seed_patients(iso_db)
    repo = ScopedCollection(iso_db.patients, principal(R.ORGANIZATION_ADMIN), A.ANALYTICS_READ)
    rows = await repo.aggregate([{"$group": {"_id": "$org_id", "n": {"$sum": 1}}}])
    assert rows == [{"_id": ORG_A, "n": 3}]
    with pytest.raises(PermissionDenied):
        await repo.aggregate([{"$lookup": {"from": "screenings", "localField": "id", "foreignField": "patient_id", "as": "s"}}])


async def test_mongo_audit_sink_is_insert_only_record(iso_db):
    event = await AuditLogger(MongoAuditSink(iso_db)).record(AuditEventType.ADMIN_ACTION, AuditOutcome.SUCCESS, reason="member invited")
    stored = await iso_db.audit_events.find_one({"id": event.id}, {"_id": 0})
    assert stored["event_type"] == "admin.action" and stored["reason"] == "member invited"


# --- guard: nothing was activated on the existing application ----------------


def test_protected_routers_gate_every_handler():
    """Phase 2B activation: every patient/screening/analytics handler (except public stats) is gated."""
    backend = pathlib.Path(__file__).resolve().parents[1]
    for name in ("patients", "screenings", "analytics"):
        src = (backend / "routers" / f"{name}.py").read_text()
        handlers = src.count("@router.")
        gated = src.count("Depends(require_access(") + src.count("Depends(current_principal)")
        assert gated == handlers - (1 if name == "analytics" else 0), name


def test_server_app_has_no_security_context():
    import server

    assert not hasattr(server.app.state, "avenea_security")
