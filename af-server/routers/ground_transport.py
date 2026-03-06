"""
routers/ground_transport.py — Ground Transport CRUD endpoints.

Unified orders architecture: transport orders use orders + order_stops + order_legs.
Stops are the source of truth; legs are auto-derived between consecutive stops.
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

class StopCreate(BaseModel):
    sequence: int
    stop_type: Literal["pickup", "dropoff", "waypoint"]
    address_line: Optional[str] = None
    area_id: Optional[int] = None
    city_id: Optional[int] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    scheduled_arrival: Optional[date] = None
    notes: Optional[str] = None


class StopUpdate(BaseModel):
    stop_type: Optional[Literal["pickup", "dropoff", "waypoint"]] = None
    address_line: Optional[str] = None
    area_id: Optional[int] = None
    city_id: Optional[int] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    scheduled_arrival: Optional[date] = None
    actual_arrival: Optional[date] = None
    notes: Optional[str] = None


class GroundTransportCreate(BaseModel):
    transport_mode: Literal["haulage", "trucking"]
    leg_type: Literal["first_mile", "last_mile", "standalone", "distribution"]
    parent_order_id: Optional[str] = None
    vendor_id: Optional[str] = None
    cargo_description: Optional[str] = None
    container_numbers: List[str] = []
    weight_kg: Optional[float] = None
    volume_cbm: Optional[float] = None
    vehicle_type_id: Optional[str] = None
    equipment_type: Optional[str] = None
    equipment_number: Optional[str] = None
    detention_mode: Optional[Literal["direct", "detained"]] = None
    detention_free_days: Optional[int] = None
    notes: Optional[str] = None
    stops: List[StopCreate] = []
    is_test: bool = False


class GroundTransportUpdate(BaseModel):
    status: Optional[Literal["draft", "confirmed", "dispatched", "in_transit", "detained", "completed", "cancelled"]] = None
    sub_status: Optional[str] = None
    vendor_id: Optional[str] = None
    cargo_description: Optional[str] = None
    container_numbers: Optional[List[str]] = None
    weight_kg: Optional[float] = None
    volume_cbm: Optional[float] = None
    vehicle_type_id: Optional[str] = None
    equipment_type: Optional[str] = None
    equipment_number: Optional[str] = None
    detention_mode: Optional[Literal["direct", "detained"]] = None
    detention_free_days: Optional[int] = None
    notes: Optional[str] = None


class LegUpdate(BaseModel):
    driver_name: Optional[str] = None
    driver_contact: Optional[str] = None
    vehicle_plate: Optional[str] = None
    vehicle_type_id: Optional[str] = None
    equipment_type: Optional[str] = None
    equipment_number: Optional[str] = None
    status: Optional[Literal["pending", "in_transit", "completed"]] = None
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

def _parse_cargo(val) -> dict:
    """Parse cargo JSONB into a flat cargo dict."""
    if val is None:
        return {}
    if isinstance(val, dict):
        return val
    if isinstance(val, str):
        try:
            return json.loads(val)
        except (ValueError, TypeError):
            return {}
    return {}


def _order_row_to_dict(row) -> dict:
    """Convert an orders row (transport) to API dict."""
    cols = row._mapping
    data = dict(cols)
    cargo = _parse_cargo(data.get("cargo"))
    return {
        "order_id": data["order_id"],
        "transport_mode": data.get("transport_mode"),
        "leg_type": data.get("leg_type"),
        "parent_order_id": data.get("parent_order_id"),
        "vendor_id": data.get("vendor_id"),
        "status": data.get("status"),
        "sub_status": data.get("sub_status"),
        "cargo_description": cargo.get("description"),
        "container_numbers": cargo.get("container_numbers", []),
        "weight_kg": float(cargo["weight_kg"]) if cargo.get("weight_kg") is not None else None,
        "volume_cbm": float(cargo["volume_cbm"]) if cargo.get("volume_cbm") is not None else None,
        "detention_mode": data.get("detention_mode"),
        "detention_free_days": data.get("detention_free_days"),
        "notes": data.get("notes"),
        "created_by": data.get("created_by"),
        "created_at": str(data["created_at"]) if data.get("created_at") else None,
        "updated_at": str(data["updated_at"]) if data.get("updated_at") else None,
        "is_test": data.get("is_test") or False,
        "trash": data.get("trash") or False,
    }


_ORDER_SELECT = """
    SELECT order_id, transport_mode, leg_type, parent_order_id,
           vendor_id, status, sub_status, cargo,
           detention_mode, detention_free_days,
           notes, created_by, created_at, updated_at, is_test, trash
    FROM orders
"""


def _stop_row_to_dict(row) -> dict:
    """Convert an order_stops row to dict."""
    cols = row._mapping
    data = dict(cols)
    return {
        "stop_id": data["stop_id"],
        "order_id": data["order_id"],
        "sequence": data["sequence"],
        "stop_type": data["stop_type"],
        "address_line": data.get("address_line"),
        "area_id": data.get("area_id"),
        "city_id": data.get("city_id"),
        "lat": float(data["lat"]) if data.get("lat") is not None else None,
        "lng": float(data["lng"]) if data.get("lng") is not None else None,
        "scheduled_arrival": str(data["scheduled_arrival"]) if data.get("scheduled_arrival") else None,
        "actual_arrival": str(data["actual_arrival"]) if data.get("actual_arrival") else None,
        "notes": data.get("notes"),
    }


def _leg_row_to_dict(row) -> dict:
    """Convert an order_legs row to dict."""
    cols = row._mapping
    data = dict(cols)
    return {
        "leg_id": data["leg_id"],
        "order_id": data["order_id"],
        "from_stop_id": data["from_stop_id"],
        "to_stop_id": data["to_stop_id"],
        "sequence": data["sequence"],
        "driver_name": data.get("driver_name"),
        "driver_contact": data.get("driver_contact"),
        "vehicle_plate": data.get("vehicle_plate"),
        "vehicle_type_id": data.get("vehicle_type_id"),
        "equipment_type": data.get("equipment_type"),
        "equipment_number": data.get("equipment_number"),
        "status": data.get("status"),
        "notes": data.get("notes"),
    }


def _get_stops(conn, order_id: str) -> list[dict]:
    rows = conn.execute(text("""
        SELECT * FROM order_stops WHERE order_id = :id ORDER BY sequence
    """), {"id": order_id}).fetchall()
    return [_stop_row_to_dict(r) for r in rows]


def _get_legs(conn, order_id: str) -> list[dict]:
    rows = conn.execute(text("""
        SELECT * FROM order_legs WHERE order_id = :id ORDER BY sequence
    """), {"id": order_id}).fetchall()
    return [_leg_row_to_dict(r) for r in rows]


def _derive_legs(conn, order_id: str):
    """Re-derive all legs from current stops for an order.
    Deletes existing legs and recreates from stop pairs."""
    conn.execute(text("DELETE FROM order_legs WHERE order_id = :id"), {"id": order_id})
    stops = conn.execute(text("""
        SELECT stop_id, sequence FROM order_stops
        WHERE order_id = :id ORDER BY sequence
    """), {"id": order_id}).fetchall()
    for i in range(len(stops) - 1):
        conn.execute(text("""
            INSERT INTO order_legs (order_id, from_stop_id, to_stop_id, sequence, status)
            VALUES (:order_id, :from_stop, :to_stop, :seq, 'pending')
        """), {
            "order_id": order_id,
            "from_stop": stops[i][0],
            "to_stop": stops[i + 1][0],
            "seq": i + 1,
        })


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
    """Create a new ground transport order with stops. Legs are auto-derived."""
    order_id = generate_transport_order_id(conn)
    now = datetime.now(timezone.utc).isoformat()

    # Build cargo JSONB
    cargo = {
        "description": body.cargo_description,
        "container_numbers": body.container_numbers,
        "weight_kg": body.weight_kg,
        "volume_cbm": body.volume_cbm,
    }

    conn.execute(text("""
        INSERT INTO orders (
            order_id, order_type, transport_mode, status,
            leg_type, parent_order_id, vendor_id,
            cargo, detention_mode, detention_free_days, notes,
            created_by, created_at, updated_at, trash, is_test
        ) VALUES (
            :id, 'transport', :transport_mode, 'draft',
            :leg_type, :parent_order_id, :vendor_id,
            CAST(:cargo AS jsonb), :detention_mode, :detention_free_days, :notes,
            :created_by, :now, :now, FALSE, :is_test
        )
    """), {
        "id": order_id,
        "transport_mode": body.transport_mode,
        "leg_type": body.leg_type,
        "parent_order_id": body.parent_order_id,
        "vendor_id": body.vendor_id,
        "cargo": json.dumps(cargo),
        "detention_mode": body.detention_mode,
        "detention_free_days": body.detention_free_days,
        "notes": body.notes,
        "created_by": claims.email,
        "now": now,
        "is_test": body.is_test,
    })

    # Insert stops
    for stop in body.stops:
        conn.execute(text("""
            INSERT INTO order_stops (
                order_id, sequence, stop_type,
                address_line, area_id, city_id, lat, lng,
                scheduled_arrival, notes, created_at, updated_at
            ) VALUES (
                :order_id, :sequence, :stop_type,
                :address_line, :area_id, :city_id, :lat, :lng,
                :scheduled_arrival, :notes, :now, :now
            )
        """), {
            "order_id": order_id,
            "sequence": stop.sequence,
            "stop_type": stop.stop_type,
            "address_line": stop.address_line,
            "area_id": stop.area_id,
            "city_id": stop.city_id,
            "lat": stop.lat,
            "lng": stop.lng,
            "scheduled_arrival": str(stop.scheduled_arrival) if stop.scheduled_arrival else None,
            "notes": stop.notes,
            "now": now,
        })

    # Auto-derive legs from stops
    _derive_legs(conn, order_id)

    # Fetch the created record
    row = conn.execute(text(f"""
        {_ORDER_SELECT} WHERE order_id = :id AND order_type = 'transport'
    """), {"id": order_id}).fetchone()
    order = _order_row_to_dict(row)
    order["stops"] = _get_stops(conn, order_id)
    order["legs"] = _get_legs(conn, order_id)

    logger.info("Transport order %s created by %s", order_id, claims.email)
    return {"status": "OK", "data": order}


# ---------------------------------------------------------------------------
# GET / — List ground transport orders
# ---------------------------------------------------------------------------

@router.get("")
async def list_ground_transport_orders(
    transport_type: Optional[Literal["haulage", "trucking"]] = Query(None, alias="transport_type"),
    transport_mode: Optional[Literal["haulage", "trucking"]] = Query(None),
    status: Optional[Literal["draft", "confirmed", "dispatched", "in_transit", "detained", "completed", "cancelled"]] = Query(None),
    parent_shipment_id: Optional[str] = Query(None, alias="parent_shipment_id"),
    parent_order_id: Optional[str] = Query(None),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """List ground transport orders with optional filters."""
    where = "order_type = 'transport' AND trash = FALSE"
    params: dict = {}

    # Support both old (transport_type) and new (transport_mode) param names
    mode = transport_mode or transport_type
    if mode:
        where += " AND transport_mode = :transport_mode"
        params["transport_mode"] = mode
    if status:
        where += " AND status = :status"
        params["status"] = status
    # Support both old (parent_shipment_id) and new (parent_order_id) param names
    parent = parent_order_id or parent_shipment_id
    if parent:
        where += " AND parent_order_id = :parent_order_id"
        params["parent_order_id"] = parent

    rows = conn.execute(text(f"""
        {_ORDER_SELECT} WHERE {where} ORDER BY created_at DESC
    """), params).fetchall()

    return {"status": "OK", "data": [_order_row_to_dict(r) for r in rows]}


# ---------------------------------------------------------------------------
# GET /{order_id} — Get single order with stops and legs
# ---------------------------------------------------------------------------

@router.get("/{order_id}")
async def get_ground_transport_order(
    order_id: str,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Get a single ground transport order with all stops and legs."""
    row = conn.execute(text(f"""
        {_ORDER_SELECT} WHERE order_id = :id AND order_type = 'transport'
    """), {"id": order_id}).fetchone()
    if not row:
        raise NotFoundError(f"Transport order {order_id} not found")

    order = _order_row_to_dict(row)
    order["stops"] = _get_stops(conn, order_id)
    order["legs"] = _get_legs(conn, order_id)
    return {"status": "OK", "data": order}


# ---------------------------------------------------------------------------
# PATCH /{order_id} — Update order
# ---------------------------------------------------------------------------

@router.patch("/{order_id}")
async def update_ground_transport_order(
    order_id: str,
    body: GroundTransportUpdate,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Partial update on a ground transport order."""
    sent = body.__fields_set__
    if not sent:
        raise HTTPException(status_code=400, detail="No fields provided for update")

    row = conn.execute(text(
        "SELECT order_id FROM orders WHERE order_id = :id AND order_type = 'transport'"
    ), {"id": order_id}).fetchone()
    if not row:
        raise NotFoundError(f"Transport order {order_id} not found")

    set_clauses = ["updated_at = :now"]
    params: dict = {"now": datetime.now(timezone.utc).isoformat(), "id": order_id}

    # Direct column updates on orders table
    direct_fields = {
        "status": "status",
        "sub_status": "sub_status",
        "vendor_id": "vendor_id",
        "detention_mode": "detention_mode",
        "detention_free_days": "detention_free_days",
        "notes": "notes",
    }
    for field, col in direct_fields.items():
        if field in sent:
            set_clauses.append(f"{col} = :{field}")
            params[field] = getattr(body, field)

    # Cargo JSONB — merge changes
    cargo_fields = {"cargo_description", "container_numbers", "weight_kg", "volume_cbm",
                    "vehicle_type_id", "equipment_type", "equipment_number"}
    if sent & cargo_fields:
        cargo_row = conn.execute(text(
            "SELECT cargo FROM orders WHERE order_id = :id"
        ), {"id": order_id}).fetchone()
        cargo = _parse_cargo(cargo_row[0]) if cargo_row else {}

        if "cargo_description" in sent:
            cargo["description"] = body.cargo_description
        if "container_numbers" in sent:
            cargo["container_numbers"] = body.container_numbers or []
        if "weight_kg" in sent:
            cargo["weight_kg"] = body.weight_kg
        if "volume_cbm" in sent:
            cargo["volume_cbm"] = body.volume_cbm
        if "vehicle_type_id" in sent:
            cargo["vehicle_type_id"] = body.vehicle_type_id
        if "equipment_type" in sent:
            cargo["equipment_type"] = body.equipment_type
        if "equipment_number" in sent:
            cargo["equipment_number"] = body.equipment_number

        set_clauses.append("cargo = CAST(:cargo AS jsonb)")
        params["cargo"] = json.dumps(cargo)

    conn.execute(text(f"""
        UPDATE orders SET {', '.join(set_clauses)} WHERE order_id = :id
    """), params)

    updated = conn.execute(text(f"""
        {_ORDER_SELECT} WHERE order_id = :id AND order_type = 'transport'
    """), {"id": order_id}).fetchone()
    order = _order_row_to_dict(updated)
    order["stops"] = _get_stops(conn, order_id)
    order["legs"] = _get_legs(conn, order_id)

    return {"status": "OK", "data": order}


# ---------------------------------------------------------------------------
# DELETE /{order_id} — Soft cancel
# ---------------------------------------------------------------------------

@router.delete("/{order_id}")
async def cancel_ground_transport_order(
    order_id: str,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Soft cancel a ground transport order (sets status to cancelled)."""
    row = conn.execute(text(
        "SELECT order_id FROM orders WHERE order_id = :id AND order_type = 'transport'"
    ), {"id": order_id}).fetchone()
    if not row:
        raise NotFoundError(f"Transport order {order_id} not found")

    conn.execute(text("""
        UPDATE orders SET status = 'cancelled', updated_at = :now WHERE order_id = :id
    """), {"now": datetime.now(timezone.utc).isoformat(), "id": order_id})

    updated = conn.execute(text(f"""
        {_ORDER_SELECT} WHERE order_id = :id AND order_type = 'transport'
    """), {"id": order_id}).fetchone()
    return {"status": "OK", "data": _order_row_to_dict(updated)}


# ---------------------------------------------------------------------------
# DELETE /{order_id}/delete — Soft/hard delete
# ---------------------------------------------------------------------------

@router.delete("/{order_id}/delete")
async def delete_ground_transport_order(
    order_id: str,
    hard: bool = Query(False),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """
    Soft delete (trash=TRUE) or hard delete a ground transport order.
    Hard delete is only permitted for orders with status 'draft' or 'cancelled'.
    AFU only.
    """
    row = conn.execute(text(
        "SELECT order_id, status, trash FROM orders WHERE order_id = :id AND order_type = 'transport'"
    ), {"id": order_id}).fetchone()
    if not row:
        raise NotFoundError(f"Transport order {order_id} not found")

    order_status = row[1]
    is_trashed = row[2]
    now = datetime.now(timezone.utc).isoformat()

    if hard:
        # Hard delete only permitted for draft or cancelled orders
        if order_status not in ("draft", "cancelled"):
            raise HTTPException(
                status_code=400,
                detail=f"Hard delete only permitted for draft or cancelled orders. Current status: {order_status}"
            )
        # Delete child records first
        conn.execute(text("DELETE FROM order_legs WHERE order_id = :id"), {"id": order_id})
        conn.execute(text("DELETE FROM order_stops WHERE order_id = :id"), {"id": order_id})
        conn.execute(text("DELETE FROM orders WHERE order_id = :id"), {"id": order_id})
        logger.info("Transport order %s hard-deleted by %s", order_id, claims.email)
        return {"deleted": True, "order_id": order_id, "mode": "hard"}
    else:
        # Soft delete
        if is_trashed:
            raise HTTPException(status_code=400, detail="Order already in trash")
        conn.execute(text("""
            UPDATE orders SET trash = TRUE, updated_at = :now WHERE order_id = :id
        """), {"id": order_id, "now": now})
        logger.info("Transport order %s soft-deleted by %s", order_id, claims.email)
        return {"deleted": True, "order_id": order_id, "mode": "soft"}


# ---------------------------------------------------------------------------
# POST /{order_id}/stops — Add a stop (and re-derive legs)
# ---------------------------------------------------------------------------

@router.post("/{order_id}/stops")
async def add_stop(
    order_id: str,
    body: StopCreate,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Add a stop to an existing transport order. Legs are auto-re-derived."""
    row = conn.execute(text(
        "SELECT order_id FROM orders WHERE order_id = :id AND order_type = 'transport'"
    ), {"id": order_id}).fetchone()
    if not row:
        raise NotFoundError(f"Transport order {order_id} not found")

    now = datetime.now(timezone.utc).isoformat()
    conn.execute(text("""
        INSERT INTO order_stops (
            order_id, sequence, stop_type,
            address_line, area_id, city_id, lat, lng,
            scheduled_arrival, notes, created_at, updated_at
        ) VALUES (
            :order_id, :sequence, :stop_type,
            :address_line, :area_id, :city_id, :lat, :lng,
            :scheduled_arrival, :notes, :now, :now
        )
    """), {
        "order_id": order_id,
        "sequence": body.sequence,
        "stop_type": body.stop_type,
        "address_line": body.address_line,
        "area_id": body.area_id,
        "city_id": body.city_id,
        "lat": body.lat,
        "lng": body.lng,
        "scheduled_arrival": str(body.scheduled_arrival) if body.scheduled_arrival else None,
        "notes": body.notes,
        "now": now,
    })

    # Re-derive legs
    _derive_legs(conn, order_id)

    stops = _get_stops(conn, order_id)
    legs = _get_legs(conn, order_id)
    return {"status": "OK", "data": {"stops": stops, "legs": legs}}


# ---------------------------------------------------------------------------
# PATCH /{order_id}/stops/{stop_id} — Update a stop
# ---------------------------------------------------------------------------

@router.patch("/{order_id}/stops/{stop_id}")
async def update_stop(
    order_id: str,
    stop_id: int,
    body: StopUpdate,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Partial update on a single stop."""
    sent = body.__fields_set__
    if not sent:
        raise HTTPException(status_code=400, detail="No fields provided for update")

    row = conn.execute(text("""
        SELECT stop_id FROM order_stops WHERE stop_id = :stop_id AND order_id = :order_id
    """), {"stop_id": stop_id, "order_id": order_id}).fetchone()
    if not row:
        raise NotFoundError(f"Stop {stop_id} not found on order {order_id}")

    set_clauses = ["updated_at = :now"]
    params: dict = {"now": datetime.now(timezone.utc).isoformat(), "stop_id": stop_id}

    field_col_map = {
        "stop_type": "stop_type",
        "address_line": "address_line",
        "area_id": "area_id",
        "city_id": "city_id",
        "lat": "lat",
        "lng": "lng",
        "scheduled_arrival": "scheduled_arrival",
        "actual_arrival": "actual_arrival",
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
        UPDATE order_stops SET {', '.join(set_clauses)} WHERE stop_id = :stop_id
    """), params)

    stops = _get_stops(conn, order_id)
    legs = _get_legs(conn, order_id)
    return {"status": "OK", "data": {"stops": stops, "legs": legs}}


# ---------------------------------------------------------------------------
# PATCH /{order_id}/legs/{leg_id} — Update a leg
# ---------------------------------------------------------------------------

@router.patch("/{order_id}/legs/{leg_id}")
async def update_leg(
    order_id: str,
    leg_id: int,
    body: LegUpdate,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Partial update on a single leg (driver, vehicle, status)."""
    sent = body.__fields_set__
    if not sent:
        raise HTTPException(status_code=400, detail="No fields provided for update")

    row = conn.execute(text("""
        SELECT leg_id FROM order_legs WHERE leg_id = :leg_id AND order_id = :order_id
    """), {"leg_id": leg_id, "order_id": order_id}).fetchone()
    if not row:
        raise NotFoundError(f"Leg {leg_id} not found on order {order_id}")

    set_clauses = ["updated_at = :now"]
    params: dict = {"now": datetime.now(timezone.utc).isoformat(), "leg_id": leg_id}

    field_col_map = {
        "driver_name": "driver_name",
        "driver_contact": "driver_contact",
        "vehicle_plate": "vehicle_plate",
        "vehicle_type_id": "vehicle_type_id",
        "equipment_type": "equipment_type",
        "equipment_number": "equipment_number",
        "status": "status",
        "notes": "notes",
    }

    for field, col in field_col_map.items():
        if field in sent:
            set_clauses.append(f"{col} = :{field}")
            params[field] = getattr(body, field)

    conn.execute(text(f"""
        UPDATE order_legs SET {', '.join(set_clauses)} WHERE leg_id = :leg_id
    """), params)

    legs = _get_legs(conn, order_id)
    return {"status": "OK", "data": legs}


# ---------------------------------------------------------------------------
# GET /shipment/{shipment_id}/reconcile — Reconcile GT against shipment scope
# ---------------------------------------------------------------------------

_SCOPE_TO_LEG_TYPE = {
    "first_mile_haulage": "first_mile",
    "first_mile_trucking": "first_mile",
    "last_mile_haulage": "last_mile",
    "last_mile_trucking": "last_mile",
}

_SCOPE_TO_TRANSPORT_MODE = {
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
    row = conn.execute(text(
        "SELECT scope FROM orders WHERE order_id = :id AND trash = FALSE"
    ), {"id": shipment_id}).fetchone()
    if not row:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    scope = row[0] if isinstance(row[0], dict) else json.loads(row[0]) if isinstance(row[0], str) else {}

    # Fetch linked transport orders
    order_rows = conn.execute(text(f"""
        {_ORDER_SELECT}
        WHERE parent_order_id = :id AND order_type = 'transport' AND status != 'cancelled'
        ORDER BY created_at
    """), {"id": shipment_id}).fetchall()

    orders = []
    for r in order_rows:
        o = _order_row_to_dict(r)
        o["stops"] = _get_stops(conn, o["order_id"])
        o["legs"] = _get_legs(conn, o["order_id"])
        orders.append(o)

    # Compute gaps
    gaps = []
    for flag_key, is_in_scope in scope.items():
        if not is_in_scope:
            continue
        expected_leg_type = _SCOPE_TO_LEG_TYPE.get(flag_key)
        expected_transport_mode = _SCOPE_TO_TRANSPORT_MODE.get(flag_key)
        if expected_leg_type is None:
            continue
        has_match = any(
            o["leg_type"] == expected_leg_type and o["transport_mode"] == expected_transport_mode
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

    row = conn.execute(text(
        "SELECT scope FROM orders WHERE order_id = :id AND trash = FALSE"
    ), {"id": shipment_id}).fetchone()
    if not row:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    scope = row[0] if isinstance(row[0], dict) else json.loads(row[0]) if isinstance(row[0], str) else {}

    for field in sent:
        scope[field] = getattr(body, field)

    conn.execute(text("""
        UPDATE orders SET scope = CAST(:scope AS jsonb), updated_at = :now WHERE order_id = :id
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
