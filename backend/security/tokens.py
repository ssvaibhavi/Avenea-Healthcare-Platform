"""Access-token issue/verification with PyJWT. No custom cryptography.

Tokens carry identity only (`sub`) plus the *requested* active organisation
(`org`). Roles are NEVER read from the token: they are re-derived from the
identity store on every request, so a revoked membership stops working on the
next call rather than at token expiry.
"""

import time
import uuid

import jwt
from pydantic import BaseModel, ValidationError

from .config import SecuritySettings
from .errors import ExpiredCredentials, InvalidCredentials

REQUIRED_CLAIMS = ["exp", "iat", "nbf", "sub", "iss", "aud", "jti"]
TOKEN_TYPE = "access"


class TokenClaims(BaseModel):
    sub: str
    org: str | None = None
    jti: str
    iat: int
    nbf: int
    exp: int
    typ: str


def issue_access_token(
    settings: SecuritySettings,
    *,
    user_id: str,
    org_id: str | None = None,
    now: int | None = None,
    ttl_seconds: int | None = None,
) -> str:
    """Mint a short-lived token. Intended for a future login/IdP-exchange route and tests."""
    issued = int(time.time()) if now is None else now
    payload = {
        "sub": user_id,
        "org": org_id,
        "iat": issued,
        "nbf": issued,
        "exp": issued + (ttl_seconds or settings.access_token_ttl_seconds),
        "iss": settings.issuer,
        "aud": settings.audience,
        "jti": uuid.uuid4().hex,
        "typ": TOKEN_TYPE,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def verify_access_token(settings: SecuritySettings, token: str) -> TokenClaims:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],  # pinned: blocks alg=none / alg confusion
            audience=settings.audience,
            issuer=settings.issuer,
            leeway=settings.leeway_seconds,
            options={"require": REQUIRED_CLAIMS},
        )
    except jwt.ExpiredSignatureError as exc:
        raise ExpiredCredentials("token expired") from exc
    except jwt.InvalidTokenError as exc:
        raise InvalidCredentials(f"token rejected: {type(exc).__name__}") from exc
    if payload.get("typ") != TOKEN_TYPE:
        raise InvalidCredentials("wrong token type")
    try:
        return TokenClaims(**payload)
    except ValidationError as exc:
        raise InvalidCredentials("malformed claims") from exc
