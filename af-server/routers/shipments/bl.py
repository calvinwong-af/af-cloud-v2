"""
routers/shipments/bl.py

BL parsing, shipment creation from BL, BL update, and parties update endpoints.
"""

import base64
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import text

from core.auth import Claims, require_afu
from core.db import get_db
from core import db_queries
from core.exceptions import NotFoundError
from core.constants import (
    FILES_BUCKET_NAME,
    STATUS_LABELS,
    STATUS_BOOKING_CONFIRMED,
)
from logic.incoterm_tasks import generate_tasks as generate_incoterm_tasks

from ._helpers import (
    _parse_jsonb,
    _match_port_un_code,
    _match_company,
    _determine_initial_status,
    _resolve_gcs_path,
    _save_file_to_gcs,
    _create_file_record,
    _maybe_unblock_export_clearance_pg,
    _log_system_action_pg,
)
from ._prompts import (
    _BL_EXTRACTION_PROMPT,
    _CLASSIFY_PROMPT_LOCAL,
    _BC_EXTRACTION_PROMPT_LOCAL,
    _AWB_EXTRACTION_PROMPT_LOCAL,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Parse BL — Claude API extraction
# ---------------------------------------------------------------------------

@router.post("/parse-bl")
async def parse_bl(
    file: UploadFile = File(...),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """
    Parse a Bill of Lading PDF or image using Claude API.
    Returns structured extracted data + company matches + derived fields.
    """
    import os

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    # Read file bytes
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file")

    # Determine media type
    content_type = file.content_type or ""
    if "pdf" in content_type:
        media_type = "application/pdf"
    elif "png" in content_type:
        media_type = "image/png"
    elif "jpeg" in content_type or "jpg" in content_type:
        media_type = "image/jpeg"
    elif "webp" in content_type:
        media_type = "image/webp"
    else:
        # Try to detect from filename
        fname = (file.filename or "").lower()
        if fname.endswith(".pdf"):
            media_type = "application/pdf"
        elif fname.endswith(".png"):
            media_type = "image/png"
        elif fname.endswith((".jpg", ".jpeg")):
            media_type = "image/jpeg"
        else:
            media_type = "application/pdf"  # default

    # Call Claude API
    import anthropic
    client_ai = anthropic.Anthropic(api_key=api_key)
    file_b64 = base64.b64encode(file_bytes).decode()

    def _call_claude_local(prompt: str, max_tokens: int = 512) -> str:
        """Call Claude with the uploaded file and a prompt. Returns raw text."""
        if media_type == "application/pdf":
            content = [
                {"type": "document", "source": {"type": "base64", "media_type": media_type, "data": file_b64}},
                {"type": "text", "text": prompt},
            ]
        else:
            content = [
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": file_b64}},
                {"type": "text", "text": prompt},
            ]
        msg = client_ai.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": content}],
        )
        return msg.content[0].text if msg.content else ""

    def _strip_fences(text: str) -> str:
        text = text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        if text.startswith("json"):
            text = text[4:]
        return text.strip()

    # --- Step 1: Classify ---
    try:
        raw_classify = _call_claude_local(_CLASSIFY_PROMPT_LOCAL, max_tokens=64)
        classify_json = json.loads(_strip_fences(raw_classify))
        doc_type = classify_json.get("doc_type", "UNKNOWN")
        if doc_type not in ("BL", "AWB", "BOOKING_CONFIRMATION"):
            doc_type = "BL"
        logger.info("[parse-bl] Classified as %s", doc_type)
    except Exception as e:
        logger.warning("[parse-bl] Classification failed (%s) — defaulting to BL", e)
        doc_type = "BL"

    # --- Step 2: Extract based on doc_type ---
    extraction_prompt = {
        "BL": _BL_EXTRACTION_PROMPT,
        "BOOKING_CONFIRMATION": _BC_EXTRACTION_PROMPT_LOCAL,
        "AWB": _AWB_EXTRACTION_PROMPT_LOCAL,
    }[doc_type]

    try:
        raw_text = _call_claude_local(extraction_prompt, max_tokens=4096)
        raw_text = _strip_fences(raw_text)
        parsed = json.loads(raw_text)
    except json.JSONDecodeError:
        logger.error("Failed to parse Claude response as JSON: %s", raw_text[:500])
        raise HTTPException(status_code=502, detail="AI returned invalid JSON")
    except Exception as e:
        logger.error("Claude API call failed: %s", e)
        raise HTTPException(status_code=502, detail=f"AI parsing failed: {str(e)}")

    # --- Step 3: Post-process per doc_type ---
    if doc_type == "BOOKING_CONFIRMATION":
        pol = (parsed.get("pol_code") or parsed.get("pol_name") or "").strip()
        pod = (parsed.get("pod_code") or parsed.get("pod_name") or "").strip()
        parsed_for_response = {
            "waybill_number": parsed.get("booking_reference"),
            "booking_number": parsed.get("booking_reference"),
            "carrier_agent": parsed.get("carrier"),
            "carrier": parsed.get("carrier"),
            "vessel_name": parsed.get("vessel_name"),
            "voyage_number": parsed.get("voyage_number"),
            "port_of_loading": pol,
            "port_of_discharge": pod,
            "on_board_date": parsed.get("etd"),
            "freight_terms": None,
            "shipper_name": parsed.get("shipper") or parsed.get("booking_party"),
            "shipper_address": None,
            "consignee_name": None,
            "consignee_address": None,
            "notify_party_name": None,
            "cargo_description": parsed.get("cargo_description"),
            "total_weight_kg": parsed.get("cargo_weight_kg"),
            "total_packages": None,
            "delivery_status": None,
            "containers": [
                {
                    "container_number": c.get("container_number"),
                    "container_type": c.get("size"),
                    "seal_number": None,
                    "packages": str(c.get("quantity")) if c.get("quantity") else None,
                    "weight_kg": c.get("gross_weight_kg"),
                }
                for c in (parsed.get("containers") or [])
                if isinstance(c, dict)
            ],
            "cargo_items": None,
        }
        order_type = "SEA_FCL"
        initial_status = STATUS_BOOKING_CONFIRMED  # BC always means vessel not yet departed
        origin_parsed_label = pol or None
        destination_parsed_label = pod or None
        origin_un_code = _match_port_un_code(conn, pol) if pol else None
        destination_un_code = _match_port_un_code(conn, pod) if pod else None
        company_matches = []

    elif doc_type == "AWB":
        parsed_for_response = parsed  # Keep AWB fields as-is
        order_type = "AIR"
        initial_status = STATUS_BOOKING_CONFIRMED
        origin_iata = (parsed.get("origin_iata") or "").strip().upper()
        dest_iata = (parsed.get("dest_iata") or "").strip().upper()
        origin_un_code = origin_iata or None
        destination_un_code = dest_iata or None
        origin_parsed_label = origin_iata or None
        destination_parsed_label = dest_iata or None
        company_matches = _match_company(conn, parsed.get("consignee_name") or "")

    else:  # BL
        parsed_for_response = parsed
        containers = parsed.get("containers") or []
        delivery_status = (parsed.get("delivery_status") or "").upper()
        if containers and len(containers) > 0:
            order_type = "SEA_FCL"
        elif "LCL" in delivery_status:
            order_type = "SEA_LCL"
        else:
            order_type = "SEA_FCL"
        origin_parsed_label = (parsed.get("port_of_loading") or "").strip()
        destination_parsed_label = (parsed.get("port_of_discharge") or "").strip()
        origin_un_code = _match_port_un_code(conn, origin_parsed_label)
        destination_un_code = _match_port_un_code(conn, destination_parsed_label)
        initial_status = _determine_initial_status(parsed.get("on_board_date"))
        company_matches = _match_company(conn, parsed.get("consignee_name") or "")

    return {
        "parsed": parsed_for_response,
        "doc_type": doc_type,
        "order_type": order_type,
        "origin_un_code": origin_un_code,
        "origin_parsed_label": origin_parsed_label or None,
        "destination_un_code": destination_un_code,
        "destination_parsed_label": destination_parsed_label or None,
        "initial_status": initial_status,
        "company_matches": company_matches,
    }


# ---------------------------------------------------------------------------
# Create shipment from BL  (V2 only)
# ---------------------------------------------------------------------------

class CreateFromBLRequest(BaseModel):
    order_type: str = "SEA_FCL"
    transaction_type: str = "IMPORT"
    incoterm_code: str = "CNF"
    company_id: str | None = None
    origin_port_un_code: str | None = None
    origin_terminal_id: str | None = None
    origin_label: str | None = None
    destination_port_un_code: str | None = None
    destination_terminal_id: str | None = None
    destination_label: str | None = None
    cargo_description: str | None = None
    cargo_weight_kg: float | None = None
    etd: str | None = None
    initial_status: int = 3002
    carrier: str | None = None
    waybill_number: str | None = None
    vessel_name: str | None = None
    voyage_number: str | None = None
    shipper_name: str | None = None
    shipper_address: str | None = None
    consignee_name: str | None = None
    consignee_address: str | None = None
    notify_party_name: str | None = None
    containers: list | None = None
    customer_reference: str | None = None
    # AWB-specific fields
    mawb_number: str | None = None
    hawb_number: str | None = None
    awb_type: str | None = None
    flight_number: str | None = None
    flight_date: str | None = None
    pieces: int | None = None
    chargeable_weight_kg: float | None = None


@router.post("/create-from-bl")
async def create_from_bl(
    body: CreateFromBLRequest,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """
    Create a V2 shipment from parsed BL data.
    Creates shipment + shipment_workflow + auto-generates tasks.
    """
    now = datetime.now(timezone.utc).isoformat()

    # Generate shipment ID from sequence
    shipment_id, new_countid = db_queries.next_shipment_id(conn)

    # Build origin/destination JSONB
    origin = None
    if body.origin_port_un_code:
        origin = {
            "type": "PORT",
            "port_un_code": body.origin_port_un_code,
            "terminal_id": body.origin_terminal_id,
            "city_id": None,
            "address": None,
            "country_code": None,
            "label": body.origin_label or body.origin_port_un_code or "",
        }

    destination = None
    if body.destination_port_un_code:
        destination = {
            "type": "PORT",
            "port_un_code": body.destination_port_un_code,
            "terminal_id": body.destination_terminal_id,
            "city_id": None,
            "address": None,
            "country_code": None,
            "label": body.destination_label or body.destination_port_un_code or "",
        }

    cargo = {
        "description": body.cargo_description or "",
        "hs_code": None,
        "is_dg": False,
        "dg_class": None,
        "dg_un_number": None,
    }

    booking: dict = {
        "carrier": body.carrier,
        "booking_reference": body.waybill_number,
        "vessel_name": body.vessel_name,
        "voyage_number": body.voyage_number,
    }
    if body.flight_number is not None:
        booking["flight_number"] = body.flight_number
    if body.flight_date is not None:
        booking["flight_date"] = body.flight_date

    parties = {}
    if body.shipper_name:
        parties["shipper"] = {"name": body.shipper_name, "address": body.shipper_address, "contact_person": None, "phone": None, "email": None, "company_id": None, "company_contact_id": None}
    if body.consignee_name:
        parties["consignee"] = {"name": body.consignee_name, "address": body.consignee_address, "contact_person": None, "phone": None, "email": None, "company_id": body.company_id, "company_contact_id": None}
    if body.notify_party_name:
        parties["notify_party"] = {"name": body.notify_party_name, "address": None, "contact_person": None, "phone": None, "email": None, "company_id": None, "company_contact_id": None}

    initial_history = [{
        "status": body.initial_status,
        "label": STATUS_LABELS.get(body.initial_status, str(body.initial_status)),
        "timestamp": now,
        "changed_by": claims.email,
        "note": "Created from BL upload",
    }]

    creator = {"uid": claims.uid, "email": claims.email}

    # Type details for containers / air
    type_details = None
    if body.order_type == "AIR":
        type_details = {
            "type": "AIR",
            "packages": [],
            "chargeable_weight": body.chargeable_weight_kg,
            "pieces": body.pieces,
        }
    elif body.containers:
        type_details = {"containers": body.containers}

    # Insert into shipments table
    conn.execute(text("""
        INSERT INTO shipments (
            id, countid, company_id, order_type, transaction_type, incoterm_code,
            status, issued_invoice, status_history,
            origin_port, origin_terminal, dest_port, dest_terminal,
            cargo, type_details, booking, parties, bl_document,
            exception_data, route_nodes, trash,
            cargo_ready_date, etd, creator,
            hawb_number, mawb_number, awb_type,
            migrated_from_v1, created_at, updated_at
        ) VALUES (
            :id, :countid, :company_id, :order_type, :transaction_type, :incoterm_code,
            :status, FALSE, CAST(:status_history AS jsonb),
            :origin_port, :origin_terminal, :dest_port, :dest_terminal,
            CAST(:cargo AS jsonb), CAST(:type_details AS jsonb), CAST(:booking AS jsonb), CAST(:parties AS jsonb), NULL,
            NULL, NULL, FALSE,
            NULL, :etd, CAST(:creator AS jsonb),
            :hawb_number, :mawb_number, :awb_type,
            FALSE, :now, :now
        )
    """), {
        "id": shipment_id,
        "countid": new_countid,
        "company_id": body.company_id or "",
        "order_type": body.order_type,
        "transaction_type": body.transaction_type,
        "incoterm_code": body.incoterm_code,
        "status": body.initial_status,
        "now": now,
        "status_history": json.dumps(initial_history),
        "origin_port": body.origin_port_un_code or "",
        "origin_terminal": body.origin_terminal_id,
        "dest_port": body.destination_port_un_code or "",
        "dest_terminal": body.destination_terminal_id,
        "cargo": json.dumps(cargo),
        "type_details": json.dumps(type_details) if type_details else None,
        "booking": json.dumps(booking),
        "parties": json.dumps(parties),
        "creator": json.dumps(creator),
        "etd": body.etd,
        "hawb_number": body.hawb_number,
        "mawb_number": body.mawb_number,
        "awb_type": body.awb_type,
    })

    # Auto-generate tasks
    from datetime import date as _date
    etd_date = None
    if body.etd:
        try:
            etd_date = _date.fromisoformat(body.etd[:10])
        except (ValueError, TypeError):
            pass

    tasks = generate_incoterm_tasks(
        incoterm=body.incoterm_code,
        transaction_type=body.transaction_type,
        etd=etd_date,
        updated_by=claims.email,
    )

    wf_history = [{
        "status": body.initial_status,
        "status_label": STATUS_LABELS.get(body.initial_status, str(body.initial_status)),
        "timestamp": now,
        "changed_by": claims.uid,
    }]

    # Insert into shipment_workflows table
    conn.execute(text("""
        INSERT INTO shipment_workflows (
            shipment_id, company_id, status_history, workflow_tasks,
            completed, created_at, updated_at
        ) VALUES (
            :shipment_id, :company_id, CAST(:status_history AS jsonb), CAST(:workflow_tasks AS jsonb),
            FALSE, :now, :now
        )
    """), {
        "shipment_id": shipment_id,
        "company_id": body.company_id or "",
        "status_history": json.dumps(wf_history),
        "workflow_tasks": json.dumps(tasks),
        "now": now,
    })

    logger.info("Shipment %s created from BL by %s", shipment_id, claims.uid)

    return {
        "status": "OK",
        "data": {"shipment_id": shipment_id},
        "msg": "Shipment created from BL",
    }


# ---------------------------------------------------------------------------
# PATCH /shipments/{shipment_id}/bl  — Update from BL
# ---------------------------------------------------------------------------

@router.patch("/{shipment_id}/bl")
async def update_from_bl(
    shipment_id: str,
    waybill_number: Optional[str] = Form(None),
    carrier: Optional[str] = Form(None),
    carrier_agent: Optional[str] = Form(None),
    vessel_name: Optional[str] = Form(None),
    voyage_number: Optional[str] = Form(None),
    etd: Optional[str] = Form(None),
    shipper_name: Optional[str] = Form(None),
    shipper_address: Optional[str] = Form(None),
    consignee_name: Optional[str] = Form(None),
    consignee_address: Optional[str] = Form(None),
    notify_party_name: Optional[str] = Form(None),
    bl_shipper_name: Optional[str] = Form(None),
    bl_shipper_address: Optional[str] = Form(None),
    bl_consignee_name: Optional[str] = Form(None),
    bl_consignee_address: Optional[str] = Form(None),
    force_update: Optional[str] = Form(None),
    containers: Optional[str] = Form(None),
    cargo_items: Optional[str] = Form(None),
    origin_port: Optional[str] = Form(None),
    dest_port: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """
    Update a shipment from parsed BL data. AFU only.
    Accepts multipart/form-data with optional BL PDF file.
    """
    # Read file bytes immediately — stream cannot be re-read later
    file_bytes = await file.read() if file else None
    file_content_type = file.content_type if file else None
    file_original_name = file.filename if file else None

    now = datetime.now(timezone.utc).isoformat()

    # Load shipment
    row = conn.execute(text("""
        SELECT id, company_id, booking, parties, bl_document, type_details, trash
        FROM shipments WHERE id = :id
    """), {"id": shipment_id}).fetchone()

    if not row:
        raise NotFoundError(f"Shipment {shipment_id} not found")
    if row[6]:  # trash
        raise HTTPException(status_code=410, detail=f"Shipment {shipment_id} has been deleted")

    company_id = row[1] or ""
    booking = _parse_jsonb(row[2]) or {}
    if not isinstance(booking, dict):
        booking = {}
    parties = _parse_jsonb(row[3]) or {}
    if not isinstance(parties, dict):
        parties = {}
    bl_doc = _parse_jsonb(row[4]) or {}
    if not isinstance(bl_doc, dict):
        bl_doc = {}
    type_details = _parse_jsonb(row[5]) or {}
    if not isinstance(type_details, dict):
        type_details = {}

    # Merge booking fields (don't replace whole dict)
    if waybill_number is not None:
        booking["booking_reference"] = waybill_number
    # Write carrier_agent as new field alongside existing carrier (backward compat)
    if carrier_agent is not None:
        booking["carrier_agent"] = carrier_agent
    elif carrier is not None:
        booking["carrier_agent"] = carrier
    if vessel_name is not None:
        booking["vessel_name"] = vessel_name
    if voyage_number is not None:
        booking["voyage_number"] = voyage_number

    # Also write flat fields so detail-page readers see updated values
    flat_updates: dict = {}
    # vessel_name and voyage_number live in booking JSONB only — no flat columns
    if etd is not None:
        flat_updates["etd"] = etd

    # Merge parties — shipper + consignee (don't replace whole parties dict)
    # Only write to parties if currently empty — unless force_update is set
    is_force = force_update == "true"

    if shipper_name is not None or shipper_address is not None:
        shipper = parties.get("shipper") or {}
        if not isinstance(shipper, dict):
            shipper = {}
        if (is_force or not shipper.get("name")) and shipper_name is not None:
            shipper["name"] = shipper_name
        if (is_force or not shipper.get("address")) and shipper_address is not None:
            shipper["address"] = shipper_address
        parties["shipper"] = shipper

    if consignee_name is not None or consignee_address is not None:
        consignee = parties.get("consignee") or {}
        if not isinstance(consignee, dict):
            consignee = {}
        if (is_force or not consignee.get("name")) and consignee_name is not None:
            consignee["name"] = consignee_name
        if (is_force or not consignee.get("address")) and consignee_address is not None:
            consignee["address"] = consignee_address
        parties["consignee"] = consignee

    if notify_party_name is not None:
        notify_party = parties.get("notify_party") or {}
        if not isinstance(notify_party, dict):
            notify_party = {}
        if is_force or not notify_party.get("name"):
            notify_party["name"] = notify_party_name
        parties["notify_party"] = notify_party

    # Write raw parsed BL values to bl_document (always overwrite — audit record)
    if bl_shipper_name is not None or bl_shipper_address is not None:
        bl_doc["shipper"] = {
            "name": bl_shipper_name,
            "address": bl_shipper_address,
        }
    if bl_consignee_name is not None or bl_consignee_address is not None:
        bl_doc["consignee"] = {
            "name": bl_consignee_name,
            "address": bl_consignee_address,
        }

    # Containers — replace array if provided and non-empty
    if containers is not None:
        try:
            containers_list = json.loads(containers)
        except (ValueError, TypeError):
            containers_list = None
        if containers_list:
            existing = type_details.get("containers") or []
            merged = []
            for i, bl_c in enumerate(containers_list):
                existing_row = existing[i] if i < len(existing) else {}
                merged_row = dict(existing_row)
                if bl_c.get("container_number"):
                    merged_row["container_number"] = bl_c["container_number"]
                if bl_c.get("seal_number"):
                    merged_row["seal_number"] = bl_c["seal_number"]
                if bl_c.get("container_type"):
                    merged_row["container_type"] = bl_c["container_type"]
                merged.append(merged_row)
            for bl_c in containers_list[len(existing):]:
                merged.append({
                    "container_number": bl_c.get("container_number"),
                    "container_type": bl_c.get("container_type"),
                    "seal_number": bl_c.get("seal_number"),
                    "container_size": None,
                    "quantity": 1,
                })
            type_details["containers"] = merged

    # Cargo items — replace array if provided and non-empty (LCL shipments)
    if cargo_items is not None:
        try:
            cargo_items_list = json.loads(cargo_items)
        except (ValueError, TypeError):
            cargo_items_list = None
        if cargo_items_list:
            type_details["cargo_items"] = cargo_items_list

    # Port updates — only write if provided and non-empty
    if origin_port and origin_port.strip():
        flat_updates["origin_port"] = origin_port.strip().upper()
    if dest_port and dest_port.strip():
        flat_updates["dest_port"] = dest_port.strip().upper()

    # Build UPDATE statement
    set_clauses = [
        "booking = CAST(:booking AS jsonb)",
        "parties = CAST(:parties AS jsonb)",
        "bl_document = CAST(:bl_document AS jsonb)",
        "type_details = CAST(:type_details AS jsonb)",
        "updated_at = :now",
    ]
    params: dict = {
        "booking": json.dumps(booking),
        "parties": json.dumps(parties),
        "bl_document": json.dumps(bl_doc) if bl_doc else None,
        "type_details": json.dumps(type_details) if type_details else None,
        "now": now,
        "id": shipment_id,
    }

    if "etd" in flat_updates:
        set_clauses.append("etd = :etd_flat")
        params["etd_flat"] = flat_updates["etd"]
    if "origin_port" in flat_updates:
        set_clauses.append("origin_port = :origin_port")
        params["origin_port"] = flat_updates["origin_port"]
    if "dest_port" in flat_updates:
        set_clauses.append("dest_port = :dest_port")
        params["dest_port"] = flat_updates["dest_port"]

    # Unblock export clearance if waybill set
    if waybill_number:
        _maybe_unblock_export_clearance_pg(conn, shipment_id, claims.uid)

    logger.info("[bl_update] Writing to shipments %s", shipment_id)
    try:
        conn.execute(text(f"""
            UPDATE shipments SET {', '.join(set_clauses)} WHERE id = :id
        """), params)
    except Exception as e:
        logger.error("[bl_update] Failed to write shipment %s: %s", shipment_id, str(e))
        raise HTTPException(status_code=500, detail=f"Failed to save shipment: {str(e)}")

    # Log to system_logs
    _log_system_action_pg(conn, "BL_UPDATED", shipment_id, claims.uid, claims.email)

    # Auto-save BL file if provided (file_bytes read at top of handler)
    if file_bytes:
        original_name = file_original_name or f"BL_{shipment_id}.pdf"
        gcs_path = _resolve_gcs_path(company_id, shipment_id, original_name)

        from google.cloud import storage as gcs_storage
        gcs_client = gcs_storage.Client(project="cloud-accele-freight")
        bucket = gcs_client.bucket(FILES_BUCKET_NAME)
        content_type = file_content_type or "application/pdf"
        _save_file_to_gcs(bucket, gcs_path, file_bytes, content_type)

        _create_file_record(
            conn=conn,
            shipment_id=shipment_id,
            company_id=company_id,
            file_name=original_name,
            gcs_path=gcs_path,
            file_size_kb=len(file_bytes) / 1024.0,
            file_tags=["bl"],
            visibility=True,
            uploader_uid=claims.uid,
            uploader_email=claims.email,
        )

    logger.info("BL update applied to %s by %s", shipment_id, claims.uid)

    return {
        "status": "OK",
        "data": {
            "shipment_id": shipment_id,
            "booking": booking,
            "parties": parties,
            "bl_document": bl_doc,
            "etd": flat_updates.get("etd"),
            "origin_port": flat_updates.get("origin_port"),
            "dest_port": flat_updates.get("dest_port"),
        },
        "msg": "Shipment updated from BL",
    }


# ---------------------------------------------------------------------------
# PATCH /shipments/{shipment_id}/parties
# ---------------------------------------------------------------------------

class UpdatePartiesRequest(BaseModel):
    shipper_name: Optional[str] = None
    shipper_address: Optional[str] = None
    consignee_name: Optional[str] = None
    consignee_address: Optional[str] = None
    notify_party_name: Optional[str] = None
    notify_party_address: Optional[str] = None


@router.patch("/{shipment_id}/parties")
async def update_parties(
    shipment_id: str,
    body: UpdatePartiesRequest,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """
    Update shipper/consignee on a shipment. AFU only.
    Merges into existing parties dict — preserves notify_party and other fields.
    Does NOT touch bl_document.
    """
    now = datetime.now(timezone.utc).isoformat()

    row = conn.execute(text("""
        SELECT parties FROM shipments WHERE id = :id
    """), {"id": shipment_id}).fetchone()

    if not row:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    parties = _parse_jsonb(row[0]) or {}
    if not isinstance(parties, dict):
        parties = {}

    # Merge shipper
    # "" clears a field, non-empty string sets it, None (absent) = don't touch
    if body.shipper_name is not None or body.shipper_address is not None:
        shipper = parties.get("shipper") or {}
        if not isinstance(shipper, dict):
            shipper = {}
        if body.shipper_name is not None:
            shipper["name"] = body.shipper_name
        if body.shipper_address is not None:
            shipper["address"] = body.shipper_address
        if not shipper.get("name") and not shipper.get("address"):
            parties.pop("shipper", None)
        else:
            parties["shipper"] = shipper

    # Merge consignee
    if body.consignee_name is not None or body.consignee_address is not None:
        consignee = parties.get("consignee") or {}
        if not isinstance(consignee, dict):
            consignee = {}
        if body.consignee_name is not None:
            consignee["name"] = body.consignee_name
        if body.consignee_address is not None:
            consignee["address"] = body.consignee_address
        if not consignee.get("name") and not consignee.get("address"):
            parties.pop("consignee", None)
        else:
            parties["consignee"] = consignee

    # Merge notify_party
    if body.notify_party_name is not None or body.notify_party_address is not None:
        notify_party = parties.get("notify_party") or {}
        if not isinstance(notify_party, dict):
            notify_party = {}
        if body.notify_party_name is not None:
            notify_party["name"] = body.notify_party_name
        if body.notify_party_address is not None:
            notify_party["address"] = body.notify_party_address
        if not notify_party.get("name") and not notify_party.get("address"):
            parties.pop("notify_party", None)
        else:
            parties["notify_party"] = notify_party

    conn.execute(text("""
        UPDATE shipments SET parties = CAST(:parties AS jsonb), updated_at = :now WHERE id = :id
    """), {"parties": json.dumps(parties), "now": now, "id": shipment_id})

    _log_system_action_pg(conn, "PARTIES_UPDATED", shipment_id, claims.uid, claims.email)

    return {
        "status": "OK",
        "data": {"parties": parties},
    }
