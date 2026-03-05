"""
routers/shipments/_file_helpers.py — GCS file operations and file record helpers.
"""

import json
import logging
from datetime import datetime, timezone

from sqlalchemy import text

from core.constants import FILES_BUCKET_NAME  # noqa: F401

logger = logging.getLogger(__name__)


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
