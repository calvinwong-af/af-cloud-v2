"""
routers/quotations.py — Quotation CRUD + pricing engine endpoints.

Quotations are generated from shipment orders. Each quotation captures a scope
snapshot and transport details at time of creation. Revisions are tracked as
separate rows (revision integer increments per shipment).

The pricing engine (POST /quotations/{ref}/calculate) resolves rates from all
applicable pricing tables and writes quotation_line_items rows.
"""

import json
import logging
from datetime import date, datetime, timezone
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
    vehicle_type_id: Optional[str] = None  # None for FCL haulage (implied by container size)
    address: Optional[str] = None
    area_id: Optional[int] = None

    @validator("vehicle_type_id")
    def validate_vehicle_type(cls, v):
        if v is None:
            return v
        if v not in VALID_VEHICLE_TYPES:
            raise ValueError(f"Invalid vehicle_type_id: {v}. Must be one of {sorted(VALID_VEHICLE_TYPES)}")
        return v


class CreateQuotationRequest(BaseModel):
    shipment_id: str
    scope_snapshot: Dict[str, str]
    transport_details: List[TransportDetail] = []
    notes: Optional[str] = None


class ManualLineItemRequest(BaseModel):
    component_type: str
    charge_code: str
    description: str
    uom: str
    quantity: float
    price_per_unit: float
    cost_per_unit: float
    price_currency: str = "MYR"
    cost_currency: str = "MYR"
    min_price: float = 0
    min_cost: float = 0


class LineItemUpdateRequest(BaseModel):
    price_per_unit: Optional[float] = None
    cost_per_unit: Optional[float] = None
    quantity: Optional[float] = None
    description: Optional[str] = None
    charge_code: Optional[str] = None
    min_price: Optional[float] = None
    min_cost: Optional[float] = None


# ---------------------------------------------------------------------------
# Helpers — serialisation
# ---------------------------------------------------------------------------

def _serialise_quotation(row) -> dict:
    return {
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
    }


def _dec(v) -> float:
    """Convert Decimal/None to float."""
    if v is None:
        return 0.0
    return float(v)


# ---------------------------------------------------------------------------
# Helpers — currency conversion
# ---------------------------------------------------------------------------

def _get_conversion_factor(conn, base_currency: str, target_currency: str, reference_date: date) -> float:
    """Get FX rate from base_currency to target_currency as of reference_date."""
    if not base_currency or not target_currency:
        return 1.0
    if base_currency.upper() == target_currency.upper():
        return 1.0
    row = conn.execute(
        text("""
            SELECT rate FROM currency_rates
            WHERE base_currency = :base AND target_currency = :target
              AND effective_from <= :ref_date
            ORDER BY effective_from DESC
            LIMIT 1
        """),
        {"base": base_currency.upper(), "target": target_currency.upper(), "ref_date": reference_date},
    ).fetchone()
    return float(row[0]) if row else 1.0


# ---------------------------------------------------------------------------
# Helpers — air freight tier
# ---------------------------------------------------------------------------

def _air_tier(cw: float) -> str:
    if cw < 45:
        return "l45"
    elif cw < 100:
        return "p45"
    elif cw < 250:
        return "p100"
    elif cw < 300:
        return "p250"
    elif cw < 500:
        return "p300"
    elif cw < 1000:
        return "p500"
    else:
        return "p1000"


# ---------------------------------------------------------------------------
# Helpers — shipment data loading
# ---------------------------------------------------------------------------

def _load_shipment_data(conn, shipment_id: str) -> dict:
    """Load shipment + details needed for pricing."""
    row = conn.execute(
        text("""
            SELECT o.order_id, o.company_id, o.cargo,
                   sd.order_type_detail, sd.origin_port, sd.dest_port,
                   sd.cargo_ready_date, sd.type_details
            FROM orders o
            JOIN shipment_details sd ON sd.order_id = o.order_id
            WHERE o.order_id = :sid
        """),
        {"sid": shipment_id},
    ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"Shipment {shipment_id} not found or has no details")

    cargo = row[2] if isinstance(row[2], dict) else {}
    type_details = row[7] if isinstance(row[7], dict) else {}

    # Extract DG class
    dg_class_code = "NON-DG"
    if cargo.get("is_dg") or cargo.get("dg_class"):
        dg_class_code = cargo.get("dg_class") or "NON-DG"

    # Extract container info for FCL
    containers = type_details.get("containers", [])

    # Extract weight/volume for LCL/AIR
    chargeable_weight = _dec(type_details.get("chargeable_weight"))
    weight_kg = _dec(type_details.get("weight_kg") or cargo.get("weight_kg"))
    cbm = _dec(type_details.get("cbm") or type_details.get("volume_cbm") or cargo.get("volume_cbm"))

    return {
        "order_id": row[0],
        "company_id": row[1],
        "order_type": row[3] or "SEA_FCL",  # order_type_detail: SEA_FCL | SEA_LCL | AIR
        "origin_port": row[4],
        "dest_port": row[5],
        "cargo_ready_date": row[6],
        "dg_class_code": dg_class_code,
        "containers": containers,
        "chargeable_weight": chargeable_weight,
        "weight_kg": weight_kg,
        "cbm": cbm,
    }


def _get_port_country(conn, port_code: str) -> Optional[str]:
    """Get country_code for a port UN code."""
    if not port_code:
        return None
    row = conn.execute(
        text("SELECT country_code FROM ports WHERE un_code = :code"),
        {"code": port_code},
    ).fetchone()
    return row[0] if row else None


# ---------------------------------------------------------------------------
# Helpers — line item insertion
# ---------------------------------------------------------------------------

def _insert_line_item(conn, quotation_id: str, item: dict):
    """Insert a single quotation_line_item row."""
    conn.execute(
        text("""
            INSERT INTO quotation_line_items (
                quotation_id, component_type, charge_code, description, uom, quantity,
                price_per_unit, min_price, price_currency, price_conversion,
                cost_per_unit, min_cost, cost_currency, cost_conversion,
                source_table, source_rate_id, is_manual_override, sort_order
            ) VALUES (
                CAST(:qid AS uuid), :comp, :code, :desc, :uom, :qty,
                :ppu, :mprice, :pcur, :pconv,
                :cpu, :mcost, :ccur, :cconv,
                :stbl, :srid, :manual, :sort
            )
        """),
        {
            "qid": quotation_id,
            "comp": item["component_type"],
            "code": item["charge_code"],
            "desc": item["description"],
            "uom": item["uom"],
            "qty": item["quantity"],
            "ppu": item.get("price_per_unit", 0),
            "mprice": item.get("min_price", 0),
            "pcur": item["price_currency"],
            "pconv": item.get("price_conversion", 1.0),
            "cpu": item.get("cost_per_unit", 0),
            "mcost": item.get("min_cost", 0),
            "ccur": item["cost_currency"],
            "cconv": item.get("cost_conversion", 1.0),
            "stbl": item.get("source_table"),
            "srid": item.get("source_rate_id"),
            "manual": item.get("is_manual_override", False),
            "sort": item.get("sort_order", 0),
        },
    )


# ---------------------------------------------------------------------------
# Rate resolution — FCL ocean freight
# ---------------------------------------------------------------------------

def _resolve_fcl_freight(conn, shipment: dict, quotation_currency: str, ref_date: date, warnings: list) -> list:
    items = []
    containers = shipment["containers"]
    if not containers:
        warnings.append({"component_type": "ocean_freight", "message": "No containers on shipment"})
        return items

    origin = shipment["origin_port"]
    dest = shipment["dest_port"]
    dg = shipment["dg_class_code"]

    for ctr in containers:
        size = ctr.get("container_size", "")
        ctype = ctr.get("container_type", "GP")
        qty = int(ctr.get("quantity", 1))

        # Find rate card
        card = conn.execute(
            text("""
                SELECT id FROM fcl_rate_cards
                WHERE origin_port_code = :origin AND destination_port_code = :dest
                  AND dg_class_code = :dg AND container_size = :size AND container_type = :ctype
                  AND is_active = TRUE
                LIMIT 1
            """),
            {"origin": origin, "dest": dest, "dg": dg, "size": size, "ctype": ctype},
        ).fetchone()

        if not card:
            warnings.append({"component_type": "ocean_freight",
                             "message": f"No FCL rate card found for {origin}→{dest} {dg} {size} {ctype}"})
            continue

        card_id = card[0]

        # List price (supplier_id IS NULL)
        lp = conn.execute(
            text("""
                SELECT id, list_price, currency, surcharges
                FROM fcl_rates
                WHERE rate_card_id = :cid AND supplier_id IS NULL
                  AND rate_status = 'PUBLISHED'
                  AND effective_from <= :rd
                  AND (effective_to IS NULL OR effective_to >= :rd)
                ORDER BY effective_from DESC LIMIT 1
            """),
            {"cid": card_id, "rd": ref_date},
        ).fetchone()

        # Cheapest supplier cost
        sc = conn.execute(
            text("""
                SELECT id, cost, currency, surcharges, supplier_id
                FROM fcl_rates
                WHERE rate_card_id = :cid AND supplier_id IS NOT NULL
                  AND rate_status = 'PUBLISHED'
                  AND effective_from <= :rd
                  AND (effective_to IS NULL OR effective_to >= :rd)
                ORDER BY cost ASC, effective_from DESC LIMIT 1
            """),
            {"cid": card_id, "rd": ref_date},
        ).fetchone()

        price_val = _dec(lp[1]) if lp else 0
        price_cur = lp[2] if lp else quotation_currency
        cost_val = _dec(sc[1]) if sc else 0
        cost_cur = sc[2] if sc else quotation_currency

        p_conv = _get_conversion_factor(conn, price_cur, quotation_currency, ref_date)
        c_conv = _get_conversion_factor(conn, cost_cur, quotation_currency, ref_date)

        items.append({
            "component_type": "ocean_freight",
            "charge_code": f"FR-{size}F",
            "description": f"FCL Ocean Freight — {size} {ctype}",
            "uom": "CONTAINER",
            "quantity": qty,
            "price_per_unit": price_val,
            "min_price": 0,
            "price_currency": price_cur,
            "price_conversion": p_conv,
            "cost_per_unit": cost_val,
            "min_cost": 0,
            "cost_currency": cost_cur,
            "cost_conversion": c_conv,
            "source_table": "fcl_rates",
            "source_rate_id": lp[0] if lp else (sc[0] if sc else None),
            "sort_order": 10,
        })

        # Surcharges from list price row
        lp_surcharges = (lp[3] if lp and lp[3] else []) if lp else []
        sc_surcharges = (sc[3] if sc and sc[3] else []) if sc else []
        if isinstance(lp_surcharges, list):
            sc_map = {}
            if isinstance(sc_surcharges, list):
                sc_map = {s.get("code"): s for s in sc_surcharges if isinstance(s, dict)}

            sort_offset = 1
            for sur in lp_surcharges:
                if not isinstance(sur, dict):
                    continue
                amt = _dec(sur.get("amount"))
                if amt <= 0:
                    continue
                sc_match = sc_map.get(sur.get("code"), {})
                sc_amt = _dec(sc_match.get("amount")) if sc_match else amt
                items.append({
                    "component_type": "ocean_freight",
                    "charge_code": sur.get("code", "FR-SUR"),
                    "description": sur.get("label", sur.get("code", "Surcharge")),
                    "uom": "CONTAINER",
                    "quantity": qty,
                    "price_per_unit": amt,
                    "min_price": 0,
                    "price_currency": price_cur,
                    "price_conversion": p_conv,
                    "cost_per_unit": sc_amt,
                    "min_cost": 0,
                    "cost_currency": cost_cur,
                    "cost_conversion": c_conv,
                    "source_table": "fcl_rates",
                    "source_rate_id": lp[0] if lp else None,
                    "sort_order": 10 + sort_offset,
                })
                sort_offset += 1

        if not lp and not sc:
            warnings.append({"component_type": "ocean_freight",
                             "message": f"No FCL rate found for {origin}→{dest} {dg} {size} {ctype}"})

    return items


# ---------------------------------------------------------------------------
# Rate resolution — LCL ocean freight
# ---------------------------------------------------------------------------

def _resolve_lcl_freight(conn, shipment: dict, quotation_currency: str, ref_date: date, warnings: list) -> list:
    items = []
    origin = shipment["origin_port"]
    dest = shipment["dest_port"]
    dg = shipment["dg_class_code"]

    card = conn.execute(
        text("""
            SELECT id FROM lcl_rate_cards
            WHERE origin_port_code = :origin AND destination_port_code = :dest
              AND dg_class_code = :dg AND is_active = TRUE
            LIMIT 1
        """),
        {"origin": origin, "dest": dest, "dg": dg},
    ).fetchone()

    if not card:
        warnings.append({"component_type": "ocean_freight",
                         "message": f"No LCL rate card found for {origin}→{dest} {dg}"})
        return items

    card_id = card[0]

    # W/M calculation
    cbm = shipment["cbm"]
    wt = shipment["weight_kg"]
    wm_qty = max(cbm, wt / 1000.0) if (cbm > 0 or wt > 0) else 0

    # List price
    lp = conn.execute(
        text("""
            SELECT id, list_price, currency, surcharges, min_quantity
            FROM lcl_rates
            WHERE rate_card_id = :cid AND supplier_id IS NULL
              AND rate_status = 'PUBLISHED'
              AND effective_from <= :rd
              AND (effective_to IS NULL OR effective_to >= :rd)
            ORDER BY effective_from DESC LIMIT 1
        """),
        {"cid": card_id, "rd": ref_date},
    ).fetchone()

    # Cheapest supplier
    sc = conn.execute(
        text("""
            SELECT id, cost, currency, surcharges, min_quantity, supplier_id
            FROM lcl_rates
            WHERE rate_card_id = :cid AND supplier_id IS NOT NULL
              AND rate_status = 'PUBLISHED'
              AND effective_from <= :rd
              AND (effective_to IS NULL OR effective_to >= :rd)
            ORDER BY cost ASC, effective_from DESC LIMIT 1
        """),
        {"cid": card_id, "rd": ref_date},
    ).fetchone()

    # Apply min_quantity
    min_qty_lp = _dec(lp[4]) if lp and lp[4] else 0
    min_qty_sc = _dec(sc[4]) if sc and sc[4] else 0
    effective_qty = max(wm_qty, min_qty_lp, min_qty_sc)

    price_val = _dec(lp[1]) if lp else 0
    price_cur = lp[2] if lp else quotation_currency
    cost_val = _dec(sc[1]) if sc else 0
    cost_cur = sc[2] if sc else quotation_currency

    p_conv = _get_conversion_factor(conn, price_cur, quotation_currency, ref_date)
    c_conv = _get_conversion_factor(conn, cost_cur, quotation_currency, ref_date)

    items.append({
        "component_type": "ocean_freight",
        "charge_code": "FR-LCL",
        "description": "LCL Ocean Freight",
        "uom": "W/M",
        "quantity": effective_qty,
        "price_per_unit": price_val,
        "min_price": 0,
        "price_currency": price_cur,
        "price_conversion": p_conv,
        "cost_per_unit": cost_val,
        "min_cost": 0,
        "cost_currency": cost_cur,
        "cost_conversion": c_conv,
        "source_table": "lcl_rates",
        "source_rate_id": lp[0] if lp else (sc[0] if sc else None),
        "sort_order": 10,
    })

    # Surcharges
    lp_surcharges = (lp[3] if lp and lp[3] else []) if lp else []
    sc_surcharges = (sc[3] if sc and sc[3] else []) if sc else []
    if isinstance(lp_surcharges, list):
        sc_map = {}
        if isinstance(sc_surcharges, list):
            sc_map = {s.get("code"): s for s in sc_surcharges if isinstance(s, dict)}
        sort_offset = 1
        for sur in lp_surcharges:
            if not isinstance(sur, dict):
                continue
            amt = _dec(sur.get("amount"))
            if amt <= 0:
                continue
            sc_match = sc_map.get(sur.get("code"), {})
            sc_amt = _dec(sc_match.get("amount")) if sc_match else amt
            items.append({
                "component_type": "ocean_freight",
                "charge_code": sur.get("code", "FR-SUR"),
                "description": sur.get("label", sur.get("code", "Surcharge")),
                "uom": "W/M",
                "quantity": effective_qty,
                "price_per_unit": amt,
                "min_price": 0,
                "price_currency": price_cur,
                "price_conversion": p_conv,
                "cost_per_unit": sc_amt,
                "min_cost": 0,
                "cost_currency": cost_cur,
                "cost_conversion": c_conv,
                "source_table": "lcl_rates",
                "source_rate_id": lp[0] if lp else None,
                "sort_order": 10 + sort_offset,
            })
            sort_offset += 1

    if not lp and not sc:
        warnings.append({"component_type": "ocean_freight",
                         "message": f"No LCL rate found for {origin}→{dest} {dg}"})

    return items


# ---------------------------------------------------------------------------
# Rate resolution — Air freight
# ---------------------------------------------------------------------------

def _resolve_air_freight(conn, shipment: dict, quotation_currency: str, ref_date: date, warnings: list) -> list:
    items = []
    origin = shipment["origin_port"]
    dest = shipment["dest_port"]
    dg = shipment["dg_class_code"]
    cw = shipment["chargeable_weight"]

    if cw <= 0:
        warnings.append({"component_type": "air_freight", "message": "No chargeable weight on shipment"})
        return items

    tier = _air_tier(cw)

    # Cheapest supplier cost
    sc = conn.execute(
        text("""
            SELECT arc.id, arc.airline_code,
                   ar.id as rate_id, ar.currency,
                   ar.l45_cost, ar.p45_cost, ar.p100_cost, ar.p250_cost,
                   ar.p300_cost, ar.p500_cost, ar.p1000_cost, ar.min_cost,
                   ar.surcharges, ar.supplier_id
            FROM air_freight_rate_cards arc
            JOIN air_freight_rates ar ON ar.rate_card_id = arc.id
            WHERE arc.origin_port_code = :origin AND arc.destination_port_code = :dest
              AND arc.dg_class_code = :dg AND arc.is_active = TRUE
              AND ar.rate_status = 'PUBLISHED'
              AND ar.effective_from <= :rd
              AND (ar.effective_to IS NULL OR ar.effective_to >= :rd)
              AND ar.supplier_id IS NOT NULL
            ORDER BY ar.p100_cost ASC NULLS LAST, ar.effective_from DESC
            LIMIT 1
        """),
        {"origin": origin, "dest": dest, "dg": dg, "rd": ref_date},
    ).fetchone()

    # List price
    lp = conn.execute(
        text("""
            SELECT alpr.id, alpr.currency,
                   alpr.l45_list_price, alpr.p45_list_price, alpr.p100_list_price,
                   alpr.p250_list_price, alpr.p300_list_price, alpr.p500_list_price,
                   alpr.p1000_list_price, alpr.min_list_price, alpr.surcharges
            FROM air_list_price_rate_cards alpc
            JOIN air_list_price_rates alpr ON alpr.rate_card_id = alpc.id
            WHERE alpc.origin_port_code = :origin AND alpc.destination_port_code = :dest
              AND alpc.dg_class_code = :dg AND alpc.is_active = TRUE
              AND alpr.rate_status = 'PUBLISHED'
              AND alpr.effective_from <= :rd
              AND (alpr.effective_to IS NULL OR alpr.effective_to >= :rd)
            ORDER BY alpr.effective_from DESC
            LIMIT 1
        """),
        {"origin": origin, "dest": dest, "dg": dg, "rd": ref_date},
    ).fetchone()

    # Map tier to column indices for list price row
    lp_tier_map = {"l45": 2, "p45": 3, "p100": 4, "p250": 5, "p300": 6, "p500": 7, "p1000": 8}
    # Map tier to column indices for supplier cost row
    sc_tier_map = {"l45": 4, "p45": 5, "p100": 6, "p250": 7, "p300": 8, "p500": 9, "p1000": 10}

    price_val = _dec(lp[lp_tier_map[tier]]) if lp else 0
    price_cur = lp[1] if lp else quotation_currency
    min_price = _dec(lp[9]) if lp else 0
    cost_val = _dec(sc[sc_tier_map[tier]]) if sc else 0
    cost_cur = sc[3] if sc else quotation_currency
    min_cost = _dec(sc[11]) if sc else 0

    p_conv = _get_conversion_factor(conn, price_cur, quotation_currency, ref_date)
    c_conv = _get_conversion_factor(conn, cost_cur, quotation_currency, ref_date)

    items.append({
        "component_type": "air_freight",
        "charge_code": "FR-AIR",
        "description": "Air Freight",
        "uom": "CW_KG",
        "quantity": cw,
        "price_per_unit": price_val,
        "min_price": min_price,
        "price_currency": price_cur,
        "price_conversion": p_conv,
        "cost_per_unit": cost_val,
        "min_cost": min_cost,
        "cost_currency": cost_cur,
        "cost_conversion": c_conv,
        "source_table": "air_freight_rates" if sc else "air_list_price_rates",
        "source_rate_id": sc[2] if sc else (lp[0] if lp else None),
        "sort_order": 10,
    })

    # Surcharges from list price and supplier cost
    lp_sur = (lp[10] if lp and lp[10] else {}) if lp else {}
    sc_sur = (sc[12] if sc and sc[12] else {}) if sc else {}
    # surcharges are dicts like {fsc: 0.5, msc: 0.3, ssc: 0.2}
    all_sur_keys = set()
    if isinstance(lp_sur, dict):
        all_sur_keys.update(lp_sur.keys())
    if isinstance(sc_sur, dict):
        all_sur_keys.update(sc_sur.keys())

    sur_labels = {"fsc": "Fuel Surcharge", "msc": "My Carrier Surcharge", "ssc": "Security Surcharge"}
    sort_offset = 1
    for key in sorted(all_sur_keys):
        p_amt = _dec(lp_sur.get(key) if isinstance(lp_sur, dict) else 0)
        c_amt = _dec(sc_sur.get(key) if isinstance(sc_sur, dict) else 0)
        if p_amt <= 0 and c_amt <= 0:
            continue
        items.append({
            "component_type": "air_freight",
            "charge_code": f"FR-{key.upper()}",
            "description": sur_labels.get(key, key.upper()),
            "uom": "CW_KG",
            "quantity": cw,
            "price_per_unit": p_amt,
            "min_price": 0,
            "price_currency": price_cur,
            "price_conversion": p_conv,
            "cost_per_unit": c_amt,
            "min_cost": 0,
            "cost_currency": cost_cur,
            "cost_conversion": c_conv,
            "source_table": "air_freight_rates",
            "source_rate_id": sc[2] if sc else None,
            "sort_order": 10 + sort_offset,
        })
        sort_offset += 1

    if not lp and not sc:
        warnings.append({"component_type": "air_freight",
                         "message": f"No air freight rate found for {origin}→{dest} {dg}"})

    return items


# ---------------------------------------------------------------------------
# Rate resolution — Local charges
# ---------------------------------------------------------------------------

def _resolve_local_charges(conn, shipment: dict, direction: str, quotation_currency: str,
                           ref_date: date, warnings: list) -> list:
    items = []
    component_type = f"{direction.lower()}_local"
    port = shipment["origin_port"] if direction == "EXPORT" else shipment["dest_port"]
    order_type = shipment["order_type"]

    # Map order_type_detail to shipment_type for local_charges
    stype_map = {"SEA_FCL": "FCL", "SEA_LCL": "LCL", "AIR": "AIR"}
    stype = stype_map.get(order_type, "ALL")

    rows = conn.execute(
        text("""
            SELECT id, charge_code, description, price, cost, currency, uom,
                   container_size, container_type, paid_with_freight
            FROM local_charges
            WHERE port_code = :port
              AND trade_direction = :direction
              AND shipment_type IN (:stype, 'ALL')
              AND is_active = TRUE
              AND effective_from <= :rd
              AND (effective_to IS NULL OR effective_to >= :rd)
            ORDER BY charge_code, container_size, container_type, effective_from DESC
        """),
        {"port": port, "direction": direction, "stype": stype, "rd": ref_date},
    ).fetchall()

    if not rows:
        warnings.append({"component_type": component_type,
                         "message": f"No local charges found for {port} {direction} {stype}"})
        return items

    # Deduplicate: latest per (charge_code, container_size, container_type)
    seen = set()
    deduped = []
    for r in rows:
        key = (r[1], r[7], r[8])  # charge_code, container_size, container_type
        if key not in seen:
            seen.add(key)
            deduped.append(r)

    containers = shipment["containers"]
    base_sort = 20 if direction == "EXPORT" else 21
    sort_offset = 0

    for r in deduped:
        charge_code = r[1]
        desc = r[2]
        price = _dec(r[3])
        cost = _dec(r[4])
        cur = r[5]
        uom = r[6]
        lc_csize = r[7] or "ALL"
        lc_ctype = r[8] or "ALL"
        paid_with_freight = r[9]

        if paid_with_freight:
            continue

        # Determine quantity based on UOM and order type
        qty = 1.0
        if order_type == "SEA_FCL":
            if uom == "CONTAINER":
                # Match container_size/type or ALL
                for ctr in containers:
                    cs = ctr.get("container_size", "")
                    ct = ctr.get("container_type", "GP")
                    cq = int(ctr.get("quantity", 1))
                    size_match = (lc_csize == "ALL" or lc_csize == cs)
                    type_match = (lc_ctype == "ALL" or lc_ctype == ct)
                    if size_match and type_match:
                        qty = cq
                        break
            else:
                qty = 1.0
        elif order_type == "SEA_LCL":
            if uom == "CBM":
                qty = shipment["cbm"] or 1.0
            elif uom == "W/M":
                qty = max(shipment["cbm"], shipment["weight_kg"] / 1000.0) or 1.0
            elif uom == "KG":
                qty = shipment["weight_kg"] or 1.0
        elif order_type == "AIR":
            if uom == "CW_KG":
                qty = shipment["chargeable_weight"] or 1.0
            elif uom == "KG":
                qty = shipment["weight_kg"] or 1.0
            elif uom == "CBM":
                qty = shipment["cbm"] or 1.0

        p_conv = _get_conversion_factor(conn, cur, quotation_currency, ref_date)
        c_conv = _get_conversion_factor(conn, cur, quotation_currency, ref_date)

        items.append({
            "component_type": component_type,
            "charge_code": charge_code,
            "description": desc,
            "uom": uom,
            "quantity": qty,
            "price_per_unit": price,
            "min_price": 0,
            "price_currency": cur,
            "price_conversion": p_conv,
            "cost_per_unit": cost,
            "min_cost": 0,
            "cost_currency": cur,
            "cost_conversion": c_conv,
            "source_table": "local_charges",
            "source_rate_id": r[0],
            "sort_order": base_sort + sort_offset,
        })
        sort_offset += 1

    return items


# ---------------------------------------------------------------------------
# Rate resolution — Customs charges
# ---------------------------------------------------------------------------

def _resolve_customs(conn, shipment: dict, direction: str, quotation_currency: str,
                     ref_date: date, warnings: list) -> list:
    items = []
    component_type = f"{direction.lower()}_customs"
    port = shipment["origin_port"] if direction == "EXPORT" else shipment["dest_port"]
    order_type = shipment["order_type"]
    stype_map = {"SEA_FCL": "FCL", "SEA_LCL": "LCL", "AIR": "AIR"}
    stype = stype_map.get(order_type, "ALL")

    # customs_rates uses port_code (not country_code)
    rows = conn.execute(
        text("""
            SELECT id, charge_code, description, price, cost, currency, uom
            FROM customs_rates
            WHERE port_code = :port
              AND trade_direction = :direction
              AND shipment_type IN (:stype, 'ALL')
              AND is_active = TRUE
              AND effective_from <= :rd
              AND (effective_to IS NULL OR effective_to >= :rd)
            ORDER BY charge_code, effective_from DESC
        """),
        {"port": port, "direction": direction, "stype": stype, "rd": ref_date},
    ).fetchall()

    if not rows:
        warnings.append({"component_type": component_type,
                         "message": f"No customs rates found for {port} {direction} {stype}"})
        return items

    # Deduplicate: latest per charge_code
    seen = set()
    base_sort = 30 if direction == "EXPORT" else 31
    sort_offset = 0

    for r in rows:
        if r[1] in seen:
            continue
        seen.add(r[1])

        cur = r[5]
        p_conv = _get_conversion_factor(conn, cur, quotation_currency, ref_date)

        items.append({
            "component_type": component_type,
            "charge_code": r[1],
            "description": r[2],
            "uom": "SHIPMENT",
            "quantity": 1,
            "price_per_unit": _dec(r[3]),
            "min_price": 0,
            "price_currency": cur,
            "price_conversion": p_conv,
            "cost_per_unit": _dec(r[4]),
            "min_cost": 0,
            "cost_currency": cur,
            "cost_conversion": p_conv,
            "source_table": "customs_rates",
            "source_rate_id": r[0],
            "sort_order": base_sort + sort_offset,
        })
        sort_offset += 1

    return items


# ---------------------------------------------------------------------------
# Rate resolution — Haulage (FCL only)
# ---------------------------------------------------------------------------

def _resolve_haulage(conn, shipment: dict, transport_details: list, direction: str,
                     quotation_currency: str, ref_date: date, warnings: list) -> list:
    items = []
    component_type = f"{direction.lower()}_haulage"
    leg_key = "first_mile" if direction == "EXPORT" else "last_mile"
    port = shipment["origin_port"] if direction == "EXPORT" else shipment["dest_port"]

    # Find matching transport detail
    td = None
    for t in transport_details:
        t_leg = t.get("leg") if isinstance(t, dict) else getattr(t, "leg", None)
        if t_leg == leg_key:
            td = t if isinstance(t, dict) else t.dict() if hasattr(t, "dict") else t
            break

    if not td:
        return items

    area_id = td.get("area_id")
    if not area_id:
        warnings.append({"component_type": component_type, "message": f"No area_id for {leg_key}"})
        return items

    containers = shipment["containers"]
    if not containers:
        return items

    base_sort = 40 if direction == "EXPORT" else 41

    for ctr in containers:
        size = ctr.get("container_size", "")
        qty = int(ctr.get("quantity", 1))

        # Find rate card — try exact size first, fallback to wildcard
        card = conn.execute(
            text("""
                SELECT id, include_depot_gate_fee, terminal_id FROM haulage_rate_cards
                WHERE port_un_code = :port AND area_id = :aid
                  AND container_size = :size AND is_active = TRUE
                LIMIT 1
            """),
            {"port": port, "aid": area_id, "size": size},
        ).fetchone()

        if not card:
            card = conn.execute(
                text("""
                    SELECT id, include_depot_gate_fee, terminal_id FROM haulage_rate_cards
                    WHERE port_un_code = :port AND area_id = :aid
                      AND container_size = 'wildcard' AND is_active = TRUE
                    LIMIT 1
                """),
                {"port": port, "aid": area_id},
            ).fetchone()

        if not card:
            warnings.append({"component_type": component_type,
                             "message": f"No haulage rate card for {port} area {area_id} {size}"})
            continue

        card_id = card[0]
        include_gate_fee = card[1]
        terminal_id = card[2]

        # List price
        lp = conn.execute(
            text("""
                SELECT id, list_price, cost, currency, surcharges, side_loader_surcharge
                FROM haulage_rates
                WHERE rate_card_id = :cid AND supplier_id IS NULL
                  AND rate_status = 'PUBLISHED'
                  AND effective_from <= :rd
                  AND (effective_to IS NULL OR effective_to >= :rd)
                ORDER BY effective_from DESC LIMIT 1
            """),
            {"cid": card_id, "rd": ref_date},
        ).fetchone()

        # Cheapest supplier
        sc = conn.execute(
            text("""
                SELECT id, cost, currency, surcharges, side_loader_surcharge, supplier_id
                FROM haulage_rates
                WHERE rate_card_id = :cid AND supplier_id IS NOT NULL
                  AND rate_status = 'PUBLISHED'
                  AND effective_from <= :rd
                  AND (effective_to IS NULL OR effective_to >= :rd)
                ORDER BY cost ASC, effective_from DESC LIMIT 1
            """),
            {"cid": card_id, "rd": ref_date},
        ).fetchone()

        price_val = _dec(lp[1]) if lp else 0
        price_cur = lp[3] if lp else quotation_currency
        cost_val = _dec(sc[1]) if sc else (_dec(lp[2]) if lp else 0)
        cost_cur = sc[2] if sc else (lp[3] if lp else quotation_currency)

        # Apply supplier rebate to cost
        supplier_id = sc[5] if sc else None
        if supplier_id and cost_val > 0:
            rebate = conn.execute(
                text("""
                    SELECT rebate_percent FROM haulage_supplier_rebates
                    WHERE supplier_id = :sid AND port_un_code = :port
                      AND container_size = :size
                      AND effective_from <= :rd
                      AND (effective_to IS NULL OR effective_to >= :rd)
                    ORDER BY effective_from DESC LIMIT 1
                """),
                {"sid": supplier_id, "port": port, "size": size, "rd": ref_date},
            ).fetchone()
            if rebate:
                cost_val = cost_val * (1 - _dec(rebate[0]))

        p_conv = _get_conversion_factor(conn, price_cur, quotation_currency, ref_date)
        c_conv = _get_conversion_factor(conn, cost_cur, quotation_currency, ref_date)

        items.append({
            "component_type": component_type,
            "charge_code": "HA-RAT",
            "description": f"Haulage — {size}",
            "uom": "CONTAINER",
            "quantity": qty,
            "price_per_unit": price_val,
            "min_price": 0,
            "price_currency": price_cur,
            "price_conversion": p_conv,
            "cost_per_unit": cost_val,
            "min_cost": 0,
            "cost_currency": cost_cur,
            "cost_conversion": c_conv,
            "source_table": "haulage_rates",
            "source_rate_id": lp[0] if lp else (sc[0] if sc else None),
            "sort_order": base_sort,
        })

        # Surcharges from list price row
        lp_sur = (lp[4] if lp and lp[4] else []) if lp else []
        sc_sur = (sc[3] if sc and sc[3] else []) if sc else []
        if isinstance(lp_sur, list):
            sc_map = {}
            if isinstance(sc_sur, list):
                sc_map = {s.get("code"): s for s in sc_sur if isinstance(s, dict)}
            sort_offset = 1
            for sur in lp_sur:
                if not isinstance(sur, dict):
                    continue
                amt = _dec(sur.get("amount"))
                if amt <= 0:
                    continue
                sc_match = sc_map.get(sur.get("code"), {})
                sc_amt = _dec(sc_match.get("amount")) if sc_match else amt
                items.append({
                    "component_type": component_type,
                    "charge_code": sur.get("code", "HA-SUR"),
                    "description": sur.get("label", sur.get("code", "Surcharge")),
                    "uom": "CONTAINER",
                    "quantity": qty,
                    "price_per_unit": amt,
                    "min_price": 0,
                    "price_currency": price_cur,
                    "price_conversion": p_conv,
                    "cost_per_unit": sc_amt,
                    "min_cost": 0,
                    "cost_currency": cost_cur,
                    "cost_conversion": c_conv,
                    "source_table": "haulage_rates",
                    "source_rate_id": lp[0] if lp else None,
                    "sort_order": base_sort + sort_offset,
                })
                sort_offset += 1

        # Depot gate fee
        if include_gate_fee:
            gate = conn.execute(
                text("""
                    SELECT fee_amount, currency FROM port_depot_gate_fees
                    WHERE port_un_code = :port
                      AND (terminal_id = :tid OR terminal_id IS NULL)
                      AND rate_status = 'PUBLISHED'
                      AND effective_from <= :rd
                      AND (effective_to IS NULL OR effective_to >= :rd)
                    ORDER BY terminal_id NULLS LAST, effective_from DESC LIMIT 1
                """),
                {"port": port, "tid": terminal_id, "rd": ref_date},
            ).fetchone()
            if gate:
                g_cur = gate[1]
                g_conv = _get_conversion_factor(conn, g_cur, quotation_currency, ref_date)
                items.append({
                    "component_type": component_type,
                    "charge_code": "HA-DPG",
                    "description": "Depot Gate Fee",
                    "uom": "CONTAINER",
                    "quantity": qty,
                    "price_per_unit": _dec(gate[0]),
                    "min_price": 0,
                    "price_currency": g_cur,
                    "price_conversion": g_conv,
                    "cost_per_unit": _dec(gate[0]),
                    "min_cost": 0,
                    "cost_currency": g_cur,
                    "cost_conversion": g_conv,
                    "source_table": "port_depot_gate_fees",
                    "source_rate_id": None,
                    "sort_order": base_sort + 5,
                })

    return items


# ---------------------------------------------------------------------------
# Rate resolution — Ground transport (LCL / Air)
# ---------------------------------------------------------------------------

def _resolve_ground_transport(conn, shipment: dict, transport_details: list, direction: str,
                              quotation_currency: str, ref_date: date, warnings: list) -> list:
    items = []
    component_type = f"{direction.lower()}_transport"
    leg_key = "first_mile" if direction == "EXPORT" else "last_mile"
    port = shipment["origin_port"] if direction == "EXPORT" else shipment["dest_port"]

    td = None
    for t in transport_details:
        t_leg = t.get("leg") if isinstance(t, dict) else getattr(t, "leg", None)
        if t_leg == leg_key:
            td = t if isinstance(t, dict) else t.dict() if hasattr(t, "dict") else t
            break

    if not td:
        return items

    area_id = td.get("area_id")
    vehicle_type_id = td.get("vehicle_type_id")
    if not area_id or not vehicle_type_id:
        warnings.append({"component_type": component_type,
                         "message": f"Missing area_id or vehicle_type_id for {leg_key}"})
        return items

    base_sort = 42 if direction == "EXPORT" else 43

    card = conn.execute(
        text("""
            SELECT id FROM port_transport_rate_cards
            WHERE port_un_code = :port AND area_id = :aid
              AND vehicle_type_id = :vid AND is_active = TRUE
            LIMIT 1
        """),
        {"port": port, "aid": area_id, "vid": vehicle_type_id},
    ).fetchone()

    if not card:
        warnings.append({"component_type": component_type,
                         "message": f"No transport rate card for {port} area {area_id} vehicle {vehicle_type_id}"})
        return items

    rate = conn.execute(
        text("""
            SELECT id, list_price, cost, min_list_price, min_cost, currency
            FROM port_transport_rates
            WHERE rate_card_id = :cid
              AND rate_status = 'PUBLISHED'
              AND effective_from <= :rd
              AND (effective_to IS NULL OR effective_to >= :rd)
            ORDER BY effective_from DESC LIMIT 1
        """),
        {"cid": card[0], "rd": ref_date},
    ).fetchone()

    if not rate:
        warnings.append({"component_type": component_type,
                         "message": f"No transport rate for {port} area {area_id} vehicle {vehicle_type_id}"})
        return items

    cur = rate[5]
    p_conv = _get_conversion_factor(conn, cur, quotation_currency, ref_date)

    items.append({
        "component_type": component_type,
        "charge_code": "TR-RAT",
        "description": f"Ground Transport — {vehicle_type_id}",
        "uom": "TRIP",
        "quantity": 1,
        "price_per_unit": _dec(rate[1]),
        "min_price": _dec(rate[3]),
        "price_currency": cur,
        "price_conversion": p_conv,
        "cost_per_unit": _dec(rate[2]),
        "min_cost": _dec(rate[4]),
        "cost_currency": cur,
        "cost_conversion": p_conv,
        "source_table": "port_transport_rates",
        "source_rate_id": rate[0],
        "sort_order": base_sort,
    })

    return items


# ---------------------------------------------------------------------------
# Helpers — line item serialisation
# ---------------------------------------------------------------------------

def _serialise_line_item(r) -> dict:
    """Serialise a line item row to dict with computed effective values."""
    qty = _dec(r[5])
    ppu = _dec(r[6])
    mprice = _dec(r[7])
    p_cur = r[8]
    p_conv = _dec(r[9])
    cpu = _dec(r[10])
    mcost = _dec(r[11])
    c_cur = r[12]
    c_conv = _dec(r[13])

    raw_price = qty * ppu
    raw_cost = qty * cpu
    effective_price = max(raw_price, mprice) if raw_price > 0 else 0
    effective_cost = max(raw_cost, mcost) if raw_cost > 0 else 0
    effective_cost_converted = effective_cost * c_conv
    effective_price_converted = effective_price * p_conv
    margin_pct = None
    if effective_price_converted > 0:
        margin_pct = round((effective_price_converted - effective_cost_converted) / effective_price_converted * 100, 2)

    return {
        "id": r[0],
        "quotation_id": str(r[1]),
        "component_type": r[2],
        "charge_code": r[3],
        "description": r[4],
        "uom": r[19] if len(r) > 19 else "",
        "quantity": qty,
        "price_per_unit": ppu,
        "min_price": mprice,
        "price_currency": p_cur,
        "price_conversion": p_conv,
        "cost_per_unit": cpu,
        "min_cost": mcost,
        "cost_currency": c_cur,
        "cost_conversion": c_conv,
        "source_table": r[14],
        "source_rate_id": r[15],
        "is_manual_override": r[16],
        "sort_order": r[17],
        "effective_price": round(effective_price_converted, 2),
        "effective_cost": round(effective_cost_converted, 2),
        "margin_percent": margin_pct,
        "created_at": r[18].isoformat() if r[18] else None,
        "updated_at": r[20].isoformat() if len(r) > 20 and r[20] else None,
    }


_LINE_ITEM_SELECT = """
    SELECT id, quotation_id, component_type, charge_code, description,
           quantity, price_per_unit, min_price, price_currency, price_conversion,
           cost_per_unit, min_cost, cost_currency, cost_conversion,
           source_table, source_rate_id, is_manual_override, sort_order,
           created_at, uom, updated_at
    FROM quotation_line_items
"""


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

    # 4. Resolve currency from company's preferred_currency
    company_row = conn.execute(
        text("""
            SELECT c.preferred_currency
            FROM orders o
            JOIN companies c ON c.id = o.company_id
            WHERE o.order_id = :sid
        """),
        {"sid": body.shipment_id},
    ).fetchone()
    currency = (company_row[0] or "MYR") if company_row else "MYR"

    # 5. Insert
    scope_json = json.dumps(body.scope_snapshot)
    transport_json = json.dumps([td.dict() for td in body.transport_details])

    conn.execute(
        text("""
            INSERT INTO quotations (quotation_ref, shipment_id, revision, scope_snapshot,
                                    transport_details, notes, currency, created_by)
            VALUES (:ref, :sid, :rev, CAST(:scope AS jsonb),
                    CAST(:transport AS jsonb), :notes, :currency, :created_by)
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
            "currency": currency,
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

    return {"status": "OK", "data": [_serialise_quotation(r) for r in rows]}


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

    return {"status": "OK", "data": _serialise_quotation(row)}


# ---------------------------------------------------------------------------
# POST /quotations/{quotation_ref}/calculate — Pricing engine
# ---------------------------------------------------------------------------

@router.post("/quotations/{quotation_ref}/calculate")
async def calculate_quotation(
    quotation_ref: str,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    # 1. Fetch quotation
    q = conn.execute(
        text("""
            SELECT id, quotation_ref, shipment_id, scope_snapshot, transport_details, currency
            FROM quotations WHERE quotation_ref = :ref
        """),
        {"ref": quotation_ref},
    ).fetchone()

    if not q:
        raise HTTPException(status_code=404, detail=f"Quotation {quotation_ref} not found")

    quotation_id = str(q[0])
    shipment_id = q[2]
    scope = q[3] if isinstance(q[3], dict) else {}
    transport_details = q[4] if isinstance(q[4], list) else []
    quotation_currency = q[5] or "MYR"

    # 2. Load shipment data
    shipment = _load_shipment_data(conn, shipment_id)
    order_type = shipment["order_type"]  # SEA_FCL | SEA_LCL | AIR
    ref_date = date.today()

    # 3. Delete existing non-manual line items
    conn.execute(
        text("DELETE FROM quotation_line_items WHERE quotation_id = CAST(:qid AS uuid) AND is_manual_override = FALSE"),
        {"qid": quotation_id},
    )

    # 4. Resolve all components
    warnings: list = []
    all_items: list = []

    # A/B. Ocean freight (FCL or LCL)
    if order_type == "SEA_FCL":
        all_items.extend(_resolve_fcl_freight(conn, shipment, quotation_currency, ref_date, warnings))
    elif order_type == "SEA_LCL":
        all_items.extend(_resolve_lcl_freight(conn, shipment, quotation_currency, ref_date, warnings))

    # C. Air freight
    if order_type == "AIR":
        all_items.extend(_resolve_air_freight(conn, shipment, quotation_currency, ref_date, warnings))

    # D. Local charges — always for both directions if applicable
    all_items.extend(_resolve_local_charges(conn, shipment, "EXPORT", quotation_currency, ref_date, warnings))
    all_items.extend(_resolve_local_charges(conn, shipment, "IMPORT", quotation_currency, ref_date, warnings))

    # E. Customs
    if scope.get("export_clearance") == "ASSIGNED":
        all_items.extend(_resolve_customs(conn, shipment, "EXPORT", quotation_currency, ref_date, warnings))
    if scope.get("import_clearance") == "ASSIGNED":
        all_items.extend(_resolve_customs(conn, shipment, "IMPORT", quotation_currency, ref_date, warnings))

    # F. Haulage (FCL only) — first_mile = export, last_mile = import
    if order_type == "SEA_FCL":
        if scope.get("first_mile") == "ASSIGNED":
            all_items.extend(_resolve_haulage(conn, shipment, transport_details, "EXPORT",
                                              quotation_currency, ref_date, warnings))
        if scope.get("last_mile") == "ASSIGNED":
            all_items.extend(_resolve_haulage(conn, shipment, transport_details, "IMPORT",
                                              quotation_currency, ref_date, warnings))

    # G. Ground transport (LCL / Air)
    if order_type in ("SEA_LCL", "AIR"):
        if scope.get("first_mile") == "ASSIGNED":
            all_items.extend(_resolve_ground_transport(conn, shipment, transport_details, "EXPORT",
                                                       quotation_currency, ref_date, warnings))
        if scope.get("last_mile") == "ASSIGNED":
            all_items.extend(_resolve_ground_transport(conn, shipment, transport_details, "IMPORT",
                                                       quotation_currency, ref_date, warnings))

    # 5. Insert all resolved items
    for item in all_items:
        item["price_currency"] = item.get("price_currency") or quotation_currency
        item["cost_currency"] = item.get("cost_currency") or quotation_currency
        _insert_line_item(conn, quotation_id, item)

    # 6. Update quotation
    conn.execute(
        text("UPDATE quotations SET scope_changed = FALSE, updated_at = NOW() WHERE id = CAST(:qid AS uuid)"),
        {"qid": quotation_id},
    )

    # 7. Fetch all line items (including manual overrides) for response
    rows = conn.execute(
        text(_LINE_ITEM_SELECT + " WHERE quotation_id = CAST(:qid AS uuid) ORDER BY sort_order, id"),
        {"qid": quotation_id},
    ).fetchall()

    line_items = [_serialise_line_item(r) for r in rows]

    logger.info("[quotations] Calculated %s: %d line items, %d warnings",
                quotation_ref, len(line_items), len(warnings))

    return {
        "status": "OK",
        "data": {
            "quotation_ref": quotation_ref,
            "currency": quotation_currency,
            "line_items": line_items,
            "warnings": warnings,
        },
    }


# ---------------------------------------------------------------------------
# GET /quotations/{quotation_ref}/line-items — List line items
# ---------------------------------------------------------------------------

@router.get("/quotations/{quotation_ref}/line-items")
async def list_line_items(
    quotation_ref: str,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    q = conn.execute(
        text("SELECT id, currency FROM quotations WHERE quotation_ref = :ref"),
        {"ref": quotation_ref},
    ).fetchone()

    if not q:
        raise HTTPException(status_code=404, detail=f"Quotation {quotation_ref} not found")

    quotation_id = str(q[0])
    quotation_currency = q[1] or "MYR"

    rows = conn.execute(
        text(_LINE_ITEM_SELECT + " WHERE quotation_id = CAST(:qid AS uuid) ORDER BY sort_order, id"),
        {"qid": quotation_id},
    ).fetchall()

    line_items = [_serialise_line_item(r) for r in rows]

    total_price = sum(li["effective_price"] for li in line_items)
    total_cost = sum(li["effective_cost"] for li in line_items)
    margin_pct = round((total_price - total_cost) / total_price * 100, 2) if total_price > 0 else None

    return {
        "status": "OK",
        "data": {
            "line_items": line_items,
            "totals": {
                "total_price": round(total_price, 2),
                "total_cost": round(total_cost, 2),
                "margin_percent": margin_pct,
                "currency": quotation_currency,
            },
        },
    }


# ---------------------------------------------------------------------------
# POST /quotations/{quotation_ref}/line-items — Add manual line item
# ---------------------------------------------------------------------------

@router.post("/quotations/{quotation_ref}/line-items")
async def add_manual_line_item(
    quotation_ref: str,
    body: ManualLineItemRequest,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    q = conn.execute(
        text("SELECT id, currency FROM quotations WHERE quotation_ref = :ref"),
        {"ref": quotation_ref},
    ).fetchone()

    if not q:
        raise HTTPException(status_code=404, detail=f"Quotation {quotation_ref} not found")

    quotation_id = str(q[0])

    _insert_line_item(conn, quotation_id, {
        "component_type": body.component_type,
        "charge_code": body.charge_code,
        "description": body.description,
        "uom": body.uom,
        "quantity": body.quantity,
        "price_per_unit": body.price_per_unit,
        "min_price": body.min_price,
        "price_currency": body.price_currency,
        "price_conversion": 1.0,
        "cost_per_unit": body.cost_per_unit,
        "min_cost": body.min_cost,
        "cost_currency": body.cost_currency,
        "cost_conversion": 1.0,
        "source_table": None,
        "source_rate_id": None,
        "is_manual_override": True,
        "sort_order": 99,
    })

    conn.execute(
        text("UPDATE quotations SET updated_at = NOW() WHERE id = CAST(:qid AS uuid)"),
        {"qid": quotation_id},
    )

    logger.info("[quotations] Manual line item added to %s by %s", quotation_ref, claims.email)
    return {"status": "OK", "data": {"message": "Line item added"}}


# ---------------------------------------------------------------------------
# PATCH /quotations/{quotation_ref}/line-items/{item_id} — Edit line item
# ---------------------------------------------------------------------------

@router.patch("/quotations/{quotation_ref}/line-items/{item_id}")
async def update_line_item(
    quotation_ref: str,
    item_id: int,
    body: LineItemUpdateRequest,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    q = conn.execute(
        text("SELECT id FROM quotations WHERE quotation_ref = :ref"),
        {"ref": quotation_ref},
    ).fetchone()
    if not q:
        raise HTTPException(status_code=404, detail=f"Quotation {quotation_ref} not found")
    quotation_id = str(q[0])

    # Verify item belongs to this quotation
    item = conn.execute(
        text("SELECT id FROM quotation_line_items WHERE id = :iid AND quotation_id = CAST(:qid AS uuid)"),
        {"iid": item_id, "qid": quotation_id},
    ).fetchone()
    if not item:
        raise HTTPException(status_code=404, detail=f"Line item {item_id} not found in {quotation_ref}")

    # Build update
    updates = body.dict(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Always mark as manual override
    updates["is_manual_override"] = True
    updates["updated_at"] = datetime.now(timezone.utc)

    set_clauses = ", ".join(f"{k} = :{k}" for k in updates)
    updates["iid"] = item_id
    updates["qid"] = quotation_id

    conn.execute(
        text(f"UPDATE quotation_line_items SET {set_clauses} WHERE id = :iid AND quotation_id = CAST(:qid AS uuid)"),
        updates,
    )

    conn.execute(
        text("UPDATE quotations SET updated_at = NOW() WHERE id = CAST(:qid AS uuid)"),
        {"qid": quotation_id},
    )

    logger.info("[quotations] Line item %d updated in %s by %s", item_id, quotation_ref, claims.email)
    return {"status": "OK", "data": {"message": "Line item updated"}}


# ---------------------------------------------------------------------------
# DELETE /quotations/{quotation_ref}/line-items/{item_id} — Delete line item
# ---------------------------------------------------------------------------

@router.delete("/quotations/{quotation_ref}/line-items/{item_id}")
async def delete_line_item(
    quotation_ref: str,
    item_id: int,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    q = conn.execute(
        text("SELECT id FROM quotations WHERE quotation_ref = :ref"),
        {"ref": quotation_ref},
    ).fetchone()
    if not q:
        raise HTTPException(status_code=404, detail=f"Quotation {quotation_ref} not found")
    quotation_id = str(q[0])

    result = conn.execute(
        text("DELETE FROM quotation_line_items WHERE id = :iid AND quotation_id = CAST(:qid AS uuid)"),
        {"iid": item_id, "qid": quotation_id},
    )

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail=f"Line item {item_id} not found in {quotation_ref}")

    conn.execute(
        text("UPDATE quotations SET updated_at = NOW() WHERE id = CAST(:qid AS uuid)"),
        {"qid": quotation_id},
    )

    logger.info("[quotations] Line item %d deleted from %s by %s", item_id, quotation_ref, claims.email)
    return {"status": "OK", "data": {"message": "Line item deleted"}}
