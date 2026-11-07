"""Roles, actions and the role -> permission matrix.

Two separate role scopes (never collapsed into one enum):
- tenant roles live on an organisation membership;
- the platform role lives on the user and grants NO clinical permissions.
"""

from enum import StrEnum


class TenantRole(StrEnum):
    COMMUNITY_HEALTH_WORKER = "community_health_worker"
    NURSE = "nurse"
    PHYSICIAN = "physician"
    CARE_COORDINATOR = "care_coordinator"
    ORGANIZATION_ADMIN = "organization_admin"


class PlatformRole(StrEnum):
    SYSTEM_ADMIN = "system_admin"


class Action(StrEnum):
    PATIENT_READ = "patient:read"
    PATIENT_CREATE = "patient:create"
    PATIENT_UPDATE = "patient:update"
    SCREENING_READ = "screening:read"
    SCREENING_CREATE = "screening:create"
    REFERRAL_READ = "referral:read"
    REFERRAL_UPDATE = "referral:update"
    ANALYTICS_READ = "analytics:read"
    ORG_MEMBERS_MANAGE = "org:members:manage"
    ORG_AUDIT_READ = "org:audit:read"
    PLATFORM_ORGS_MANAGE = "platform:orgs:manage"
    PLATFORM_HEALTH_READ = "platform:health:read"


A = Action
R = TenantRole

PLATFORM_ACTIONS: frozenset[Action] = frozenset({A.PLATFORM_ORGS_MANAGE, A.PLATFORM_HEALTH_READ})

_CLINICAL = {A.PATIENT_READ, A.PATIENT_UPDATE, A.SCREENING_READ, A.SCREENING_CREATE, A.REFERRAL_READ, A.REFERRAL_UPDATE}

TENANT_PERMISSIONS: dict[TenantRole, frozenset[Action]] = {
    # Field screening for ASSIGNED patients only (relationship enforced in policy/scoping).
    R.COMMUNITY_HEALTH_WORKER: frozenset(
        {A.PATIENT_READ, A.PATIENT_CREATE, A.PATIENT_UPDATE, A.SCREENING_READ, A.SCREENING_CREATE, A.REFERRAL_READ,
         A.ANALYTICS_READ}
    ),
    # Clinicians: patients on their care team; org-level aggregates.
    R.NURSE: frozenset(_CLINICAL | {A.PATIENT_CREATE, A.ANALYTICS_READ}),
    R.PHYSICIAN: frozenset(_CLINICAL | {A.PATIENT_CREATE, A.ANALYTICS_READ}),
    # Referral work for ASSIGNED referrals; patient contact fields only (field projection).
    R.CARE_COORDINATOR: frozenset({A.REFERRAL_READ, A.REFERRAL_UPDATE, A.PATIENT_READ, A.ANALYTICS_READ}),
    # Organisational operations, aggregates and audit; NO individual clinical records.
    R.ORGANIZATION_ADMIN: frozenset({A.ORG_MEMBERS_MANAGE, A.ORG_AUDIT_READ, A.ANALYTICS_READ}),
}

PLATFORM_PERMISSIONS: dict[PlatformRole, frozenset[Action]] = {
    # Operates the platform; receives NO tenant/clinical permissions.
    PlatformRole.SYSTEM_ADMIN: frozenset(PLATFORM_ACTIONS),
}

# Per-role read projection allow-lists (None = all fields).
PATIENT_FIELDS_BY_ROLE: dict[TenantRole, frozenset[str] | None] = {
    R.COMMUNITY_HEALTH_WORKER: None,
    R.NURSE: None,
    R.PHYSICIAN: None,
    R.CARE_COORDINATOR: frozenset({"id", "name", "community", "phone"}),
}

# Server-owned fields: never accepted from a client body or filter.
PROTECTED_FIELDS: frozenset[str] = frozenset(
    {
        "_id", "org_id", "created_by", "assigned_worker_ids", "care_team_ids",
        "coordinator_user_id", "referral_coordinator_ids", "role", "tenant_role",
        "platform_role", "is_admin",
    }
)


def can_grant(granter_role: TenantRole | None, target_role: TenantRole) -> bool:
    """Only an organisation admin may grant tenant roles, within their own org (caller enforces org)."""
    return granter_role == R.ORGANIZATION_ADMIN and target_role in TenantRole
