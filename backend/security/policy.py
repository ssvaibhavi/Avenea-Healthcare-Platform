"""Single authorization decision function + data-layer scoping.

`authorize()` is deny-by-default and returns a denial KIND:
FORBIDDEN (role/scope) -> 403, NOT_VISIBLE (org/relationship) -> 404.
Resources handed to it must come from `ScopedCollection` (never a raw fetch).

Record envelope expected on protected documents (stamped server-side):
  org_id, created_by,
  assigned_worker_ids  (patients, screenings: CHWs assigned to the patient)
  care_team_ids        (patients, screenings: nurses/physicians on the care team)
  coordinator_user_id  (screenings/referrals: assigned care coordinator)
  referral_coordinator_ids (patients: coordinators with an assigned referral)
"""

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from .errors import Denial, PermissionDenied
from .identity import Principal
from .roles import (
    PATIENT_FIELDS_BY_ROLE,
    PLATFORM_ACTIONS,
    PLATFORM_PERMISSIONS,
    PROTECTED_FIELDS,
    TENANT_PERMISSIONS,
    Action,
    TenantRole,
)

R = TenantRole
REFERRAL_ACTIONS = frozenset({Action.REFERRAL_READ, Action.REFERRAL_UPDATE})
ORG_LEVEL_ACTIONS = frozenset({Action.ANALYTICS_READ, Action.ORG_MEMBERS_MANAGE, Action.ORG_AUDIT_READ})


@dataclass(frozen=True)
class Decision:
    allowed: bool
    denial: Denial | None = None
    reason: str = ""


ALLOW = Decision(True)


def _deny(kind: Denial, reason: str) -> Decision:
    return Decision(False, kind, reason)


def permissions_for(principal: Principal, *, platform_scope: bool) -> frozenset[Action]:
    if principal.principal_type == "service":
        return principal.scopes
    if platform_scope:
        return PLATFORM_PERMISSIONS.get(principal.platform_role, frozenset()) if principal.platform_role else frozenset()
    # Tenant scope never falls back to the platform role.
    return TENANT_PERMISSIONS.get(principal.tenant_role, frozenset()) if principal.tenant_role else frozenset()


def relationship_predicate(principal: Principal, action: Action) -> dict[str, Any] | None:
    """Mongo predicate for records this principal is related to; None = no relationship possible."""
    if principal.principal_type == "service" or action in ORG_LEVEL_ACTIONS or action == Action.PATIENT_CREATE:
        return {}
    uid = principal.user_id
    role = principal.tenant_role
    if role == R.COMMUNITY_HEALTH_WORKER:
        return {"assigned_worker_ids": uid}
    if role in (R.NURSE, R.PHYSICIAN):
        return {"care_team_ids": uid}
    if role == R.CARE_COORDINATOR:
        if action in REFERRAL_ACTIONS:
            return {"coordinator_user_id": uid}
        if action == Action.PATIENT_READ:
            return {"referral_coordinator_ids": uid}
    return None


def _matches(resource: Mapping[str, Any], predicate: Mapping[str, Any]) -> bool:
    for key, value in predicate.items():
        field = resource.get(key)
        if isinstance(field, (list, tuple, set, frozenset)):
            if value not in field:
                return False
        elif field != value:
            return False
    return True


def authorize(principal: Principal, action: Action, resource: Mapping[str, Any] | None = None) -> Decision:
    platform_scope = action in PLATFORM_ACTIONS
    if action not in permissions_for(principal, platform_scope=platform_scope):
        return _deny(Denial.FORBIDDEN, f"{action} not permitted for this principal")
    if platform_scope:
        return ALLOW
    if not principal.org_id:
        return _deny(Denial.FORBIDDEN, "no active organisation membership")
    if resource is None:
        return ALLOW  # collection-level check; lists MUST use visibility_predicate()
    if resource.get("org_id") != principal.org_id:
        return _deny(Denial.NOT_VISIBLE, "resource outside caller organisation")
    predicate = relationship_predicate(principal, action)
    if predicate is None or not _matches(resource, predicate):
        return _deny(Denial.NOT_VISIBLE, "no relationship to resource")
    return ALLOW


def visibility_predicate(principal: Principal, action: Action) -> dict[str, Any]:
    """Org + relationship predicate to fold into every query (applied before pagination)."""
    decision = authorize(principal, action)
    if not decision.allowed:
        raise PermissionDenied(decision.reason)
    predicate = relationship_predicate(principal, action)
    if predicate is None:
        raise PermissionDenied("no relationship scope for this role/action")
    return {"org_id": principal.org_id, **predicate}


def project_patient(principal: Principal, doc: Mapping[str, Any]) -> dict[str, Any]:
    """Server-side per-role field allow-list; also strips the internal envelope."""
    allowed = PATIENT_FIELDS_BY_ROLE.get(principal.tenant_role) if principal.tenant_role else frozenset()
    if allowed is None:
        return {k: v for k, v in doc.items() if k not in PROTECTED_FIELDS}
    return {k: v for k, v in doc.items() if k in allowed}


_FORBIDDEN_STAGES = ("$lookup", "$graphLookup", "$unionWith", "$out", "$merge")


class ScopedCollection:
    """Mandatory data-access wrapper: every read/write carries the principal's scope."""

    def __init__(self, collection, principal: Principal, action: Action) -> None:
        self._collection = collection
        self._principal = principal
        self._action = action
        self._predicate = visibility_predicate(principal, action)

    @property
    def predicate(self) -> dict[str, Any]:
        return dict(self._predicate)

    def _scoped(self, filter_: Mapping[str, Any] | None) -> dict[str, Any]:
        # $and means a client filter (even one naming org_id) can only NARROW the scope.
        return {"$and": [self._predicate, dict(filter_ or {})]}

    async def find(self, filter_=None, *, sort=None, limit: int = 100) -> list[dict]:
        cursor = self._collection.find(self._scoped(filter_), {"_id": 0})
        if sort:
            cursor = cursor.sort(sort)
        return await cursor.to_list(max(1, min(limit, 500)))

    async def find_one(self, filter_) -> dict | None:
        return await self._collection.find_one(self._scoped(filter_), {"_id": 0})

    async def count(self, filter_=None) -> int:
        return await self._collection.count_documents(self._scoped(filter_))

    async def update_one(self, filter_, set_fields: Mapping[str, Any]) -> bool:
        illegal = PROTECTED_FIELDS.intersection(set_fields)
        if illegal or any(k.startswith("$") for k in set_fields):
            raise PermissionDenied(f"update touches protected fields: {sorted(illegal)}")
        result = await self._collection.update_one(self._scoped(filter_), {"$set": dict(set_fields)})
        return result.matched_count == 1

    async def insert_one(self, doc: Mapping[str, Any], *, relationships: Mapping[str, Any] | None = None) -> dict:
        """Strips client-supplied envelope fields and stamps org/creator server-side."""
        clean = {k: v for k, v in doc.items() if k not in PROTECTED_FIELDS}
        clean["org_id"] = self._principal.org_id
        clean["created_by"] = self._principal.user_id
        server_rel = dict(relationships or {})
        if self._principal.tenant_role == R.COMMUNITY_HEALTH_WORKER:
            server_rel.setdefault("assigned_worker_ids", [self._principal.user_id])
        clean.update({k: v for k, v in server_rel.items() if k in PROTECTED_FIELDS})
        await self._collection.insert_one(dict(clean))
        return clean

    async def aggregate(self, pipeline: list[dict]) -> list[dict]:
        for stage in pipeline:
            if any(op in stage for op in _FORBIDDEN_STAGES):
                raise PermissionDenied("cross-collection or write stages are not allowed in scoped aggregations")
        scoped = [{"$match": self._predicate}, *pipeline]
        return await self._collection.aggregate(scoped).to_list(1000)
