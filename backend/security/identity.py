"""Server-derived principal and identity source of truth (users + memberships)."""

from dataclasses import dataclass, field
from typing import Literal, Protocol

from pydantic import BaseModel, Field

from .roles import Action, PlatformRole, TenantRole


@dataclass(frozen=True)
class Principal:
    """Built only by `dependencies.get_principal` from a verified token + identity store."""

    user_id: str
    principal_type: Literal["user", "service"] = "user"
    org_id: str | None = None
    tenant_role: TenantRole | None = None
    platform_role: PlatformRole | None = None
    token_id: str | None = None
    scopes: frozenset[Action] = field(default_factory=frozenset)  # service principals only


class UserIdentity(BaseModel):
    id: str
    email: str
    status: Literal["active", "disabled"] = "active"
    platform_role: PlatformRole | None = None
    password_hash: str | None = Field(default=None, repr=False)  # bcrypt hash only; never returned


class Membership(BaseModel):
    user_id: str
    org_id: str
    role: TenantRole
    status: Literal["active", "revoked"] = "active"


class IdentityStore(Protocol):
    async def get_user(self, user_id: str) -> UserIdentity | None: ...

    async def get_membership(self, user_id: str, org_id: str) -> Membership | None: ...


class MemoryIdentityStore:
    """In-memory store for tests / local wiring."""

    def __init__(self) -> None:
        self.users: dict[str, UserIdentity] = {}
        self.memberships: dict[tuple[str, str], Membership] = {}

    def add_user(self, user: UserIdentity) -> None:
        self.users[user.id] = user

    def add_membership(self, membership: Membership) -> None:
        self.memberships[(membership.user_id, membership.org_id)] = membership

    async def get_user(self, user_id: str) -> UserIdentity | None:
        return self.users.get(user_id)

    async def get_membership(self, user_id: str, org_id: str) -> Membership | None:
        return self.memberships.get((user_id, org_id))


AUTH_USERS = "auth_users"
AUTH_MEMBERSHIPS = "auth_memberships"

# Not registered in lib/db.INDEXES yet: adding them would create collections in the live DB.
SECURITY_INDEX_SPECS = {
    AUTH_USERS: [{"keys": [("id", 1)], "unique": True}, {"keys": [("email", 1)], "unique": True}],
    AUTH_MEMBERSHIPS: [{"keys": [("user_id", 1), ("org_id", 1)], "unique": True}, {"keys": [("org_id", 1)]}],
}


class MongoIdentityStore:
    def __init__(self, db) -> None:
        self._users = db[AUTH_USERS]
        self._memberships = db[AUTH_MEMBERSHIPS]

    async def get_user(self, user_id: str) -> UserIdentity | None:
        doc = await self._users.find_one({"id": user_id}, {"_id": 0})
        return UserIdentity(**doc) if doc else None

    async def get_membership(self, user_id: str, org_id: str) -> Membership | None:
        doc = await self._memberships.find_one({"user_id": user_id, "org_id": org_id}, {"_id": 0})
        return Membership(**doc) if doc else None
