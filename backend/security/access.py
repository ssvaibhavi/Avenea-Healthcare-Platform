"""ACTIVE access layer: Clerk-verified identity -> Avenea membership -> Principal.

Identity comes only from a Clerk session token verified against Clerk's JWKS
(clerk_auth.require_user). Role and organisation come only from the
`auth_memberships` collection (source of truth, read on every request). Nothing
is taken from the request body, query string, path or headers.
"""

import os

import requests
from fastapi import Depends, HTTPException, Request
from starlette.concurrency import run_in_threadpool

from clerk_auth import _secret_key, require_user
from lib.db import db
from security.audit import AuditEventType, AuditLogger, AuditOutcome, MongoAuditSink
from security.identity import Principal
from security.policy import authorize, visibility_predicate
from security.roles import Action, TenantRole

DEMO_ORG_ID = "org-avenea-demo"
FORBIDDEN_DETAIL = "You do not have permission to perform this action"
NO_ACCESS_DETAIL = "Your account has not been granted access to Avenea"
R = TenantRole


def audit() -> AuditLogger:
    return AuditLogger(MongoAuditSink(db))


def _verified_emails(user_id: str) -> set[str]:
    r = requests.get(
        f"https://api.clerk.com/v1/users/{user_id}", timeout=10,
        headers={"Authorization": f"Bearer {_secret_key()}", "User-Agent": "avenea-backend"},
    )
    r.raise_for_status()
    return {
        e["email_address"].lower()
        for e in r.json().get("email_addresses", [])
        if (e.get("verification") or {}).get("status") == "verified"
    }


async def _bootstrap_owner(user_id: str) -> dict | None:
    """First sign-in of an ADMIN_EMAIL owner (verified email only) -> organisation admin. Nobody else."""
    admins = {e.strip().lower() for e in os.environ.get("ADMIN_EMAIL", "").split(",") if e.strip()}
    if not admins or not admins & await run_in_threadpool(_verified_emails, user_id):
        return None
    membership = {"user_id": user_id, "org_id": DEMO_ORG_ID, "role": R.ORGANIZATION_ADMIN.value, "status": "active"}
    await db.auth_memberships.update_one({"user_id": user_id, "org_id": DEMO_ORG_ID}, {"$setOnInsert": membership}, upsert=True)
    await audit().record(AuditEventType.ADMIN_ACTION, AuditOutcome.SUCCESS, actor_user_id=user_id, reason="owner bootstrap: organisation_admin granted from ADMIN_EMAIL")
    return membership


async def current_principal(request: Request) -> Principal:
    try:
        user = await run_in_threadpool(require_user, request)
    except HTTPException as exc:
        await audit().record(AuditEventType.AUTH_FAILURE, AuditOutcome.FAILURE, reason=str(exc.detail)[:200])
        raise
    uid = user["user_id"]
    membership = await db.auth_memberships.find_one({"user_id": uid, "status": "active"}, {"_id": 0})
    if membership is None:
        membership = await _bootstrap_owner(uid)
    if membership is None:
        await audit().record(AuditEventType.AUTH_FAILURE, AuditOutcome.FAILURE, actor_user_id=uid, reason="no active membership")
        raise HTTPException(status_code=403, detail=NO_ACCESS_DETAIL)
    return Principal(user_id=uid, org_id=membership["org_id"], tenant_role=R(membership["role"]), token_id=user.get("session_id"))


async def deny(principal: Principal, action: Action, reason: str, status: int = 403, resource_id: str | None = None, detail: str = "Not found"):
    await audit().record(AuditEventType.ACCESS_DENIED, AuditOutcome.DENY, principal=principal, action=action, resource_id=resource_id, reason=reason)
    raise HTTPException(status_code=status, detail=FORBIDDEN_DETAIL if status == 403 else detail)


def require_access(action: Action):
    async def dependency(principal: Principal = Depends(current_principal)) -> Principal:
        decision = authorize(principal, action)
        if not decision.allowed:
            await deny(principal, action, decision.reason)
        return principal

    return dependency


def scoped(principal: Principal, action: Action, query: dict | None = None) -> dict:
    """Org + relationship predicate AND the route's own filter (can only narrow)."""
    return {"$and": [visibility_predicate(principal, action), dict(query or {})]}


def screening_read_action(principal: Principal) -> Action:
    return Action.REFERRAL_READ if principal.tenant_role == R.CARE_COORDINATOR else Action.SCREENING_READ


async def new_patient_envelope(principal: Principal) -> dict:
    """Server-stamped ownership: org roster defaults + the creator's own relationship."""
    org = await db.auth_orgs.find_one({"id": principal.org_id}, {"_id": 0}) or {}
    workers = set(org.get("default_worker_ids", []))
    team = set(org.get("default_care_team_ids", []))
    if principal.tenant_role == R.COMMUNITY_HEALTH_WORKER:
        workers.add(principal.user_id)
    elif principal.tenant_role in (R.NURSE, R.PHYSICIAN):
        team.add(principal.user_id)
    return {
        "org_id": principal.org_id, "created_by": principal.user_id,
        "assigned_worker_ids": sorted(workers), "care_team_ids": sorted(team), "referral_coordinator_ids": [],
    }


async def default_coordinator(org_id: str) -> str | None:
    org = await db.auth_orgs.find_one({"id": org_id}, {"_id": 0}) or {}
    return org.get("default_coordinator_id")
