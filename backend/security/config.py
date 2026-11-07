"""Security configuration, read only from environment variables.

There are NO defaults for secrets. If AUTH_JWT_SECRET is absent or weak, loading
fails closed with AuthNotConfigured (HTTP 503 when used by a dependency).
"""

import os
from collections.abc import Mapping
from dataclasses import dataclass, field

from .errors import AuthNotConfigured

ALLOWED_ALGORITHMS = frozenset({"HS256", "HS384", "HS512"})
MIN_SECRET_BYTES = 32
MAX_TTL_SECONDS = 3600


@dataclass(frozen=True)
class SecuritySettings:
    jwt_secret: str = field(repr=False)
    jwt_algorithm: str = "HS256"
    issuer: str = "avenea-api"
    audience: str = "avenea"
    access_token_ttl_seconds: int = 900
    leeway_seconds: int = 0


def load_settings(env: Mapping[str, str] | None = None) -> SecuritySettings:
    env = os.environ if env is None else env
    secret = env.get("AUTH_JWT_SECRET", "")
    if len(secret.encode()) < MIN_SECRET_BYTES:
        raise AuthNotConfigured("AUTH_JWT_SECRET is missing or shorter than 32 bytes")
    algorithm = env.get("AUTH_JWT_ALGORITHM", "HS256")
    if algorithm not in ALLOWED_ALGORITHMS:
        raise AuthNotConfigured(f"AUTH_JWT_ALGORITHM must be one of {sorted(ALLOWED_ALGORITHMS)}")
    try:
        ttl = int(env.get("AUTH_ACCESS_TOKEN_TTL_SECONDS", "900"))
    except ValueError as exc:
        raise AuthNotConfigured("AUTH_ACCESS_TOKEN_TTL_SECONDS must be an integer") from exc
    if not 60 <= ttl <= MAX_TTL_SECONDS:
        raise AuthNotConfigured("AUTH_ACCESS_TOKEN_TTL_SECONDS must be between 60 and 3600")
    return SecuritySettings(
        jwt_secret=secret,
        jwt_algorithm=algorithm,
        issuer=env.get("AUTH_JWT_ISSUER", "avenea-api"),
        audience=env.get("AUTH_JWT_AUDIENCE", "avenea"),
        access_token_ttl_seconds=ttl,
    )
