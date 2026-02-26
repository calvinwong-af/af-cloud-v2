"""
core/auth.py

Firebase ID token verification as a FastAPI dependency.

Replaces: auth/access_auth.py (Gordon decorator class) + the external
          auth.accelefreight.com microservice round-trip.

Usage:
    from core.auth import require_auth, require_afu, Claims

    @router.get("/something")
    async def endpoint(claims: Claims = Depends(require_auth)):
        ...

    @router.get("/admin-only")
    async def admin_endpoint(claims: Claims = Depends(require_afu)):
        ...
"""

import os
from functools import lru_cache
from typing import Optional

import firebase_admin
from firebase_admin import auth as firebase_auth, credentials
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from core import constants

# ---------------------------------------------------------------------------
# Firebase Admin initialisation (singleton — runs once on cold start)
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _get_firebase_app() -> firebase_admin.App:
    """Initialise Firebase Admin SDK once per process."""
    if firebase_admin._apps:
        return firebase_admin.get_app()

    # On Cloud Run, GOOGLE_APPLICATION_CREDENTIALS is set automatically
    # via the service account attached to the Cloud Run service.
    # Locally, point GOOGLE_APPLICATION_CREDENTIALS at the JSON key file.
    cred = credentials.ApplicationDefault()
    return firebase_admin.initialize_app(cred, {
        "projectId": constants.PROJECT_ID,
    })


# ---------------------------------------------------------------------------
# Claims model — what we extract from the verified Firebase token + Datastore
# ---------------------------------------------------------------------------

class Claims(BaseModel):
    uid: str
    email: str
    account_type: str           # 'AFU' | 'AFC'
    role: str                   # 'AFU-ADMIN' | 'AFU-SM' | 'AFU-SE' | 'AFC-ADMIN' | 'AFC-M'
    company_id: Optional[str]   = None   # set for AFC users
    name: Optional[str]         = None

    class Config:
        # pydantic v1 — allow extra fields from Datastore without error
        extra = "ignore"

    # Convenience helpers
    def is_afu(self) -> bool:
        return self.account_type == constants.AFU

    def is_afc(self) -> bool:
        return self.account_type == constants.AFC

    def is_afu_admin(self) -> bool:
        return self.role == constants.AFU_ADMIN

    def is_super_admin(self) -> bool:
        return self.email in constants.SUPER_ADMIN_ACCESS


# ---------------------------------------------------------------------------
# Token bearer scheme
# ---------------------------------------------------------------------------

_bearer = HTTPBearer(auto_error=False)


async def _verify_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> dict:
    """Verify the Firebase ID token and return the decoded payload."""
    _get_firebase_app()  # ensure initialised

    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorisation token",
        )

    try:
        decoded = firebase_auth.verify_id_token(credentials.credentials)
        return decoded
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired — please sign in again",
        )
    except firebase_auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
        )


async def _build_claims(decoded_token: dict) -> Claims:
    """
    Build a Claims object from the verified Firebase token.

    The Firebase token itself carries the uid and email. Role and account_type
    come from Datastore (UserIAM + UserAccount Kinds) — same logic as V1 but
    done here in the server rather than in the external auth service.

    Note: For now we read these from the token's custom claims if present
    (set by Firebase Admin when a user is created/updated via createUserAction).
    Full Datastore lookup is added when the users router is wired up.
    """
    from core.datastore import get_client

    uid = decoded_token.get("uid")
    email = decoded_token.get("email", "")

    # --- Read UserIAM and UserAccount from Datastore ---
    client = get_client()

    # UserIAM — role, account_type, valid_access, company_id
    iam_key = client.key("UserIAM", uid)
    iam = client.get(iam_key)

    # UserAccount — account_type (primary source, per v2.10 fix)
    account_key = client.key("UserAccount", uid)
    account = client.get(account_key)

    if not iam:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account not found or access revoked",
        )

    # valid_access gate — same as V1
    if not iam.get("valid_access", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account access has been revoked",
        )

    # account_type: UserAccount is primary, UserIAM is fallback (v2.10 bug fix)
    account_type = (
        (account.get("account_type") if account else None)
        or iam.get("account_type")
        or ""
    )

    role = iam.get("role", "")
    company_id = iam.get("company_id") or (account.get("company_id") if account else None)
    name = (
        (account.get("name") if account else None)
        or iam.get("name")
        or decoded_token.get("name")
    )

    return Claims(
        uid=uid,
        email=email,
        account_type=account_type,
        role=role,
        company_id=company_id,
        name=name,
    )


# ---------------------------------------------------------------------------
# Public dependency functions — import these in routers
# ---------------------------------------------------------------------------

async def require_auth(
    decoded: dict = Depends(_verify_token),
) -> Claims:
    """Any authenticated user (AFU or AFC)."""
    return await _build_claims(decoded)


async def require_afu(
    claims: Claims = Depends(require_auth),
) -> Claims:
    """Restrict to AFU staff only (any AFU role)."""
    if not claims.is_afu():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="AF staff access required",
        )
    return claims


async def require_afu_admin(
    claims: Claims = Depends(require_auth),
) -> Claims:
    """Restrict to AFU-ADMIN role only."""
    if not claims.is_afu_admin():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="AF Admin access required",
        )
    return claims


async def require_super_admin(
    claims: Claims = Depends(require_auth),
) -> Claims:
    """Restrict to named super-admins only (calvin, isaac)."""
    if not claims.is_super_admin():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required",
        )
    return claims
