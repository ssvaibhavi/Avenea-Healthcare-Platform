"""Security errors with fixed, non-leaky public messages and HTTP mapping."""

from enum import StrEnum

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse


class Denial(StrEnum):
    FORBIDDEN = "forbidden"  # caller may see the resource but may not act -> 403
    NOT_VISIBLE = "not_visible"  # outside caller's org / relationship -> 404 (403 would leak existence)


class SecurityError(Exception):
    status_code = 500
    public_detail = "Security error"

    def __init__(self, reason: str = ""):
        # `reason` is internal (audit/log only); it is never returned to clients.
        super().__init__(reason or self.public_detail)
        self.reason = reason


class AuthNotConfigured(SecurityError):
    status_code = 503
    public_detail = "Authentication is not configured"


class AuthenticationRequired(SecurityError):
    status_code = 401
    public_detail = "Authentication required"


class InvalidCredentials(SecurityError):
    status_code = 401
    public_detail = "Invalid or expired credentials"


class ExpiredCredentials(InvalidCredentials):
    """Same public message as InvalidCredentials so expiry is not distinguishable to callers."""


class PermissionDenied(SecurityError):
    status_code = 403
    public_detail = "You do not have permission to perform this action"


class ResourceNotVisible(SecurityError):
    status_code = 404
    public_detail = "Not found"


def to_http_exception(err: SecurityError) -> HTTPException:
    headers = {"WWW-Authenticate": "Bearer"} if err.status_code == 401 else None
    return HTTPException(status_code=err.status_code, detail=err.public_detail, headers=headers)


async def security_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    """Register with `app.add_exception_handler(SecurityError, security_exception_handler)`."""
    assert isinstance(exc, SecurityError)
    headers = {"WWW-Authenticate": "Bearer"} if exc.status_code == 401 else None
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.public_detail}, headers=headers)
