"""
routers/shipments/doc_apply.py

Document apply endpoints: apply booking confirmation, apply AWB,
save document file.

File saving contract for document apply operations:
  - PATCH /bl                         → saves file inline (within the handler itself)
  - POST /apply-awb                   → frontend calls POST /files after success
  - POST /apply-booking-confirmation  → frontend calls POST /files after success

Note: /save-document-file endpoint is retained for compatibility but is no
longer called by the frontend as of v2.90.
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

from ._helpers import _parse_jsonb, _resolve_document_status
from ._file_helpers import (
    _resolve_gcs_path,
    _save_file_to_gcs,
    _create_file_record,
)
from ._status_helpers import (
    _check_atd_advancement_pg,
    _sync_route_node_timings,
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
    shipper_name: str | None = None


@router.post("/{shipment_id}/apply-booking-confirmation")
async def apply_booking_confirmation(
    shipment_id: str,
    body: ApplyBookingConfirmationRequest,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    # Read current shipment (4a: include incoterm_code, transaction_type)
    row = conn.execute(text("""
        SELECT o.order_id, sd.booking, sd.type_details, sd.bl_document,
               sd.incoterm_code, sd.transaction_type
        FROM orders o
        JOIN shipment_details sd ON sd.order_id = o.order_id
        WHERE o.order_id = :id
    """), {"id": shipment_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Shipment not found")

    now = datetime.now(timezone.utc).isoformat()

    # Build SET clauses — shipment_details fields
    sd_clauses: list[str] = []
    params: dict = {"id": shipment_id, "now": now}

    if body.booking_reference is not None:
        sd_clauses.append("booking_reference = :booking_reference")
        params["booking_reference"] = body.booking_reference

    if body.pol_code:
        sd_clauses.append("origin_port = :origin_port")
        params["origin_port"] = body.pol_code

    if body.pod_code:
        sd_clauses.append("dest_port = :dest_port")
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
    sd_clauses.append("booking = CAST(:booking AS jsonb)")
    params["booking"] = json.dumps(booking)

    # Merge containers into type_details
    if body.containers is not None:
        type_details = _parse_jsonb(row[2]) or {}
        if not isinstance(type_details, dict):
            type_details = {}
        type_details["containers"] = [
            {"container_size": c.get("size") or c.get("container_size"), "quantity": c.get("quantity", 1)}
            for c in body.containers
        ] if body.containers else []
        sd_clauses.append("type_details = CAST(:type_details AS jsonb)")
        params["type_details"] = json.dumps(type_details)

    # Write parsed shipper to bl_document if present (BC may have shipper/booking_party)
    if body.shipper_name is not None:
        bl_doc = _parse_jsonb(row[3]) or {}
        if not isinstance(bl_doc, dict): bl_doc = {}
        bl_doc["shipper"] = {
            "name": body.shipper_name,
            "address": None,
        }
        sd_clauses.append("bl_document = CAST(:bl_document AS jsonb)")
        params["bl_document"] = json.dumps(bl_doc)

    if sd_clauses:
        conn.execute(text(f"""
            UPDATE shipment_details SET {', '.join(sd_clauses)} WHERE order_id = :id
        """), params)
    conn.execute(text("""
        UPDATE orders SET updated_at = :now WHERE order_id = :id
    """), params)

    # Sync ETD/ETA to TRACKED POL/POD workflow tasks (fill-blanks only)
    wf_row = conn.execute(text("""
        SELECT workflow_tasks FROM shipment_workflows WHERE order_id = :id
    """), {"id": shipment_id}).fetchone()
    if wf_row:
        tasks = _parse_jsonb(wf_row[0]) or []
        tasks_modified = False
        # Compute ETA POL fallback: if ETD present but no ETA POL supplied, use ETD - 1 day
        # ETA POL = scheduled_start on the POL TRACKED task (when cargo arrives at loading port)
        effective_eta_pol = None
        if body.etd:
            try:
                from datetime import date as _date, timedelta
                etd_d = _date.fromisoformat(body.etd[:10])
                effective_eta_pol = (etd_d - timedelta(days=1)).isoformat()
            except (ValueError, TypeError):
                pass

        for task in tasks:
            if task.get("mode") != "TRACKED":
                continue
            if task.get("task_type") == "POL" and body.etd:
                task["scheduled_end"] = body.etd          # ETD POL
                if effective_eta_pol:
                    task["scheduled_start"] = effective_eta_pol  # ETA POL fallback
                tasks_modified = True
            if task.get("task_type") == "POD" and body.eta_pod:
                task["scheduled_start"] = body.eta_pod    # ETA POD
                tasks_modified = True
        if tasks_modified:
            conn.execute(text("""
                UPDATE shipment_workflows
                SET workflow_tasks = CAST(:tasks AS jsonb), updated_at = :now
                WHERE order_id = :id
            """), {"tasks": json.dumps(tasks), "now": now, "id": shipment_id})

    # Sync route node timings — BC provides ETD POL, ETA POD, ETA POL (fallback)
    _sync_route_node_timings(
        conn, shipment_id, now,
        origin_scheduled_etd=body.etd or None,
        origin_scheduled_eta=effective_eta_pol,
        dest_scheduled_eta=body.eta_pod or None,
    )

    # 4b: Compute status from incoterm logic (not hard-coded)
    new_status = _resolve_document_status(row[4], row[5], body.etd)
    conn.execute(text("UPDATE orders SET status = :status WHERE order_id = :id"),
                 {"status": new_status, "id": shipment_id})
    # No ATD check for BC — vessel has not departed by definition

    logger.info("[apply-bc] Updated %s with booking confirmation data (status → %s)", shipment_id, new_status)
    return {"shipment_id": shipment_id, "status": "OK", "new_status": new_status}


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
        SELECT o.order_id, sd.booking, o.parties, sd.type_details, o.cargo,
               sd.incoterm_code, sd.transaction_type, sd.bl_document
        FROM orders o
        JOIN shipment_details sd ON sd.order_id = o.order_id
        WHERE o.order_id = :id
    """), {"id": shipment_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Shipment not found")

    now = datetime.now(timezone.utc).isoformat()

    sd_clauses: list[str] = []
    orders_clauses = ["updated_at = :now"]
    params: dict = {"id": shipment_id, "now": now}

    if body.origin_iata:
        sd_clauses.append("origin_port = :origin_port")
        params["origin_port"] = body.origin_iata

    if body.dest_iata:
        sd_clauses.append("dest_port = :dest_port")
        params["dest_port"] = body.dest_iata

    if body.hawb_number is not None:
        sd_clauses.append("hawb_number = :hawb_number")
        params["hawb_number"] = body.hawb_number

    if body.mawb_number is not None:
        sd_clauses.append("mawb_number = :mawb_number")
        params["mawb_number"] = body.mawb_number

    if body.awb_type is not None:
        sd_clauses.append("awb_type = :awb_type")
        params["awb_type"] = body.awb_type

    # Merge flight info into booking JSONB
    booking = _parse_jsonb(row[1]) or {}
    if not isinstance(booking, dict): booking = {}
    if body.flight_number is not None:
        booking["flight_number"] = body.flight_number
    if body.flight_date is not None:
        booking["flight_date"] = body.flight_date
    sd_clauses.append("booking = CAST(:booking AS jsonb)")
    params["booking"] = json.dumps(booking)

    # Merge parties (on orders)
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
    orders_clauses.append("parties = CAST(:parties AS jsonb)")
    params["parties"] = json.dumps(parties)

    # Merge cargo fields (pieces, weight, description, hs_code) into type_details + cargo JSONB
    type_details = _parse_jsonb(row[3]) or {}
    if not isinstance(type_details, dict): type_details = {}
    if body.pieces is not None:
        type_details["pieces"] = body.pieces
    if body.chargeable_weight_kg is not None:
        type_details["chargeable_weight"] = body.chargeable_weight_kg
    # Rebuild packages array from AWB pieces + gross weight so the Packages card renders correctly
    if body.pieces is not None or body.gross_weight_kg is not None:
        type_details["packages"] = [{
            "packaging_type": "PACKAGE",
            "quantity": body.pieces or 1,
            "gross_weight_kg": body.gross_weight_kg,
            "volume_cbm": None,
        }]
    sd_clauses.append("type_details = CAST(:type_details AS jsonb)")
    params["type_details"] = json.dumps(type_details)

    cargo = _parse_jsonb(row[4]) or {}
    if not isinstance(cargo, dict): cargo = {}
    if body.gross_weight_kg is not None:
        cargo["weight_kg"] = body.gross_weight_kg
    if body.cargo_description is not None:
        cargo["description"] = body.cargo_description
    if body.hs_code is not None:
        cargo["hs_code"] = body.hs_code
    orders_clauses.append("cargo = CAST(:cargo AS jsonb)")
    params["cargo"] = json.dumps(cargo)

    # Write parsed parties to bl_document (audit record of what the document contained)
    bl_doc = _parse_jsonb(row[7]) or {}
    if not isinstance(bl_doc, dict): bl_doc = {}
    if body.shipper_name is not None or body.shipper_address is not None:
        bl_doc["shipper"] = {
            "name": body.shipper_name,
            "address": body.shipper_address,
        }
    if body.consignee_name is not None or body.consignee_address is not None:
        bl_doc["consignee"] = {
            "name": body.consignee_name,
            "address": body.consignee_address,
        }
    sd_clauses.append("bl_document = CAST(:bl_document AS jsonb)")
    params["bl_document"] = json.dumps(bl_doc) if bl_doc else None

    conn.execute(text(f"""
        UPDATE orders SET {', '.join(orders_clauses)} WHERE order_id = :id
    """), params)
    if sd_clauses:
        conn.execute(text(f"""
            UPDATE shipment_details SET {', '.join(sd_clauses)} WHERE order_id = :id
        """), params)

    # Sync flight_date to TRACKED POL task actual_end (AWB = already-flown document)
    # Also seed scheduled_end if blank
    if body.flight_date:
        wf_row = conn.execute(text("""
            SELECT workflow_tasks FROM shipment_workflows WHERE order_id = :id
        """), {"id": shipment_id}).fetchone()
        if wf_row:
            tasks = _parse_jsonb(wf_row[0]) or []
            tasks_modified = False
            for task in tasks:
                if task.get("task_type") == "POL" and task.get("mode") == "TRACKED":
                    task["actual_end"] = body.flight_date
                    if not task.get("scheduled_end"):
                        task["scheduled_end"] = body.flight_date
                    tasks_modified = True
                    break
            if tasks_modified:
                conn.execute(text("""
                    UPDATE shipment_workflows
                    SET workflow_tasks = CAST(:tasks AS jsonb), updated_at = :now
                    WHERE order_id = :id
                """), {"tasks": json.dumps(tasks), "now": now, "id": shipment_id})

    # Sync route node timings — AWB is post-flight, actual only
    # Do NOT write scheduled_etd — that belongs to BC (planning document)
    if body.flight_date:
        _sync_route_node_timings(
            conn, shipment_id, now,
            origin_actual_etd=body.flight_date,
        )

    # Auto-advance status based on incoterm classification
    incoterm_code = row[5]   # incoterm_code
    txn_type = row[6]        # transaction_type
    new_status = _resolve_document_status(incoterm_code, txn_type, body.flight_date)
    conn.execute(text("UPDATE orders SET status = :status WHERE order_id = :id"),
                 {"status": new_status, "id": shipment_id})
    new_status = _check_atd_advancement_pg(
        conn, shipment_id, new_status, claims.email, "Auto-advanced from ATD (AWB apply)"
    )

    logger.info("[apply-awb] Updated %s with AWB data (status → %s)", shipment_id, new_status)
    return {"shipment_id": shipment_id, "status": "OK", "new_status": new_status}


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
        text("SELECT company_id FROM orders WHERE order_id = :id"),
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
