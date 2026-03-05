"""
routers/ground_transport.py — Ground Transport CRUD endpoints.
"""

import json
import logging
import os
from datetime import date, datetime, timezone
from typing import List, Literal, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text

from core.auth import Claims, require_afu
from core.db import get_db
from core.db_queries import generate_transport_order_id
from core.exceptions import NotFoundError

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class LegCreate(BaseModel):
    leg_sequence: int
    leg_type: Literal["delivery", "pickup", "transfer", "return"]
    origin_city_id: Optional[int] = None
    origin_haulage_area_id: Optional[int] = None
    origin_address_line: Optional[str] = None
    origin_lat: Optional[float] = None
    origin_lng: Optional[float] = None
    dest_city_id: Optional[int] = None
    dest_haulage_area_id: Optional[int] = None
    dest_address_line: Optional[str] = None
    dest_lat: Optional[float] = None
    dest_lng: Optional[float] = None
    scheduled_date: Optional[date] = None
    notes: Optional[str] = None


class GroundTransportCreate(BaseModel):
    transport_type: Literal["haulage", "trucking"]
    leg_type: Literal["first_mile", "last_mile", "standalone", "distribution"]
    parent_shipment_id: Optional[str] = None
    vendor_id: Optional[str] = None
    cargo_description: Optional[str] = None
    container_numbers: List[str] = []
    weight_kg: Optional[float] = None
    volume_cbm: Optional[float] = None
    driver_name: Optional[str] = None
    driver_contact: Optional[str] = None
    vehicle_plate: Optional[str] = None
    equipment_type: Optional[str] = None
    equipment_number: Optional[str] = None
    detention_mode: Optional[Literal["direct", "detained"]] = None
    detention_free_days: Optional[int] = None
    container_yard_id: Optional[int] = None
    notes: Optional[str] = None
    vehicle_type_id: Optional[str] = None
    legs: List[LegCreate] = []


class GroundTransportUpdate(BaseModel):
    status: Optional[Literal["draft", "confirmed", "dispatched", "in_transit", "detained", "completed", "cancelled"]] = None
    vendor_id: Optional[str] = None
    cargo_description: Optional[str] = None
    container_numbers: Optional[List[str]] = None
    weight_kg: Optional[float] = None
    volume_cbm: Optional[float] = None
    driver_name: Optional[str] = None
    driver_contact: Optional[str] = None
    vehicle_plate: Optional[str] = None
    equipment_type: Optional[str] = None
    equipment_number: Optional[str] = None
    detention_mode: Optional[Literal["direct", "detained"]] = None
    detention_free_days: Optional[int] = None
    container_yard_id: Optional[int] = None
    notes: Optional[str] = None
    vehicle_type_id: Optional[str] = None


class LegUpdate(BaseModel):
    scheduled_date: Optional[date] = None
    actual_date: Optional[date] = None
    status: Optional[Literal["pending", "in_transit", "completed"]] = None
    origin_city_id: Optional[int] = None
    origin_haulage_area_id: Optional[int] = None
    origin_address_line: Optional[str] = None
    origin_lat: Optional[float] = None
    origin_lng: Optional[float] = None
    dest_city_id: Optional[int] = None
    dest_haulage_area_id: Optional[int] = None
    dest_address_line: Optional[str] = None
    dest_lat: Optional[float] = None
    dest_lng: Optional[float] = None
    notes: Optional[str] = None


class ScopeUpdate(BaseModel):
    first_mile_haulage: Optional[bool] = None
    first_mile_trucking: Optional[bool] = None
    export_clearance: Optional[bool] = None
    sea_freight: Optional[bool] = None
    import_clearance: Optional[bool] = None
    last_mile_haulage: Optional[bool] = None
    last_mile_trucking: Optional[bool] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _order_row_to_dict(row) -> dict:
    """Convert a ground_transport_orders row to dict."""
    return {
        "transport_order_id": row[0],
        "transport_type": row[1],
        "leg_type": row[2],
        "parent_shipment_id": row[3],
        "vendor_id": row[4],
        "status": row[5],
        "cargo_description": row[6],
        "container_numbers": row[7] if isinstance(row[7], list) else json.loads(row[7]) if isinstance(row[7], str) else [],
        "weight_kg": float(row[8]) if row[8] is not None else None,
        "volume_cbm": float(row[9]) if row[9] is not None else None,
        "driver_name": row[10],
        "driver_contact": row[11],
        "vehicle_plate": row[12],
        "equipment_type": row[13],
        "equipment_number": row[14],
        "detention_mode": row[15],
        "detention_free_days": row[16],
        "container_yard_id": row[17],
        "notes": row[18],
        "created_by": row[19],
        "created_at": str(row[20]) if row[20] else None,
        "updated_at": str(row[21]) if row[21] else None,
        "vehicle_type_id": row[22] if len(row) > 22 else None,
    }


_ORDER_SELECT = """
    SELECT transport_order_id, transport_type, leg_type, parent_shipment_id,
           vendor_id, status, cargo_description, container_numbers,
           weight_kg, volume_cbm, driver_name, driver_contact,
           vehicle_plate, equipment_type, equipment_number,
           detention_mode, detention_free_days, container_yard_id,
           notes, created_by, created_at, updated_at,
           vehicle_type_id
    FROM ground_transport_orders
"""


def _leg_row_to_dict(row) -> dict:
    """Convert a ground_transport_legs row to dict."""
    return {
        "leg_id": row[0],
        "transport_order_id": row[1],
        "leg_sequence": row[2],
        "leg_type": row[3],
        "origin_city_id": row[4],
        "origin_haulage_area_id": row[5],
        "origin_address_line": row[6],
        "origin_lat": float(row[7]) if row[7] is not None else None,
        "origin_lng": float(row[8]) if row[8] is not None else None,
        "dest_city_id": row[9],
        "dest_haulage_area_id": row[10],
        "dest_address_line": row[11],
        "dest_lat": float(row[12]) if row[12] is not None else None,
        "dest_lng": float(row[13]) if row[13] is not None else None,
        "scheduled_date": str(row[14]) if row[14] else None,
        "actual_date": str(row[15]) if row[15] else None,
        "status": row[16],
        "notes": row[17],
        "created_at": str(row[18]) if row[18] else None,
        "updated_at": str(row[19]) if row[19] else None,
    }


_LEG_SELECT = """
    SELECT leg_id, transport_order_id, leg_sequence, leg_type,
           origin_city_id, origin_haulage_area_id, origin_address_line, origin_lat, origin_lng,
           dest_city_id, dest_haulage_area_id, dest_address_line, dest_lat, dest_lng,
           scheduled_date, actual_date, status, notes, created_at, updated_at
    FROM ground_transport_legs
"""


def _get_legs(conn, transport_order_id: str) -> list[dict]:
    rows = conn.execute(text(f"""
        {_LEG_SELECT} WHERE transport_order_id = :id ORDER BY leg_sequence
    """), {"id": transport_order_id}).fetchall()
    return [_leg_row_to_dict(r) for r in rows]


# ---------------------------------------------------------------------------
# GET /vehicle-types — List active vehicle types
# ---------------------------------------------------------------------------

@router.get("/vehicle-types")
async def list_vehicle_types(
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Return all active vehicle types ordered by sort_order."""
    rows = conn.execute(text("""
        SELECT vehicle_type_id, label, category, sort_order
        FROM vehicle_types
        WHERE is_active = TRUE
        ORDER BY sort_order
    """)).fetchall()
    return {
        "status": "OK",
        "data": [
            {
                "vehicle_type_id": r[0],
                "label": r[1],
                "category": r[2],
                "sort_order": r[3],
            }
            for r in rows
        ],
    }


# ---------------------------------------------------------------------------
# POST / — Create ground transport order
# ---------------------------------------------------------------------------

@router.post("")
async def create_ground_transport_order(
    body: GroundTransportCreate,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Create a new ground transport order with optional legs."""
    order_id = generate_transport_order_id(conn)
    now = datetime.now(timezone.utc).isoformat()

    conn.execute(text("""
        INSERT INTO ground_transport_orders (
            transport_order_id, transport_type, leg_type, parent_shipment_id,
            vendor_id, status, cargo_description, container_numbers,
            weight_kg, volume_cbm, driver_name, driver_contact,
            vehicle_plate, equipment_type, equipment_number,
            detention_mode, detention_free_days, container_yard_id,
            notes, created_by, created_at, updated_at, vehicle_type_id
        ) VALUES (
            :id, :transport_type, :leg_type, :parent_shipment_id,
            :vendor_id, 'draft', :cargo_description, CAST(:container_numbers AS jsonb),
            :weight_kg, :volume_cbm, :driver_name, :driver_contact,
            :vehicle_plate, :equipment_type, :equipment_number,
            :detention_mode, :detention_free_days, :container_yard_id,
            :notes, :created_by, :now, :now, :vehicle_type_id
        )
    """), {
        "id": order_id,
        "transport_type": body.transport_type,
        "leg_type": body.leg_type,
        "parent_shipment_id": body.parent_shipment_id,
        "vendor_id": body.vendor_id,
        "cargo_description": body.cargo_description,
        "container_numbers": json.dumps(body.container_numbers),
        "weight_kg": body.weight_kg,
        "volume_cbm": body.volume_cbm,
        "driver_name": body.driver_name,
        "driver_contact": body.driver_contact,
        "vehicle_plate": body.vehicle_plate,
        "equipment_type": body.equipment_type,
        "equipment_number": body.equipment_number,
        "detention_mode": body.detention_mode,
        "detention_free_days": body.detention_free_days,
        "container_yard_id": body.container_yard_id,
        "notes": body.notes,
        "created_by": claims.email,
        "now": now,
        "vehicle_type_id": body.vehicle_type_id,
    })

    # Insert legs
    for leg in body.legs:
        conn.execute(text("""
            INSERT INTO ground_transport_legs (
                transport_order_id, leg_sequence, leg_type,
                origin_city_id, origin_haulage_area_id, origin_address_line, origin_lat, origin_lng,
                dest_city_id, dest_haulage_area_id, dest_address_line, dest_lat, dest_lng,
                scheduled_date, notes, created_at, updated_at
            ) VALUES (
                :order_id, :leg_sequence, :leg_type,
                :origin_city_id, :origin_haulage_area_id, :origin_address_line, :origin_lat, :origin_lng,
                :dest_city_id, :dest_haulage_area_id, :dest_address_line, :dest_lat, :dest_lng,
                :scheduled_date, :notes, :now, :now
            )
        """), {
            "order_id": order_id,
            "leg_sequence": leg.leg_sequence,
            "leg_type": leg.leg_type,
            "origin_city_id": leg.origin_city_id,
            "origin_haulage_area_id": leg.origin_haulage_area_id,
            "origin_address_line": leg.origin_address_line,
            "origin_lat": leg.origin_lat,
            "origin_lng": leg.origin_lng,
            "dest_city_id": leg.dest_city_id,
            "dest_haulage_area_id": leg.dest_haulage_area_id,
            "dest_address_line": leg.dest_address_line,
            "dest_lat": leg.dest_lat,
            "dest_lng": leg.dest_lng,
            "scheduled_date": str(leg.scheduled_date) if leg.scheduled_date else None,
            "notes": leg.notes,
            "now": now,
        })

    # Fetch the created record
    row = conn.execute(text(f"{_ORDER_SELECT} WHERE transport_order_id = :id"), {"id": order_id}).fetchone()
    order = _order_row_to_dict(row)
    order["legs"] = _get_legs(conn, order_id)

    logger.info("Ground transport order %s created by %s", order_id, claims.email)
    return {"status": "OK", "data": order}


# ---------------------------------------------------------------------------
# GET / — List ground transport orders
# ---------------------------------------------------------------------------

@router.get("")
async def list_ground_transport_orders(
    transport_type: Optional[Literal["haulage", "trucking"]] = Query(None),
    status: Optional[Literal["draft", "confirmed", "dispatched", "in_transit", "detained", "completed", "cancelled"]] = Query(None),
    parent_shipment_id: Optional[str] = Query(None),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """List ground transport orders with optional filters."""
    where = "1=1"
    params: dict = {}

    if transport_type:
        where += " AND transport_type = :transport_type"
        params["transport_type"] = transport_type
    if status:
        where += " AND status = :status"
        params["status"] = status
    if parent_shipment_id:
        where += " AND parent_shipment_id = :parent_shipment_id"
        params["parent_shipment_id"] = parent_shipment_id

    rows = conn.execute(text(f"""
        {_ORDER_SELECT} WHERE {where} ORDER BY created_at DESC
    """), params).fetchall()

    return {"status": "OK", "data": [_order_row_to_dict(r) for r in rows]}


# ---------------------------------------------------------------------------
# GET /{transport_order_id} — Get single order with legs
# ---------------------------------------------------------------------------

@router.get("/{transport_order_id}")
async def get_ground_transport_order(
    transport_order_id: str,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Get a single ground transport order with all legs."""
    row = conn.execute(text(f"{_ORDER_SELECT} WHERE transport_order_id = :id"), {"id": transport_order_id}).fetchone()
    if not row:
        raise NotFoundError(f"Transport order {transport_order_id} not found")

    order = _order_row_to_dict(row)
    order["legs"] = _get_legs(conn, transport_order_id)
    return {"status": "OK", "data": order}


# ---------------------------------------------------------------------------
# PATCH /{transport_order_id} — Update order
# ---------------------------------------------------------------------------

@router.patch("/{transport_order_id}")
async def update_ground_transport_order(
    transport_order_id: str,
    body: GroundTransportUpdate,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Partial update on a ground transport order."""
    sent = body.__fields_set__
    if not sent:
        raise HTTPException(status_code=400, detail="No fields provided for update")

    row = conn.execute(text("SELECT transport_order_id FROM ground_transport_orders WHERE transport_order_id = :id"),
                       {"id": transport_order_id}).fetchone()
    if not row:
        raise NotFoundError(f"Transport order {transport_order_id} not found")

    set_clauses = ["updated_at = :now"]
    params: dict = {"now": datetime.now(timezone.utc).isoformat(), "id": transport_order_id}

    field_col_map = {
        "status": "status",
        "vendor_id": "vendor_id",
        "cargo_description": "cargo_description",
        "weight_kg": "weight_kg",
        "volume_cbm": "volume_cbm",
        "driver_name": "driver_name",
        "driver_contact": "driver_contact",
        "vehicle_plate": "vehicle_plate",
        "equipment_type": "equipment_type",
        "equipment_number": "equipment_number",
        "detention_mode": "detention_mode",
        "detention_free_days": "detention_free_days",
        "container_yard_id": "container_yard_id",
        "notes": "notes",
        "vehicle_type_id": "vehicle_type_id",
    }

    for field, col in field_col_map.items():
        if field in sent:
            set_clauses.append(f"{col} = :{field}")
            params[field] = getattr(body, field)

    if "container_numbers" in sent:
        set_clauses.append("container_numbers = CAST(:container_numbers AS jsonb)")
        params["container_numbers"] = json.dumps(body.container_numbers or [])

    conn.execute(text(f"""
        UPDATE ground_transport_orders SET {', '.join(set_clauses)} WHERE transport_order_id = :id
    """), params)

    updated = conn.execute(text(f"{_ORDER_SELECT} WHERE transport_order_id = :id"), {"id": transport_order_id}).fetchone()
    order = _order_row_to_dict(updated)
    order["legs"] = _get_legs(conn, transport_order_id)

    return {"status": "OK", "data": order}


# ---------------------------------------------------------------------------
# DELETE /{transport_order_id} — Soft cancel
# ---------------------------------------------------------------------------

@router.delete("/{transport_order_id}")
async def cancel_ground_transport_order(
    transport_order_id: str,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Soft cancel a ground transport order (sets status to cancelled)."""
    row = conn.execute(text("SELECT transport_order_id FROM ground_transport_orders WHERE transport_order_id = :id"),
                       {"id": transport_order_id}).fetchone()
    if not row:
        raise NotFoundError(f"Transport order {transport_order_id} not found")

    conn.execute(text("""
        UPDATE ground_transport_orders SET status = 'cancelled', updated_at = :now WHERE transport_order_id = :id
    """), {"now": datetime.now(timezone.utc).isoformat(), "id": transport_order_id})

    updated = conn.execute(text(f"{_ORDER_SELECT} WHERE transport_order_id = :id"), {"id": transport_order_id}).fetchone()
    return {"status": "OK", "data": _order_row_to_dict(updated)}


# ---------------------------------------------------------------------------
# POST /{transport_order_id}/legs — Add a leg
# ---------------------------------------------------------------------------

@router.post("/{transport_order_id}/legs")
async def add_leg(
    transport_order_id: str,
    body: LegCreate,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Add a leg to an existing ground transport order."""
    row = conn.execute(text("SELECT transport_order_id FROM ground_transport_orders WHERE transport_order_id = :id"),
                       {"id": transport_order_id}).fetchone()
    if not row:
        raise NotFoundError(f"Transport order {transport_order_id} not found")

    now = datetime.now(timezone.utc).isoformat()
    conn.execute(text("""
        INSERT INTO ground_transport_legs (
            transport_order_id, leg_sequence, leg_type,
            origin_city_id, origin_haulage_area_id, origin_address_line, origin_lat, origin_lng,
            dest_city_id, dest_haulage_area_id, dest_address_line, dest_lat, dest_lng,
            scheduled_date, notes, created_at, updated_at
        ) VALUES (
            :order_id, :leg_sequence, :leg_type,
            :origin_city_id, :origin_haulage_area_id, :origin_address_line, :origin_lat, :origin_lng,
            :dest_city_id, :dest_haulage_area_id, :dest_address_line, :dest_lat, :dest_lng,
            :scheduled_date, :notes, :now, :now
        )
    """), {
        "order_id": transport_order_id,
        "leg_sequence": body.leg_sequence,
        "leg_type": body.leg_type,
        "origin_city_id": body.origin_city_id,
        "origin_haulage_area_id": body.origin_haulage_area_id,
        "origin_address_line": body.origin_address_line,
        "origin_lat": body.origin_lat,
        "origin_lng": body.origin_lng,
        "dest_city_id": body.dest_city_id,
        "dest_haulage_area_id": body.dest_haulage_area_id,
        "dest_address_line": body.dest_address_line,
        "dest_lat": body.dest_lat,
        "dest_lng": body.dest_lng,
        "scheduled_date": str(body.scheduled_date) if body.scheduled_date else None,
        "notes": body.notes,
        "now": now,
    })

    legs = _get_legs(conn, transport_order_id)
    return {"status": "OK", "data": legs}


# ---------------------------------------------------------------------------
# PATCH /{transport_order_id}/legs/{leg_id} — Update a leg
# ---------------------------------------------------------------------------

@router.patch("/{transport_order_id}/legs/{leg_id}")
async def update_leg(
    transport_order_id: str,
    leg_id: int,
    body: LegUpdate,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Partial update on a single leg."""
    sent = body.__fields_set__
    if not sent:
        raise HTTPException(status_code=400, detail="No fields provided for update")

    row = conn.execute(text("""
        SELECT leg_id FROM ground_transport_legs WHERE leg_id = :leg_id AND transport_order_id = :order_id
    """), {"leg_id": leg_id, "order_id": transport_order_id}).fetchone()
    if not row:
        raise NotFoundError(f"Leg {leg_id} not found on order {transport_order_id}")

    set_clauses = ["updated_at = :now"]
    params: dict = {"now": datetime.now(timezone.utc).isoformat(), "leg_id": leg_id}

    field_col_map = {
        "scheduled_date": "scheduled_date",
        "actual_date": "actual_date",
        "status": "status",
        "origin_city_id": "origin_city_id",
        "origin_haulage_area_id": "origin_haulage_area_id",
        "origin_address_line": "origin_address_line",
        "origin_lat": "origin_lat",
        "origin_lng": "origin_lng",
        "dest_city_id": "dest_city_id",
        "dest_haulage_area_id": "dest_haulage_area_id",
        "dest_address_line": "dest_address_line",
        "dest_lat": "dest_lat",
        "dest_lng": "dest_lng",
        "notes": "notes",
    }

    for field, col in field_col_map.items():
        if field in sent:
            val = getattr(body, field)
            if isinstance(val, date):
                val = str(val)
            set_clauses.append(f"{col} = :{field}")
            params[field] = val

    conn.execute(text(f"""
        UPDATE ground_transport_legs SET {', '.join(set_clauses)} WHERE leg_id = :leg_id
    """), params)

    legs = _get_legs(conn, transport_order_id)
    return {"status": "OK", "data": legs}


# ---------------------------------------------------------------------------
# GET /shipment/{shipment_id}/reconcile — Reconcile GT against shipment scope
# ---------------------------------------------------------------------------

# Mapping from scope flag key to leg_type value on ground_transport_orders
_SCOPE_TO_LEG_TYPE = {
    "first_mile_haulage": "first_mile",
    "first_mile_trucking": "first_mile",
    "last_mile_haulage": "last_mile",
    "last_mile_trucking": "last_mile",
}

# Mapping from scope flag key to transport_type
_SCOPE_TO_TRANSPORT_TYPE = {
    "first_mile_haulage": "haulage",
    "first_mile_trucking": "trucking",
    "last_mile_haulage": "haulage",
    "last_mile_trucking": "trucking",
}


@router.get("/shipment/{shipment_id}/reconcile")
async def reconcile_shipment_ground_transport(
    shipment_id: str,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Reconcile ground transport orders against a shipment's scope flags."""
    row = conn.execute(text("SELECT scope FROM shipments WHERE id = :id AND trash = FALSE"),
                       {"id": shipment_id}).fetchone()
    if not row:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    scope = row[0] if isinstance(row[0], dict) else json.loads(row[0]) if isinstance(row[0], str) else {}

    # Fetch linked GT orders
    order_rows = conn.execute(text(f"""
        {_ORDER_SELECT} WHERE parent_shipment_id = :id AND status != 'cancelled' ORDER BY created_at
    """), {"id": shipment_id}).fetchall()

    orders = []
    for r in order_rows:
        o = _order_row_to_dict(r)
        o["legs"] = _get_legs(conn, o["transport_order_id"])
        orders.append(o)

    # Compute gaps: scope flags that are true but have no matching linked order
    gaps = []
    for flag_key, is_in_scope in scope.items():
        if not is_in_scope:
            continue
        expected_leg_type = _SCOPE_TO_LEG_TYPE.get(flag_key)
        expected_transport_type = _SCOPE_TO_TRANSPORT_TYPE.get(flag_key)
        if expected_leg_type is None:
            continue
        has_match = any(
            o["leg_type"] == expected_leg_type and o["transport_type"] == expected_transport_type
            for o in orders
        )
        if not has_match:
            gaps.append(flag_key)

    return {"status": "OK", "data": {"scope": scope, "orders": orders, "gaps": gaps}}


# ---------------------------------------------------------------------------
# PATCH /shipment/{shipment_id}/scope — Update scope flags
# ---------------------------------------------------------------------------

@router.patch("/shipment/{shipment_id}/scope")
async def update_shipment_scope(
    shipment_id: str,
    body: ScopeUpdate,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Update scope flags on a shipment (partial merge)."""
    sent = body.__fields_set__
    if not sent:
        raise HTTPException(status_code=400, detail="No fields provided for update")

    row = conn.execute(text("SELECT scope FROM shipments WHERE id = :id AND trash = FALSE"),
                       {"id": shipment_id}).fetchone()
    if not row:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    scope = row[0] if isinstance(row[0], dict) else json.loads(row[0]) if isinstance(row[0], str) else {}

    for field in sent:
        scope[field] = getattr(body, field)

    conn.execute(text("""
        UPDATE shipments SET scope = CAST(:scope AS jsonb), updated_at = :now WHERE id = :id
    """), {"scope": json.dumps(scope), "now": datetime.now(timezone.utc).isoformat(), "id": shipment_id})

    return {"status": "OK", "data": scope}


# ---------------------------------------------------------------------------
# GET /geocode/autocomplete — Places API (New) autocomplete
# ---------------------------------------------------------------------------

@router.get("/geocode/autocomplete")
async def autocomplete_address(
    input: str = Query(..., min_length=3),
    sessiontoken: Optional[str] = Query(None),
    claims: Claims = Depends(require_afu),
):
    """Return up to 5 place suggestions from Places API (New)."""
    api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
    if not api_key:
        logger.warning("[autocomplete] GOOGLE_MAPS_API_KEY not set")
        return {"status": "OK", "data": []}

    try:
        body: dict = {
            "input": input,
        }
        if sessiontoken:
            body["sessionToken"] = sessiontoken

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://places.googleapis.com/v1/places:autocomplete",
                json=body,
                headers={
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": api_key,
                },
            )
            data = resp.json()

        suggestions = data.get("suggestions", [])[:5]
        results = []
        for s in suggestions:
            pp = s.get("placePrediction", {})
            place_id = pp.get("placeId")
            description = pp.get("text", {}).get("text")
            if place_id and description:
                results.append({"place_id": place_id, "description": description})

        return {"status": "OK", "data": results}
    except Exception as e:
        logger.warning("[autocomplete] Error: %s", e)
        return {"status": "OK", "data": []}


# ---------------------------------------------------------------------------
# GET /geocode/place — Place Details via Places API (New)
# ---------------------------------------------------------------------------

@router.get("/geocode/place")
async def get_place_details(
    place_id: str = Query(...),
    sessiontoken: Optional[str] = Query(None),
    claims: Claims = Depends(require_afu),
):
    """Resolve a place_id to coordinates and address components."""
    empty = {"lat": None, "lng": None, "formatted_address": None, "city": None, "state": None, "country": None}

    api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
    if not api_key:
        logger.warning("[place_details] GOOGLE_MAPS_API_KEY not set")
        return {"status": "OK", "data": empty}

    try:
        params = {}
        if sessiontoken:
            params["sessionToken"] = sessiontoken

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"https://places.googleapis.com/v1/places/{place_id}",
                params=params,
                headers={
                    "X-Goog-Api-Key": api_key,
                    "X-Goog-FieldMask": "location,formattedAddress,addressComponents",
                },
            )
            data = resp.json()

        location = data.get("location", {})
        lat = location.get("latitude")
        lng = location.get("longitude")
        formatted_address = data.get("formattedAddress")

        city = None
        state = None
        country = None
        for comp in data.get("addressComponents", []):
            types = comp.get("types", [])
            if "locality" in types:
                city = comp.get("longText")
            elif "administrative_area_level_1" in types:
                state = comp.get("longText")
            elif "country" in types:
                country = comp.get("shortText")

        return {"status": "OK", "data": {
            "lat": lat,
            "lng": lng,
            "formatted_address": formatted_address,
            "city": city,
            "state": state,
            "country": country,
        }}
    except Exception as e:
        logger.error("[place_details] Error: %s", e)
        return {"status": "OK", "data": empty}


# ---------------------------------------------------------------------------
# GET /geocode — Geocode an address via Google Maps
# ---------------------------------------------------------------------------

@router.get("/geocode")
async def geocode_address(
    address: str = Query(..., min_length=3),
    claims: Claims = Depends(require_afu),
):
    """Geocode an address string via Google Maps Geocoding API."""
    empty = {"lat": None, "lng": None, "formatted_address": None, "city": None, "state": None, "country": None}

    api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
    if not api_key:
        logger.warning("[geocode] GOOGLE_MAPS_API_KEY not set")
        return {"status": "OK", "data": empty}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params={"address": address, "key": api_key},
            )
            data = resp.json()

        if data.get("status") != "OK" or not data.get("results"):
            return {"status": "OK", "data": empty}

        result = data["results"][0]
        location = result.get("geometry", {}).get("location", {})

        # Extract city, state, country from address components
        city = None
        state = None
        country = None
        for comp in result.get("address_components", []):
            types = comp.get("types", [])
            if "locality" in types:
                city = comp.get("long_name")
            elif "administrative_area_level_1" in types:
                state = comp.get("long_name")
            elif "country" in types:
                country = comp.get("short_name")

        return {"status": "OK", "data": {
            "lat": location.get("lat"),
            "lng": location.get("lng"),
            "formatted_address": result.get("formatted_address"),
            "city": city,
            "state": state,
            "country": country,
        }}
    except Exception as e:
        logger.error("[geocode] Error: %s", e)
        return {"status": "OK", "data": empty}
