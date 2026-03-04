"""
routers/shipments/_helpers.py

Shared helper functions and constants used across shipments sub-modules.
This module must NOT import from other sub-modules (leaf in the dependency graph).
"""

import json
import logging
from datetime import datetime, timezone

from sqlalchemy import text

from core.constants import (
    FILES_BUCKET_NAME,
    STATUS_BOOKING_CONFIRMED,
    STATUS_DEPARTED,
    STATUS_LABELS,
)
from logic.incoterm_tasks import (
    FREIGHT_BOOKING,
    EXPORT_CLEARANCE,
    PENDING,
    COMPLETED,
    BLOCKED,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helper: parse JSONB values that may come back as str or dict
# ---------------------------------------------------------------------------

# BEST PRACTICE: Always use _parse_jsonb() when reading JSONB columns from PostgreSQL rows.
# SQLAlchemy + psycopg2 may return JSONB as an already-parsed dict or list — never as a raw
# string — depending on driver version and column type registration. Calling json.loads()
# directly on a JSONB column value will raise TypeError at runtime.
# CORRECT:   val = _parse_jsonb(row[n]) or {}
# INCORRECT: val = json.loads(row[n]) if row[n] else {}
def _parse_jsonb(val):
    """Parse a JSONB value from the database (may already be dict or str)."""
    if val is None:
        return None
    if isinstance(val, (dict, list)):
        return val
    if isinstance(val, str):
        try:
            return json.loads(val)
        except (ValueError, TypeError):
            return val
    return val


# ---------------------------------------------------------------------------
# GCS / file helpers
# ---------------------------------------------------------------------------

def _resolve_gcs_path(company_id: str, shipment_id: str, filename: str) -> str:
    """
    Build GCS upload path matching existing Files entity patterns.
    Pattern: company/{company_id}/shipments/{shipment_id}/{filename}
    """
    safe_company = company_id or "unknown"
    return f"company/{safe_company}/shipments/{shipment_id}/{filename}"


def _file_row_to_dict(row) -> dict:
    """Convert a shipment_files row to a response dict."""
    cols = row._mapping
    d = dict(cols)
    d["file_id"] = d.get("id")
    raw_tags = d.get("file_tags")
    if isinstance(raw_tags, list):
        d["file_tags"] = raw_tags
    elif isinstance(raw_tags, str):
        try:
            d["file_tags"] = json.loads(raw_tags)
        except (ValueError, TypeError):
            d["file_tags"] = []
    else:
        d["file_tags"] = []
    d["user"] = d.get("uploaded_by_email") or d.get("uploaded_by_uid") or "Unknown"
    d["created"] = str(d.get("created_at") or "")
    d["updated"] = str(d.get("updated_at") or "")
    return d


def _save_file_to_gcs(bucket, gcs_path: str, file_bytes: bytes, content_type: str = "application/octet-stream"):
    """Upload bytes to GCS at the given path."""
    blob = bucket.blob(gcs_path)
    blob.upload_from_string(file_bytes, content_type=content_type)


def _create_file_record(
    conn,
    shipment_id: str,
    company_id: str,
    file_name: str,
    gcs_path: str,
    file_size_kb: float,
    file_tags: list,
    visibility: bool,
    uploader_uid: str,
    uploader_email: str,
) -> dict:
    """Insert a file record into shipment_files and return it as dict."""
    now = datetime.now(timezone.utc).isoformat()

    row = conn.execute(text("""
        INSERT INTO shipment_files (
            shipment_id, company_id, file_name, file_location,
            file_tags, file_description, file_size_kb, visibility,
            notification_sent, uploaded_by_uid, uploaded_by_email,
            trash, created_at, updated_at
        ) VALUES (
            :shipment_id, :company_id, :file_name, :file_location,
            :file_tags, NULL, :file_size_kb, :visibility,
            FALSE, :uploaded_by_uid, :uploaded_by_email,
            FALSE, :now, :now
        )
        RETURNING *
    """), {
        "shipment_id": shipment_id,
        "company_id": company_id,
        "file_name": file_name,
        "file_location": gcs_path,
        "file_tags": file_tags or [],
        "file_size_kb": round(file_size_kb, 2),
        "visibility": visibility,
        "uploaded_by_uid": uploader_uid,
        "uploaded_by_email": uploader_email,
        "now": now,
    }).fetchone()

    return _file_row_to_dict(row)


# ---------------------------------------------------------------------------
# Port matching helpers
# ---------------------------------------------------------------------------

_PORT_ALIASES: dict[str, str] = {
    "PORT KELANG":     "MYPKG",
    "KELANG":          "MYPKG",
    "PORT KLANG":      "MYPKG",
    "KLANG":           "MYPKG",
    "TANJUNG PELEPAS": "MYTPP",
    "PTP":             "MYTPP",
    "TANJUNG PRIOK":   "IDJKT",
    "PRIOK":           "IDJKT",
    "JAKARTA":         "IDJKT",
    "LAEM CHABANG":    "THLCH",
    "HAIPHONG":        "VNHPH",
    "HO CHI MINH":     "VNSGN",
    "SAIGON":          "VNSGN",
    "VUNG TAU":        "VNVUT",
    "SHANGHAI":        "CNSHA",
    "NINGBO":          "CNNGB",
    "SHENZHEN":        "CNSZX",
    "YANTIAN":         "CNYTN",
    "GUANGZHOU":       "CNGZU",
    "NANSHA":          "CNNSA",
    "BUSAN":           "KRPUS",
    "PUSAN":           "KRPUS",
    "HAMBURG":         "DEHAM",
    "BREMERHAVEN":     "DEBRV",
    "ROTTERDAM":       "NLRTM",
    "ANTWERP":         "BEANR",
    "FELIXSTOWE":      "GBFXT",
    "SINGAPORE":       "SGSIN",
    "HONG KONG":       "HKHKG",
    "DUBAI":           "AEDXB",
    "JEBEL ALI":       "AEJEA",
    "COLOMBO":         "LKCMB",
    "CHENNAI":         "INMAA",
    "MUNDRA":          "INMUN",
    "NHAVA SHEVA":     "INNSA",
    "JAWAHARLAL NEHRU":"INNSA",
    "SYDNEY":          "AUSYD",
    "MELBOURNE":       "AUMEL",
    "LOS ANGELES":     "USLAX",
    "LONG BEACH":      "USLGB",
    "NEW YORK":        "USNYC",
    "SAVANNAH":        "USSAV",
    "PIRAEUS":         "GRPIR",
}


def _match_port_un_code(conn, port_text: str) -> str | None:
    """Match free-text port name to a ports table UN code."""
    if not port_text:
        return None
    port_text_upper = port_text.upper().strip()
    logger.info("[port_match] Looking for: '%s'", port_text_upper)

    # Check alias dictionary first
    if port_text_upper in _PORT_ALIASES:
        logger.info("[port_match] Alias hit: '%s' -> %s", port_text_upper, _PORT_ALIASES[port_text_upper])
        return _PORT_ALIASES[port_text_upper]

    # Quick check: if it looks like a UN code already (5 uppercase letters)
    if len(port_text_upper) == 5 and port_text_upper.isalpha():
        row = conn.execute(text("""
            SELECT id FROM geography WHERE id = :code
        """), {"code": port_text_upper}).fetchone()
        if row:
            logger.debug("[port_match] Direct UN code hit: %s", port_text_upper)
            return port_text_upper

    # Search ports table for matching name
    rows = conn.execute(text("""
        SELECT un_code, name FROM ports
        WHERE UPPER(name) = :exact
        LIMIT 1
    """), {"exact": port_text_upper}).fetchall()

    if rows:
        logger.debug("[port_match] Exact name match: %s -> %s", port_text_upper, rows[0][0])
        return rows[0][0]

    # Contains match
    row = conn.execute(text("""
        SELECT un_code, name FROM ports
        WHERE UPPER(name) LIKE :pattern OR :search LIKE '%' || UPPER(name) || '%'
        LIMIT 1
    """), {"pattern": f"%{port_text_upper}%", "search": port_text_upper}).fetchone()

    if row:
        logger.debug("[port_match] Contains match: '%s' ~ '%s' -> %s", port_text_upper, row[1], row[0])
        return row[0]

    logger.debug("[port_match] No match for '%s'", port_text_upper)
    return None


def _match_company(conn, consignee_name: str) -> list[dict]:
    """Match consignee name against companies table. Returns top 3 matches."""
    if not consignee_name:
        return []
    name_lower = consignee_name.lower().strip()
    logger.debug("[company_match] Looking for: '%s'", name_lower)

    import re as _re

    def _normalise(s: str) -> str:
        """Strip punctuation, collapse spaces for fuzzy comparison."""
        s = s.lower()
        s = _re.sub(r'[^a-z0-9\s]', ' ', s)  # remove punctuation
        s = _re.sub(r'\s+', ' ', s).strip()   # collapse whitespace
        return s

    name_norm = _normalise(name_lower)
    name_words = [w for w in name_norm.split() if len(w) > 2]

    # Fetch companies matching by ILIKE for pre-filtering, then score in Python
    rows = conn.execute(text("""
        SELECT id, name FROM companies
        WHERE trash = FALSE AND name IS NOT NULL AND name != ''
    """)).fetchall()

    matches: list[dict] = []
    for r in rows:
        company_name = r[1]
        company_norm = _normalise(company_name)

        # Score: exact normalised match = 1.0, contains = 0.8, word overlap = 0.5+
        score = 0.0
        if company_norm == name_norm:
            score = 1.0
        elif name_norm in company_norm or company_norm in name_norm:
            score = 0.8
        else:
            # Word overlap on normalised strings
            company_words = set(company_norm.split())
            matched = sum(1 for w in name_words if w in company_words)
            if matched >= 2:
                score = 0.5 + (matched / max(len(name_words), 1)) * 0.3

        if score > 0.3:
            logger.debug("[company_match] Hit: '%s' norm:'%s' (score %.2f)", company_name, company_norm, score)
            matches.append({
                "company_id": r[0],
                "name": company_name,
                "score": round(score, 2),
            })

    matches.sort(key=lambda m: m["score"], reverse=True)
    logger.debug("[company_match] Total matches for '%s': %d", name_lower, len(matches))
    return matches[:3]


_BOOKING_NOT_RELEVANT = {
    ("FOB", "EXPORT"),
    ("FCA", "EXPORT"),
    ("CNF", "IMPORT"),
    ("CFR", "IMPORT"),
    ("CIF", "IMPORT"),
    ("DDP", "IMPORT"),
    ("DAP", "IMPORT"),
    ("CPT", "IMPORT"),
}


def _is_booking_relevant(incoterm: str | None, transaction_type: str | None) -> bool:
    """Returns True if the Booking stage is meaningful for this shipment."""
    if not incoterm or not transaction_type:
        return True
    return (incoterm.upper(), transaction_type.upper()) not in _BOOKING_NOT_RELEVANT


def _determine_initial_status(on_board_date: str | None) -> int:
    """Determine initial status based on on_board_date."""
    if not on_board_date:
        return STATUS_BOOKING_CONFIRMED  # 3002

    try:
        from datetime import date as _date
        obd = _date.fromisoformat(on_board_date[:10])
        today = _date.today()
        if obd > today:
            return STATUS_BOOKING_CONFIRMED  # 3002 — vessel departs in future
        else:
            return STATUS_DEPARTED  # 4001 — vessel already departed
    except (ValueError, TypeError):
        return STATUS_BOOKING_CONFIRMED


def _resolve_document_status(
    incoterm_code: str | None,
    txn_type: str | None,
    date_hint: str | None,
) -> int:
    """
    Determine the correct status after a document (BL/AWB/BC) is applied.
    Returns STATUS_DEPARTED (4001) if date_hint is in the past and booking is
    not relevant, otherwise STATUS_BOOKING_CONFIRMED (3002).
    """
    if _is_booking_relevant(incoterm_code, txn_type):
        return STATUS_BOOKING_CONFIRMED
    return _determine_initial_status(date_hint)


def _check_atd_advancement_pg(
    conn,
    shipment_id: str,
    current_status: int,
    claims_email: str,
    note: str = "Auto-advanced from ATD (doc apply)",
) -> int:
    """
    If TRACKED POL task has actual_end set and current status < STATUS_DEPARTED,
    advance shipment to STATUS_DEPARTED and append to status_history.
    Returns the final status.
    """
    if current_status >= STATUS_DEPARTED:
        return current_status

    now = datetime.now(timezone.utc).isoformat()
    wf_row = conn.execute(
        text("SELECT workflow_tasks FROM shipment_workflows WHERE shipment_id = :id"),
        {"id": shipment_id}
    ).fetchone()
    if not wf_row:
        return current_status

    wf_tasks = _parse_jsonb(wf_row[0]) or []
    pol_task = next(
        (t for t in wf_tasks if t.get("task_type") == "POL" and t.get("mode") == "TRACKED"),
        None
    )
    if not pol_task or not pol_task.get("actual_end"):
        return current_status

    cur = conn.execute(
        text("SELECT status, status_history FROM shipments WHERE id = :id"),
        {"id": shipment_id}
    ).fetchone()
    if not cur or (cur[0] or 0) >= STATUS_DEPARTED:
        return current_status

    history = _parse_jsonb(cur[1]) or []
    history.append({
        "status": STATUS_DEPARTED,
        "label": STATUS_LABELS[STATUS_DEPARTED],
        "timestamp": now,
        "changed_by": claims_email,
        "note": note,
    })
    conn.execute(text("""
        UPDATE shipments
        SET status = :status, status_history = CAST(:history AS jsonb), updated_at = :now
        WHERE id = :id
    """), {
        "status": STATUS_DEPARTED,
        "history": json.dumps(history),
        "now": now,
        "id": shipment_id,
    })
    logger.info("[atd_check] Auto-advanced %s to Departed (4001)", shipment_id)
    return STATUS_DEPARTED


# ---------------------------------------------------------------------------
# Task helpers
# ---------------------------------------------------------------------------

def _maybe_unblock_export_clearance_pg(conn, shipment_id: str, user_id: str):
    """Unblock EXPORT_CLEARANCE if FREIGHT_BOOKING is completed and waybill is set."""
    wf_row = conn.execute(text("""
        SELECT workflow_tasks FROM shipment_workflows WHERE shipment_id = :id
    """), {"id": shipment_id}).fetchone()

    if not wf_row:
        return

    tasks = _parse_jsonb(wf_row[0]) or []
    now = datetime.now(timezone.utc).isoformat()

    # Check FREIGHT_BOOKING status
    fb_completed = False
    for t in tasks:
        if t.get("task_type") == FREIGHT_BOOKING and t.get("status") == COMPLETED:
            fb_completed = True
            break

    if not fb_completed:
        return

    # Unblock EXPORT_CLEARANCE
    changed = False
    for t in tasks:
        if t.get("task_type") == EXPORT_CLEARANCE and t.get("status") == BLOCKED:
            t["status"] = PENDING
            t["updated_by"] = user_id
            t["updated_at"] = now
            changed = True
            break

    if changed:
        conn.execute(text("""
            UPDATE shipment_workflows
            SET workflow_tasks = CAST(:tasks AS jsonb), updated_at = :now
            WHERE shipment_id = :id
        """), {"tasks": json.dumps(tasks), "now": now, "id": shipment_id})
        logger.info("EXPORT_CLEARANCE unblocked for %s", shipment_id)


# ---------------------------------------------------------------------------
# System log helper
# ---------------------------------------------------------------------------

def _log_system_action_pg(conn, action: str, entity_id: str, uid: str, email: str):
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
