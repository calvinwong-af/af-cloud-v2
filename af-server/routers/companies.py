"""
routers/companies.py — Company endpoints (PostgreSQL).
"""

import json
import logging
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text

from core.auth import Claims, require_auth, require_afu, require_afu_admin
from core.db import get_db
from core import db_queries
from core.exceptions import NotFoundError

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("")
async def list_companies(
    search: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=500),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """List companies. AFU staff only."""
    items = db_queries.list_companies(conn, search=search, limit=limit)
    return {"status": "OK", "data": items, "msg": f"{len(items)} companies"}


@router.get("/stats")
async def get_company_stats(
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Company dashboard stats. AFU staff only."""
    row = conn.execute(text("""
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE approved = TRUE) AS approved,
            COUNT(*) FILTER (WHERE has_platform_access = TRUE) AS with_access,
            COUNT(*) FILTER (WHERE xero_contact_id IS NOT NULL AND xero_contact_id != '') AS xero_synced
        FROM companies
        WHERE trash = FALSE
    """)).fetchone()

    return {
        "status": "OK",
        "data": {
            "total": row[0] or 0,
            "approved": row[1] or 0,
            "with_access": row[2] or 0,
            "xero_synced": row[3] or 0,
        },
    }


@router.get("/{company_id}")
async def get_company(
    company_id: str,
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    """Get a single company by ID."""
    row = conn.execute(text("""
        SELECT id, name, short_name, account_type, email, phone, address,
               xero_contact_id, approved, has_platform_access, trash,
               created_at::text, updated_at::text
        FROM companies WHERE id = :id
    """), {"id": company_id}).fetchone()

    if not row:
        raise NotFoundError(f"Company {company_id} not found")

    address = row[6]
    if isinstance(address, str):
        try:
            address = json.loads(address)
        except (ValueError, TypeError):
            pass

    data = {
        "company_id": row[0],
        "id": row[0],
        "name": row[1] or "",
        "short_name": row[2] or "",
        "account_type": row[3] or "AFC",
        "email": row[4] or "",
        "phone": row[5] or "",
        "address": address,
        "xero_contact_id": row[7] or "",
        "approved": row[8] or False,
        "has_platform_access": row[9] or False,
        "trash": row[10] or False,
        "created_at": row[11] or "",
        "updated_at": row[12] or "",
    }

    return {"status": "OK", "data": data}


class CreateCompanyRequest(BaseModel):
    id: str
    name: str
    short_name: str | None = None
    account_type: str = "AFC"
    email: str | None = None
    phone: str | None = None


@router.post("")
async def create_company(
    body: CreateCompanyRequest,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    """Create a new company. AFU-ADMIN only."""
    now = datetime.now(timezone.utc).isoformat()

    conn.execute(text("""
        INSERT INTO companies (id, name, short_name, account_type, email, phone, created_at, updated_at)
        VALUES (:id, :name, :short_name, :account_type, :email, :phone, :created_at, :updated_at)
    """), {
        "id": body.id,
        "name": body.name,
        "short_name": body.short_name,
        "account_type": body.account_type,
        "email": body.email,
        "phone": body.phone,
        "created_at": now,
        "updated_at": now,
    })

    return {
        "status": "OK",
        "data": {"company_id": body.id, "name": body.name},
        "msg": "Company created",
    }


class UpdateCompanyRequest(BaseModel):
    name: str | None = None
    short_name: str | None = None
    email: str | None = None
    phone: str | None = None
    approved: bool | None = None
    has_platform_access: bool | None = None


@router.patch("/{company_id}")
async def update_company(
    company_id: str,
    body: UpdateCompanyRequest,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Update a company. AFU staff only."""
    updates = []
    params = {"id": company_id, "updated_at": datetime.now(timezone.utc).isoformat()}

    if body.name is not None:
        updates.append("name = :name")
        params["name"] = body.name
    if body.short_name is not None:
        updates.append("short_name = :short_name")
        params["short_name"] = body.short_name
    if body.email is not None:
        updates.append("email = :email")
        params["email"] = body.email
    if body.phone is not None:
        updates.append("phone = :phone")
        params["phone"] = body.phone
    if body.approved is not None:
        updates.append("approved = :approved")
        params["approved"] = body.approved
    if body.has_platform_access is not None:
        updates.append("has_platform_access = :has_platform_access")
        params["has_platform_access"] = body.has_platform_access

    if not updates:
        return {"status": "OK", "msg": "No changes"}

    updates.append("updated_at = :updated_at")
    set_clause = ", ".join(updates)

    result = conn.execute(text(f"UPDATE companies SET {set_clause} WHERE id = :id"), params)
    if result.rowcount == 0:
        raise NotFoundError(f"Company {company_id} not found")

    return {"status": "OK", "msg": "Company updated"}
