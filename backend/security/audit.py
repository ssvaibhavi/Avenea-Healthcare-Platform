"""Security audit events: minimal, sanitised, append-only.

Never recorded: passwords, tokens, authorization headers, patient names or
contact details, clinical values, or request bodies. Metadata is allow-listed
to short scalar values and screened against sensitive key fragments.
"""

import logging
import uuid
from collections.abc import Mapping
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any, Protocol

from pydantic import BaseModel, ConfigDict, Field

from .identity import Principal

logger = logging.getLogger("avenea.audit")

AUDIT_COLLECTION = "audit_events"

SENSITIVE_KEY_FRAGMENTS = (
    "password", "passwd", "secret", "token", "authorization", "cookie", "jwt", "bearer", "credential",
    "name", "phone", "email", "address", "dob", "birth",
    "vital", "systolic", "diastolic", "glucose", "pulse", "weight", "height", "symptom", "note", "flag",
    "body", "payload", "diagnosis",
)
MAX_METADATA_KEYS = 12
MAX_VALUE_LENGTH = 120


class AuditEventType(StrEnum):
    AUTH_SUCCESS = "auth.success"
    AUTH_FAILURE = "auth.failure"
    ACCESS_DENIED = "access.denied"
    PATIENT_ACCESS = "patient.access"
    SCREENING_UPDATE = "screening.update"
    REFERRAL_UPDATE = "referral.update"
    ADMIN_ACTION = "admin.action"


class AuditOutcome(StrEnum):
    SUCCESS = "success"
    FAILURE = "failure"
    ALLOW = "allow"
    DENY = "deny"


Scalar = str | int | float | bool | None


class AuditEvent(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    event_type: AuditEventType
    outcome: AuditOutcome
    actor_user_id: str | None = None
    actor_type: str | None = None
    actor_role: str | None = None
    org_id: str | None = None
    action: str | None = None
    resource_type: str | None = None
    resource_id: str | None = None
    reason: str = Field("", max_length=200)
    request_id: str | None = Field(None, max_length=64)
    metadata: dict[str, Scalar] = Field(default_factory=dict)


def _is_sensitive(key: str) -> bool:
    lowered = key.lower()
    return any(fragment in lowered for fragment in SENSITIVE_KEY_FRAGMENTS)


def sanitize_metadata(metadata: Mapping[str, Any] | None) -> dict[str, Scalar]:
    clean: dict[str, Scalar] = {}
    for key, value in (metadata or {}).items():
        if len(clean) >= MAX_METADATA_KEYS:
            break
        if not isinstance(key, str) or _is_sensitive(key):
            continue
        if not isinstance(value, (str, int, float, bool)) and value is not None:
            continue  # nested structures (e.g. request bodies) are dropped
        if isinstance(value, str):
            value = value[:MAX_VALUE_LENGTH]
        clean[key[:40]] = value
    return clean


class AuditSink(Protocol):
    async def write(self, event: AuditEvent) -> None: ...


class MemoryAuditSink:
    def __init__(self) -> None:
        self.events: list[AuditEvent] = []

    async def write(self, event: AuditEvent) -> None:
        self.events.append(event)


class MongoAuditSink:
    """Insert-only sink; this module exposes no update/delete path for audit events."""

    def __init__(self, db) -> None:
        self._collection = db[AUDIT_COLLECTION]

    async def write(self, event: AuditEvent) -> None:
        await self._collection.insert_one(event.model_dump(mode="python"))


class AuditLogger:
    def __init__(self, sink: AuditSink, *, strict: bool = False) -> None:
        self._sink = sink
        self._strict = strict  # strict=True: audit write failure propagates (fail closed)

    async def record(
        self,
        event_type: AuditEventType,
        outcome: AuditOutcome,
        *,
        principal: Principal | None = None,
        actor_user_id: str | None = None,
        action: str | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        reason: str = "",
        request_id: str | None = None,
        metadata: Mapping[str, Any] | None = None,
    ) -> AuditEvent:
        role = None
        if principal is not None:
            role = principal.tenant_role or principal.platform_role
        event = AuditEvent(
            event_type=event_type,
            outcome=outcome,
            actor_user_id=principal.user_id if principal else actor_user_id,
            actor_type=principal.principal_type if principal else None,
            actor_role=str(role) if role else None,
            org_id=principal.org_id if principal else None,
            action=str(action) if action else None,
            resource_type=resource_type,
            resource_id=resource_id,
            reason=reason[:200],
            request_id=(request_id or None) and request_id[:64],
            metadata=sanitize_metadata(metadata),
        )
        try:
            await self._sink.write(event)
        except Exception:
            logger.exception("audit sink write failed for event %s", event.id)
            if self._strict:
                raise
        return event
