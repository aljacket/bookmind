"""Firebase ID-token verification for the recommendation endpoints.

`get_current_uid` is a FastAPI dependency. It reads ``Authorization: Bearer <ID token>`` and
verifies it with ``firebase_admin.auth.verify_id_token(..., check_revoked=True)``, so the still
unexpired tokens of a deleted, disabled or signed-out-everywhere user are rejected too.

- missing, malformed, expired or revoked token, or a deleted/disabled user: 401
- Firebase cannot be reached or is misconfigured: 503 (fail closed, the LLM is never called)

Credentials come from Application Default Credentials (the Cloud Run service account, or
``GOOGLE_APPLICATION_CREDENTIALS`` locally). The project id comes from ``FIREBASE_PROJECT_ID``,
else ``GOOGLE_CLOUD_PROJECT``, else the credentials.
"""

import logging
import os
import threading
from typing import Optional

import firebase_admin
from fastapi import Header, HTTPException, status
from firebase_admin import auth as firebase_auth

logger = logging.getLogger("bookmind.auth")

_app_lock = threading.Lock()
_app: Optional[firebase_admin.App] = None


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_firebase_app() -> firebase_admin.App:
    """Create the default Firebase Admin app once, lazily."""
    global _app
    with _app_lock:
        if _app is None:
            options = {}
            project_id = os.getenv("FIREBASE_PROJECT_ID") or os.getenv("GOOGLE_CLOUD_PROJECT")
            if project_id:
                options["projectId"] = project_id
            _app = firebase_admin.initialize_app(options=options or None)
        return _app


def _extract_bearer_token(authorization: Optional[str]) -> str:
    if not authorization:
        raise _unauthorized("Missing Authorization header")
    scheme, _, token = authorization.partition(" ")
    token = token.strip()
    if scheme.lower() != "bearer" or not token:
        raise _unauthorized("Authorization header must be 'Bearer <Firebase ID token>'")
    return token


def get_current_uid(authorization: Optional[str] = Header(default=None)) -> str:
    """Return the verified Firebase UID of the caller, or raise 401 / 503."""
    token = _extract_bearer_token(authorization)
    try:
        claims = firebase_auth.verify_id_token(token, app=get_firebase_app(), check_revoked=True)
    except (
        firebase_auth.InvalidIdTokenError,  # malformed, bad signature, expired, revoked
        firebase_auth.UserNotFoundError,  # token of a deleted user (revocation lookup)
        firebase_auth.UserDisabledError,
    ):
        raise _unauthorized("Invalid or expired token")
    except Exception as exc:  # certificate fetch, Auth API outage, missing project id, ...
        logger.error("Token verification unavailable: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable",
        )
    uid = claims.get("uid")
    if not uid:
        raise _unauthorized("Invalid or expired token")
    return uid
