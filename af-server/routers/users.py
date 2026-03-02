"""
routers/users.py — User management endpoints (PostgreSQL).

All write endpoints require AFU-ADMIN role.
GET /users/me is available to any authenticated user.
"""

import os
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from core.auth import Claims, require_auth, require_afu_admin, _get_firebase_app
from core.db import get_db

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _log_user_action(conn, action: str, entity_id: str, uid: str, email: str):
    """Write a log entry to system_logs table."""
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(text("""
        INSERT INTO system_logs (action, entity_id, uid, email, created_at)
        VALUES (:action, :entity_id, :uid, :email, :created_at)
    """), {
        "action": action,
        "entity_id": entity_id,
        "uid": uid,
        "email": email,
        "created_at": now,
    })


def _row_to_user(row) -> dict:
    """Serialise a users JOIN row to a dict matching UserRecord shape."""
    company_name = getattr(row, "company_short_name", None) or getattr(row, "company_name", None)
    created_at = row.created_at
    if created_at and hasattr(created_at, "isoformat"):
        created_at = created_at.isoformat()
    return {
        "uid": row.uid,
        "email": row.email,
        "first_name": row.first_name or "",
        "last_name": row.last_name or "",
        "phone_number": row.phone_number,
        "account_type": row.account_type,
        "role": row.role or "",
        "company_id": row.company_id,
        "company_name": company_name,
        "valid_access": row.valid_access,
        "validated": row.email_validated,
        "last_login": row.last_login,
        "created_at": created_at,
    }


_USERS_SELECT = """
    SELECT u.uid, u.email, u.first_name, u.last_name, u.phone_number,
           u.account_type, u.role, u.company_id, u.valid_access,
           u.email_validated, u.last_login, u.created_at,
           c.short_name AS company_short_name, c.name AS company_name
    FROM users u
    LEFT JOIN companies c ON c.id = u.company_id
"""


# ---------------------------------------------------------------------------
# GET /users/me — current user profile (no role gate)
# NOTE: must be registered before /{uid} to avoid route conflict
# ---------------------------------------------------------------------------

@router.get("/me")
async def get_current_user(
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    """Return the current authenticated user's profile."""
    row = conn.execute(
        text(_USERS_SELECT + " WHERE u.uid = :uid"),
        {"uid": claims.uid},
    ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    return {"status": "OK", "data": _row_to_user(row)}


# ---------------------------------------------------------------------------
# GET /users — list all users (AFU-ADMIN only)
# ---------------------------------------------------------------------------

@router.get("")
async def list_users(
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    """List all users ordered AFU first, then alphabetical by last name."""
    rows = conn.execute(text(
        _USERS_SELECT + """
        ORDER BY
            CASE WHEN u.account_type = 'AFU' THEN 0 ELSE 1 END,
            u.last_name ASC
        """
    )).fetchall()

    return {"status": "OK", "data": [_row_to_user(r) for r in rows]}


# ---------------------------------------------------------------------------
# POST /users — create user (AFU-ADMIN only)
# ---------------------------------------------------------------------------

class CreateUserRequest(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    phone_number: Optional[str] = None
    account_type: str
    role: str
    company_id: Optional[str] = None


@router.post("")
async def create_user(
    body: CreateUserRequest,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    """Create a new user in Firebase Auth and the users table."""
    from firebase_admin import auth as firebase_auth

    _get_firebase_app()

    # 1. Create Firebase Auth user
    try:
        fb_user = firebase_auth.create_user(
            email=body.email.strip().lower(),
            password=body.password,
            display_name=f"{body.first_name.strip()} {body.last_name.strip()}",
        )
    except firebase_auth.EmailAlreadyExistsError:
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    except Exception as e:
        msg = str(e)
        if "WEAK_PASSWORD" in msg or "weak-password" in msg.lower():
            raise HTTPException(status_code=400, detail="Password is too weak")
        if "INVALID_EMAIL" in msg or "invalid-email" in msg.lower():
            raise HTTPException(status_code=400, detail="Invalid email address")
        raise HTTPException(status_code=400, detail=msg)

    uid = fb_user.uid

    # 2. Insert into users table
    conn.execute(text("""
        INSERT INTO users (
            uid, email, first_name, last_name, phone_number,
            account_type, role, company_id, valid_access,
            email_validated, created_at, updated_at
        ) VALUES (
            :uid, :email, :first_name, :last_name, :phone_number,
            :account_type, :role, :company_id, TRUE,
            FALSE, NOW(), NOW()
        )
    """), {
        "uid": uid,
        "email": body.email.strip().lower(),
        "first_name": body.first_name.strip(),
        "last_name": body.last_name.strip(),
        "phone_number": body.phone_number.strip() if body.phone_number else None,
        "account_type": body.account_type,
        "role": body.role,
        "company_id": body.company_id or None,
    })

    _log_user_action(conn, "USER_CREATE", uid, claims.uid, claims.email)

    return {"status": "OK", "data": {"uid": uid}}


# ---------------------------------------------------------------------------
# PATCH /users/{uid} — update user (AFU-ADMIN only)
# ---------------------------------------------------------------------------

class UpdateUserRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: Optional[str] = None
    role: Optional[str] = None
    valid_access: Optional[bool] = None
    company_id: Optional[str] = None


@router.patch("/{uid}")
async def update_user(
    uid: str,
    body: UpdateUserRequest,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    """Update user profile fields. Syncs displayName and disabled flag to Firebase Auth."""
    from firebase_admin import auth as firebase_auth

    _get_firebase_app()

    # Build SET clause dynamically from provided fields
    updates: dict = {}
    if body.first_name is not None:
        updates["first_name"] = body.first_name.strip()
    if body.last_name is not None:
        updates["last_name"] = body.last_name.strip()
    if body.phone_number is not None:
        updates["phone_number"] = body.phone_number.strip() or None
    if body.role is not None:
        updates["role"] = body.role
    if body.valid_access is not None:
        updates["valid_access"] = body.valid_access
    if body.company_id is not None:
        updates["company_id"] = body.company_id or None

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    conn.execute(
        text(f"UPDATE users SET {set_clause} WHERE uid = :uid"),
        {**updates, "uid": uid},
    )

    # Sync to Firebase Auth
    fb_updates: dict = {}
    if body.valid_access is not None:
        fb_updates["disabled"] = not body.valid_access
    if body.first_name is not None or body.last_name is not None:
        # Fetch current names if only one side changed
        if body.first_name is None or body.last_name is None:
            row = conn.execute(
                text("SELECT first_name, last_name FROM users WHERE uid = :uid"),
                {"uid": uid},
            ).fetchone()
            fn = body.first_name.strip() if body.first_name is not None else (row.first_name or "")
            ln = body.last_name.strip() if body.last_name is not None else (row.last_name or "")
        else:
            fn = body.first_name.strip()
            ln = body.last_name.strip()
        fb_updates["display_name"] = f"{fn} {ln}".strip()

    if fb_updates:
        try:
            firebase_auth.update_user(uid, **fb_updates)
        except Exception as e:
            logger.warning("[update_user] Firebase sync failed for %s: %s", uid, e)

    _log_user_action(conn, "USER_UPDATE", uid, claims.uid, claims.email)
    return {"status": "OK"}


# ---------------------------------------------------------------------------
# DELETE /users/{uid} — delete user (AFU-ADMIN only)
# ---------------------------------------------------------------------------

@router.delete("/{uid}")
async def delete_user(
    uid: str,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    """Delete user from Firebase Auth and the users table."""
    from firebase_admin import auth as firebase_auth

    _get_firebase_app()

    # 1. Delete from Firebase Auth (non-fatal if already gone)
    try:
        firebase_auth.delete_user(uid)
    except firebase_auth.UserNotFoundError:
        pass

    # 2. Delete from users table
    conn.execute(text("DELETE FROM users WHERE uid = :uid"), {"uid": uid})

    _log_user_action(conn, "USER_DELETE_PERMANENT", uid, claims.uid, claims.email)
    return {"status": "OK"}


# ---------------------------------------------------------------------------
# POST /users/{uid}/reset-password — reset password (AFU-ADMIN only)
# ---------------------------------------------------------------------------

class ResetPasswordRequest(BaseModel):
    new_password: str


@router.post("/{uid}/reset-password")
async def reset_password(
    uid: str,
    body: ResetPasswordRequest,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    """Set a new password for the user via Firebase Auth."""
    from firebase_admin import auth as firebase_auth

    _get_firebase_app()

    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    try:
        firebase_auth.update_user(uid, password=body.new_password)
    except firebase_auth.UserNotFoundError:
        raise HTTPException(status_code=404, detail="User not found")
    except Exception as e:
        msg = str(e)
        if "WEAK_PASSWORD" in msg or "weak-password" in msg.lower():
            raise HTTPException(status_code=400, detail="Password is too weak. Use at least 8 characters.")
        raise HTTPException(status_code=400, detail=msg)

    _log_user_action(conn, "USER_RESET_PASSWORD", uid, claims.uid, claims.email)
    return {"status": "OK"}


# ---------------------------------------------------------------------------
# POST /users/{uid}/send-reset-email — send password reset email (AFU-ADMIN only)
# ---------------------------------------------------------------------------

@router.post("/{uid}/send-reset-email")
async def send_reset_email(
    uid: str,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    """Send a Firebase password reset email to the user."""
    import requests as http_requests
    from firebase_admin import auth as firebase_auth

    _get_firebase_app()

    # Fetch email from Firebase Auth
    try:
        fb_user = firebase_auth.get_user(uid)
    except firebase_auth.UserNotFoundError:
        raise HTTPException(status_code=404, detail="User not found")

    if not fb_user.email:
        raise HTTPException(status_code=400, detail="User has no email address")

    api_key = os.environ.get("FIREBASE_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="Server configuration error: missing FIREBASE_API_KEY")

    resp = http_requests.post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key={api_key}",
        json={"requestType": "PASSWORD_RESET", "email": fb_user.email},
        timeout=10,
    )

    if not resp.ok:
        logger.error("[send_reset_email] Firebase REST error: %s", resp.text)
        raise HTTPException(status_code=502, detail="Failed to send reset email. Please try again.")

    _log_user_action(conn, "USER_SEND_RESET_EMAIL", uid, claims.uid, claims.email)
    return {"status": "OK"}
