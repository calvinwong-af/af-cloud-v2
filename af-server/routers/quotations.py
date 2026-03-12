"""
routers/quotations.py — Quotation CRUD endpoints.

Quotations are generated from shipment orders. Each quotation captures a scope
snapshot and transport details at time of creation. Revisions are tracked as
separate rows (revision integer increments per shipment).
"""

import json
import logging
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, validator
from sqlalchemy import text, bindparam, String

from core.auth import Claims, require_afu
from core.db import get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Quotations"])

VALID_VEHICLE_TYPES = {"lorry_1t", "lorry_3t", "lorry_5t", "lorry_10t", "trailer_20", "trailer_40"}


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class TransportDetail(BaseModel):
    leg: str
    vehicle_type_id: str
    address: Optional[str] = None

    @validator("vehicle_type_id")
    def validate_vehicle_type(cls, v):
        if v not in VALID_VEHICLE_TYPES:
            raise ValueError(f"Invalid vehicle_type_id: {v}. Must be one of {sorted(VALID_VEHICLE_TYPES)}")
        return v


class CreateQuotationRequest(BaseModel):
    shipment_id: str
    scope_snapshot: Dict[str, str]
    transport_details: List[TransportDetail] = []
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# POST /quotations — Create quotation
# ---------------------------------------------------------------------------

@router.post("/quotations")
async def create_quotation(
    body: CreateQuotationRequest,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    # 1. Verify shipment exists and is not cancelled
    row = conn.execute(
        text("SELECT order_id, status FROM orders WHERE order_id = :sid"),
        {"sid": body.shipment_id},
    ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"Shipment {body.shipment_id} not found")
    if row[1] == -1:
        raise HTTPException(status_code=400, detail="Cannot create quotation for a cancelled shipment")

    # 2. Determine next revision number
    rev_row = conn.execute(
        text("SELECT COALESCE(MAX(revision), 0) + 1 FROM quotations WHERE shipment_id = :sid"),
        {"sid": body.shipment_id},
    ).fetchone()
    next_revision = rev_row[0]

    # 3. Generate quotation_ref
    seq_row = conn.execute(text("SELECT nextval('quotation_ref_seq')")).fetchone()
    quotation_ref = f"AFQ-{str(seq_row[0]).zfill(8)}"

    # 4. Insert
    scope_json = json.dumps(body.scope_snapshot)
    transport_json = json.dumps([td.dict() for td in body.transport_details])

    conn.execute(
        text("""
            INSERT INTO quotations (quotation_ref, shipment_id, revision, scope_snapshot,
                                    transport_details, notes, created_by)
            VALUES (:ref, :sid, :rev, CAST(:scope AS jsonb),
                    CAST(:transport AS jsonb), :notes, :created_by)
        """).bindparams(
            bindparam("scope", type_=String()),
            bindparam("transport", type_=String()),
        ),
        {
            "ref": quotation_ref,
            "sid": body.shipment_id,
            "rev": next_revision,
            "scope": scope_json,
            "transport": transport_json,
            "notes": body.notes,
            "created_by": claims.email,
        },
    )

    logger.info("[quotations] Created %s rev %d for shipment %s by %s",
                quotation_ref, next_revision, body.shipment_id, claims.email)

    return {"status": "OK", "data": {"quotation_ref": quotation_ref, "revision": next_revision}}


# ---------------------------------------------------------------------------
# GET /quotations?shipment_id={id} — List quotations for a shipment
# ---------------------------------------------------------------------------

@router.get("/quotations")
async def list_quotations(
    shipment_id: Optional[str] = Query(default=None),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    if shipment_id:
        rows = conn.execute(
            text("""
                SELECT id, quotation_ref, shipment_id, status, revision,
                       scope_snapshot, transport_details, notes, created_by,
                       created_at, updated_at
                FROM quotations
                WHERE shipment_id = :sid
                ORDER BY revision DESC
            """),
            {"sid": shipment_id},
        ).fetchall()
    else:
        rows = conn.execute(
            text("""
                SELECT id, quotation_ref, shipment_id, status, revision,
                       scope_snapshot, transport_details, notes, created_by,
                       created_at, updated_at
                FROM quotations
                ORDER BY created_at DESC
                LIMIT 200
            """),
        ).fetchall()

    data = []
    for r in rows:
        data.append({
            "id": str(r[0]),
            "quotation_ref": r[1],
            "shipment_id": r[2],
            "status": r[3],
            "revision": r[4],
            "scope_snapshot": r[5] if isinstance(r[5], dict) else {},
            "transport_details": r[6] if isinstance(r[6], list) else [],
            "notes": r[7],
            "created_by": r[8],
            "created_at": r[9].isoformat() if r[9] else None,
            "updated_at": r[10].isoformat() if r[10] else None,
        })

    return {"status": "OK", "data": data}


# ---------------------------------------------------------------------------
# GET /quotations/{quotation_ref} — Get single quotation
# ---------------------------------------------------------------------------

@router.get("/quotations/{quotation_ref}")
async def get_quotation(
    quotation_ref: str,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    row = conn.execute(
        text("""
            SELECT id, quotation_ref, shipment_id, status, revision,
                   scope_snapshot, transport_details, notes, created_by,
                   created_at, updated_at
            FROM quotations
            WHERE quotation_ref = :ref
        """),
        {"ref": quotation_ref},
    ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"Quotation {quotation_ref} not found")

    return {
        "status": "OK",
        "data": {
            "id": str(row[0]),
            "quotation_ref": row[1],
            "shipment_id": row[2],
            "status": row[3],
            "revision": row[4],
            "scope_snapshot": row[5] if isinstance(row[5], dict) else {},
            "transport_details": row[6] if isinstance(row[6], list) else [],
            "notes": row[7],
            "created_by": row[8],
            "created_at": row[9].isoformat() if row[9] else None,
            "updated_at": row[10].isoformat() if row[10] else None,
        },
    }
