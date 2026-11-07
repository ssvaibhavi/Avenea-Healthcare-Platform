"""FastAPI dependencies: principal resolution, action gates, resource checks.

INACTIVE: `server.py` never calls `configure_security`, so no existing route
uses these. Any route that does use them while security is unconfigured fails
closed with 503 (there is no bypass path).

The organisation is taken ONLY from the verified token and then validated
against the membership store. Body/query/path values are never consulted.
"""

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .audit import AuditEventType, AuditLogger, AuditOutcome
from .config import SecuritySettings, load_settings
from .errors import (
    AuthenticationRequired,
    AuthNotConfigured,
    Denial,
    InvalidCredentials,
    PermissionDenied,
    ResourceNotVisible,
)
from .identity import IdentityStore, Principal
from .policy import authorize
from .roles import Action
from .tokens import verify_access_token

_bearer = HTTPBearer(auto_error=False)
STATE_KEY = "avenea_security"


@dataclass(frozen=True)
class SecurityContext:
    settings: SecuritySettings
    identity_store: IdentityStore
    audit: AuditLogger


def configure_security(app, *, identity_store: IdentityStore, audit: AuditLogger, settings: SecuritySettings | None = None) -> None:
    """Explicit opt-in. Loads settings from env (fails closed) unless provided."""
    setattr(app.state, STATE_KEY, SecurityContext(settings or load_settings(), identity_store, audit))


def _context(request: Request) -> SecurityContext:
    ctx = getattr(request.app.state, STATE_KEY, None)
    if ctx is None:
        raise AuthNotConfigured("security context not configured")
    return ctx


def _request_id(request: Request) -> str | None:
    rid = request.headers.get("x-request-id")
    return rid[:64] if rid else None


async def get_principal(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> Principal:
    ctx = _context(request)
    rid = _request_id(request)

    async def fail(err, user_id: str | None = None):
        await ctx.audit.record(
            AuditEventType.AUTH_FAILURE, AuditOutcome.FAILURE, actor_user_id=user_id, reason=err.reason, request_id=rid
        )
        raise err

    if credentials is None or not credentials.credentials:
        await fail(AuthenticationRequired("missing bearer credentials"))
    try:
        claims = verify_access_token(ctx.settings, credentials.credentials)
    except InvalidCredentials as err:
        await fail(err)

    user = await ctx.identity_store.get_user(claims.sub)
    if user is None or user.status != "active":
        await fail(InvalidCredentials("unknown or disabled user"), claims.sub)

    org_id = tenant_role = None
    if claims.org:
        membership = await ctx.identity_store.get_membership(user.id, claims.org)
        if membership is None or membership.status != "active":
            await fail(InvalidCredentials("no active membership for requested organisation"), user.id)
        org_id, tenant_role = membership.org_id, membership.role

    principal = Principal(
        user_id=user.id, org_id=org_id, tenant_role=tenant_role, platform_role=user.platform_role, token_id=claims.jti
    )
    await ctx.audit.record(AuditEventType.AUTH_SUCCESS, AuditOutcome.SUCCESS, principal=principal, request_id=rid)
    return principal


def require(action: Action):
    """Route dependency: authenticated principal whose role permits `action` (collection level)."""

    async def dependency(request: Request, principal: Principal = Depends(get_principal)) -> Principal:
        decision = authorize(principal, action)
        if not decision.allowed:
            await _context(request).audit.record(
                AuditEventType.ACCESS_DENIED, AuditOutcome.DENY, principal=principal, action=action,
                reason=decision.reason, request_id=_request_id(request),
            )
            raise PermissionDenied(decision.reason)
        return principal

    return dependency


async def authorize_resource(
    request: Request,
    principal: Principal,
    action: Action,
    resource: Mapping[str, Any] | None,
    *,
    resource_type: str,
    resource_id: str,
) -> None:
    """Object-level check for a single record reached by a client-supplied id.

    `resource` must be loaded through ScopedCollection (None = not found / not visible -> 404).
    """
    audit = _context(request).audit
    rid = _request_id(request)
    if resource is None:
        await audit.record(
            AuditEventType.ACCESS_DENIED, AuditOutcome.DENY, principal=principal, action=action,
            resource_type=resource_type, resource_id=resource_id, reason="not found or not visible", request_id=rid,
        )
        raise ResourceNotVisible("not found or not visible")
    decision = authorize(principal, action, resource)
    if not decision.allowed:
        await audit.record(
            AuditEventType.ACCESS_DENIED, AuditOutcome.DENY, principal=principal, action=action,
            resource_type=resource_type, resource_id=resource_id, reason=decision.reason, request_id=rid,
        )
        if decision.denial == Denial.NOT_VISIBLE:
            raise ResourceNotVisible(decision.reason)
        raise PermissionDenied(decision.reason)
    if resource_type == "patient" and action == Action.PATIENT_READ:
        await audit.record(
            AuditEventType.PATIENT_ACCESS, AuditOutcome.ALLOW, principal=principal, action=action,
            resource_type=resource_type, resource_id=resource_id, request_id=rid,
        )
