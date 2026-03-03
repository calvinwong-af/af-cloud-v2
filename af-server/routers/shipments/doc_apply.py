"""
routers/shipments/doc_apply.py

Document apply endpoints: apply booking confirmation, apply AWB,
save document file.

File saving contract for document apply operations:
  - PATCH /bl                   → saves file inline (within the handler itself)
  - POST /apply-awb             → frontend calls /save-document-file after success
  - POST /apply-booking-confirmation → frontend calls /save-document-file after success
"""

import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import text

from core.auth import Claims, require_afu
from core.db import get_db
from core.constants import FILES_BUCKET_NAME

from ._helpers import (
    _parse_jsonb,
    _resolve_gcs_path,
    _save_file_to_gcs,
    _create_file_record,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Apply Booking Confirmation
# ---------------------------------------------------------------------------

class ApplyBookingConfirmationRequest(BaseModel):
    booking_reference: str | None = None
    carrier: str | None = None
    vessel_name: str | None = None
    voyage_number: str | None = None
    pol_code: str | None = None
    pod_code: str | None = None
    etd: str | None = None
    eta_pod: str | None = None
    containers: list | None = None
    cargo_description: str | None = None
    hs_code: str | None = None
    cargo_weight_kg: float | None = None


@router.post("/{shipment_id}/apply-booking-confirmation")
async def apply_booking_confirmation(
    shipment_id: str,
    body: ApplyBookingConfirmationRequest,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    # Read current shipment
    row = conn.execute(text("""
        SELECT id, booking, route_nodes FROM shipments WHERE id = :id
    """), {"id": shipment_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Shipment not found")

    now = datetime.now(timezone.utc).isoformat()

    # Build SET clauses
    set_clauses = ["updated_at = :now"]
    params: dict = {"id": shipment_id, "now": now}

    if body.booking_reference is not None:
        set_clauses.append("booking_reference = :booking_reference")
        params["booking_reference"] = body.booking_reference

    if body.pol_code:
        set_clauses.append("origin_port = :origin_port")
        params["origin_port"] = body.pol_code

    if body.pod_code:
        set_clauses.append("dest_port = :dest_port")
        params["dest_port"] = body.pod_code

    # Merge into booking JSONB
    booking = _parse_jsonb(row[1]) or {}
    if not isinstance(booking, dict): booking = {}
    if body.vessel_name is not None:
        booking["vessel_name"] = body.vessel_name
    if body.voyage_number is not None:
        booking["voyage_number"] = body.voyage_number
    if body.carrier is not None:
        booking["carrier"] = body.carrier
    set_clauses.append("booking = CAST(:booking AS jsonb)")
    params["booking"] = json.dumps(booking)

    # Write ETD/ETA flat columns unconditionally (works for V1 shipments with no route nodes)
    if body.etd:
        set_clauses.append("etd = :etd")
        params["etd"] = body.etd
    if body.eta_pod:
        set_clauses.append("eta = :eta")
        params["eta"] = body.eta_pod

    # Also update route node timings if nodes exist
    nodes = _parse_jsonb(row[2]) or []
    if not isinstance(nodes, list): nodes = []
    for node in nodes:
        if node.get("role") == "ORIGIN" and body.etd:
            node["scheduled_etd"] = body.etd
        if node.get("role") == "DESTINATION" and body.eta_pod:
            node["scheduled_eta"] = body.eta_pod
    if nodes:
        set_clauses.append("route_nodes = CAST(:route_nodes AS jsonb)")
        params["route_nodes"] = json.dumps(nodes)

    conn.execute(text(f"""
        UPDATE shipments SET {', '.join(set_clauses)} WHERE id = :id
    """), params)

    logger.info("[apply-bc] Updated %s with booking confirmation data", shipment_id)
    return {"shipment_id": shipment_id, "status": "OK"}


# ---------------------------------------------------------------------------
# Apply AWB
# ---------------------------------------------------------------------------

class ApplyAWBRequest(BaseModel):
    awb_type: str | None = None
    hawb_number: str | None = None
    mawb_number: str | None = None
    shipper_name: str | None = None
    shipper_address: str | None = None
    consignee_name: str | None = None
    consignee_address: str | None = None
    notify_party: str | None = None
    origin_iata: str | None = None
    dest_iata: str | None = None
    flight_number: str | None = None
    flight_date: str | None = None
    pieces: int | None = None
    gross_weight_kg: float | None = None
    chargeable_weight_kg: float | None = None
    cargo_description: str | None = None
    hs_code: str | None = None


@router.post("/{shipment_id}/apply-awb")
async def apply_awb(
    shipment_id: str,
    body: ApplyAWBRequest,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    # Read current shipment
    row = conn.execute(text("""
        SELECT id, booking, parties, type_details, cargo, route_nodes FROM shipments WHERE id = :id
    """), {"id": shipment_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Shipment not found")

    now = datetime.now(timezone.utc).isoformat()

    set_clauses = ["updated_at = :now"]
    params: dict = {"id": shipment_id, "now": now}

    if body.origin_iata:
        set_clauses.append("origin_port = :origin_port")
        params["origin_port"] = body.origin_iata

    if body.dest_iata:
        set_clauses.append("dest_port = :dest_port")
        params["dest_port"] = body.dest_iata

    if body.hawb_number is not None:
        set_clauses.append("hawb_number = :hawb_number")
        params["hawb_number"] = body.hawb_number

    if body.mawb_number is not None:
        set_clauses.append("mawb_number = :mawb_number")
        params["mawb_number"] = body.mawb_number

    if body.awb_type is not None:
        set_clauses.append("awb_type = :awb_type")
        params["awb_type"] = body.awb_type

    # Merge flight info into booking JSONB
    booking = _parse_jsonb(row[1]) or {}
    if not isinstance(booking, dict): booking = {}
    if body.flight_number is not None:
        booking["flight_number"] = body.flight_number
    if body.flight_date is not None:
        booking["flight_date"] = body.flight_date
    set_clauses.append("booking = CAST(:booking AS jsonb)")
    params["booking"] = json.dumps(booking)

    # Write flight_date to flat etd column so route card shows correct ETD
    if body.flight_date is not None:
        set_clauses.append("etd = :etd")
        params["etd"] = body.flight_date

    # Also update route node timings if nodes exist (match apply_booking_confirmation pattern)
    nodes = _parse_jsonb(row[5]) or []
    if not isinstance(nodes, list): nodes = []
    for node in nodes:
        if node.get("role") == "ORIGIN" and body.flight_date:
            node["scheduled_etd"] = body.flight_date
    if nodes:
        set_clauses.append("route_nodes = CAST(:route_nodes AS jsonb)")
        params["route_nodes"] = json.dumps(nodes)

    # Merge parties
    parties = _parse_jsonb(row[2]) or {}
    if not isinstance(parties, dict): parties = {}
    if body.shipper_name is not None or body.shipper_address is not None:
        shipper = parties.get("shipper") or {}
        if body.shipper_name is not None:
            shipper["name"] = body.shipper_name
        if body.shipper_address is not None:
            shipper["address"] = body.shipper_address
        parties["shipper"] = shipper
    if body.consignee_name is not None or body.consignee_address is not None:
        consignee = parties.get("consignee") or {}
        if body.consignee_name is not None:
            consignee["name"] = body.consignee_name
        if body.consignee_address is not None:
            consignee["address"] = body.consignee_address
        parties["consignee"] = consignee
    if body.notify_party is not None:
        notify = parties.get("notify_party") or {}
        notify["name"] = body.notify_party
        parties["notify_party"] = notify
    set_clauses.append("parties = CAST(:parties AS jsonb)")
    params["parties"] = json.dumps(parties)

    # Merge cargo fields (pieces, weight, description, hs_code) into type_details + cargo JSONB
    type_details = _parse_jsonb(row[3]) or {}
    if not isinstance(type_details, dict): type_details = {}
    if body.pieces is not None:
        type_details["pieces"] = body.pieces
    if body.chargeable_weight_kg is not None:
        type_details["chargeable_weight"] = body.chargeable_weight_kg
    set_clauses.append("type_details = CAST(:type_details AS jsonb)")
    params["type_details"] = json.dumps(type_details)

    cargo = _parse_jsonb(row[4]) or {}
    if not isinstance(cargo, dict): cargo = {}
    if body.gross_weight_kg is not None:
        cargo["weight_kg"] = body.gross_weight_kg
    if body.cargo_description is not None:
        cargo["description"] = body.cargo_description
    if body.hs_code is not None:
        cargo["hs_code"] = body.hs_code
    set_clauses.append("cargo = CAST(:cargo AS jsonb)")
    params["cargo"] = json.dumps(cargo)

    conn.execute(text(f"""
        UPDATE shipments SET {', '.join(set_clauses)} WHERE id = :id
    """), params)

    logger.info("[apply-awb] Updated %s with AWB data", shipment_id)
    return {"shipment_id": shipment_id, "status": "OK"}


# ---------------------------------------------------------------------------
# Save document file — standard post-apply file saving pattern
# ---------------------------------------------------------------------------

@router.post("/{shipment_id}/save-document-file")
async def save_document_file(
    shipment_id: str,
    file: UploadFile = File(...),
    doc_type: str = Form(...),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """
    Save an uploaded AWB, BC, or BL document to GCS and create a shipment_files record.
    Called by the frontend after applyAWBAction or applyBookingConfirmationAction succeeds.
    doc_type must be one of: AWB, BC, BL.
    """
    file_bytes = await file.read()
    file_content_type = file.content_type or "application/pdf"
    file_original_name = file.filename or f"{doc_type}_{shipment_id}.pdf"

    logger.info(
        "[save-document-file] Received file=%s content_type=%s size=%d bytes for %s",
        file_original_name, file_content_type, len(file_bytes), shipment_id,
    )

    if len(file_bytes) == 0:
        logger.error("[save-document-file] Empty file received for %s — aborting", shipment_id)
        raise HTTPException(status_code=400, detail="Empty file received")

    # Map doc_type → file tag
    tag_map = {"AWB": "awb", "BC": "bc", "BL": "bl"}
    tag = tag_map.get(doc_type.upper(), doc_type.lower())

    # Read company_id
    row = conn.execute(
        text("SELECT company_id FROM shipments WHERE id = :id"),
        {"id": shipment_id},
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Shipment not found")
    company_id = row[0] or ""

    gcs_path = _resolve_gcs_path(company_id, shipment_id, file_original_name)

    from google.cloud import storage as gcs_storage
    gcs_client = gcs_storage.Client(project="cloud-accele-freight")
    bucket = gcs_client.bucket(FILES_BUCKET_NAME)
    _save_file_to_gcs(bucket, gcs_path, file_bytes, file_content_type)

    file_record = _create_file_record(
        conn=conn,
        shipment_id=shipment_id,
        company_id=company_id,
        file_name=file_original_name,
        gcs_path=gcs_path,
        file_size_kb=len(file_bytes) / 1024.0,
        file_tags=[tag],
        visibility=True,
        uploader_uid=claims.uid,
        uploader_email=claims.email,
    )

    logger.info("[save-document-file] Saved %s for %s by %s", doc_type, shipment_id, claims.uid)
    return {"status": "OK", "data": file_record}
