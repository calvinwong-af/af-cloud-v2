"""
routers/shipments/files.py

Shipment file management endpoints: list, upload, update, delete, download.

NOTE: get_file_tags (GET /file-tags) lives in core.py to ensure it is
registered before GET /{shipment_id} in the combined router.
"""

import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import text

from core.auth import Claims, require_auth, require_afu
from core.db import get_db
from core.exceptions import NotFoundError, ForbiddenError
from core.constants import (
    AFC_ADMIN,
    AFC_M,
    FILES_BUCKET_NAME,
)

from ._helpers import (
    _resolve_gcs_path,
    _file_row_to_dict,
    _save_file_to_gcs,
    _create_file_record,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# 1a. GET /shipments/{shipment_id}/files
# ---------------------------------------------------------------------------

@router.get("/{shipment_id}/files")
async def list_shipment_files(
    shipment_id: str,
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    """List files for a shipment. AFC regular users only see visible files."""
    where = "shipment_id = :shipment_id AND trash = FALSE"
    params: dict = {"shipment_id": shipment_id}

    # AFC regular users: only visible files
    if claims.is_afc() and claims.role not in (AFC_ADMIN, AFC_M):
        where += " AND visibility = TRUE"

    rows = conn.execute(text(f"""
        SELECT * FROM shipment_files
        WHERE {where}
        ORDER BY created_at DESC
    """), params).fetchall()

    results = [_file_row_to_dict(r) for r in rows]

    return {"status": "OK", "data": results}


# ---------------------------------------------------------------------------
# 1c. POST /shipments/{shipment_id}/files
# ---------------------------------------------------------------------------

@router.post("/{shipment_id}/files")
async def upload_shipment_file(
    shipment_id: str,
    file: UploadFile = File(...),
    file_tags: str = Form("[]"),
    visibility: str = Form("true"),
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    """Upload a file to a shipment. AFU or AFC Admin/Manager only."""
    # Permission check
    if claims.is_afc() and claims.role not in (AFC_ADMIN, AFC_M):
        raise ForbiddenError("Only staff or company admins/managers can upload files")

    # Parse form fields
    try:
        tags_list = json.loads(file_tags)
    except (ValueError, TypeError):
        tags_list = []
    vis_bool = visibility.lower() in ("true", "1", "yes")

    # Read the shipment to get company_id
    row = conn.execute(text("""
        SELECT company_id FROM shipments WHERE id = :id
    """), {"id": shipment_id}).fetchone()

    if not row:
        raise NotFoundError(f"Shipment {shipment_id} not found")

    company_id = row[0] or ""

    # Read file
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file")

    file_size_kb = len(file_bytes) / 1024.0
    original_name = file.filename or "untitled"

    # Build GCS path
    gcs_path = _resolve_gcs_path(company_id, shipment_id, original_name)

    # Upload to GCS
    from google.cloud import storage as gcs_storage
    gcs_client = gcs_storage.Client(project="cloud-accele-freight")
    bucket = gcs_client.bucket(FILES_BUCKET_NAME)
    content_type = file.content_type or "application/octet-stream"
    _save_file_to_gcs(bucket, gcs_path, file_bytes, content_type)

    # Create file record
    file_record = _create_file_record(
        conn=conn,
        shipment_id=shipment_id,
        company_id=company_id,
        file_name=original_name,
        gcs_path=gcs_path,
        file_size_kb=file_size_kb,
        file_tags=tags_list,
        visibility=vis_bool,
        uploader_uid=claims.uid,
        uploader_email=claims.email,
    )

    logger.info("File uploaded for %s by %s: %s", shipment_id, claims.uid, original_name)

    return {"status": "OK", "data": file_record, "msg": "File uploaded"}


# ---------------------------------------------------------------------------
# 1d. PATCH /shipments/{shipment_id}/files/{file_id}
# ---------------------------------------------------------------------------

class UpdateFileRequest(BaseModel):
    file_tags: list | None = None
    visibility: bool | None = None


@router.patch("/{shipment_id}/files/{file_id}")
async def update_shipment_file(
    shipment_id: str,
    file_id: int,
    body: UpdateFileRequest,
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    """Update file tags and/or visibility. AFU or AFC Admin/Manager."""
    if claims.is_afc() and claims.role not in (AFC_ADMIN, AFC_M):
        raise ForbiddenError("Only staff or company admins/managers can edit files")

    now = datetime.now(timezone.utc).isoformat()

    row = conn.execute(text("""
        SELECT id, shipment_id FROM shipment_files WHERE id = :id
    """), {"id": file_id}).fetchone()

    if not row:
        raise NotFoundError(f"File {file_id} not found")
    if row[1] != shipment_id:
        raise NotFoundError(f"File {file_id} not found on shipment {shipment_id}")

    updates = ["updated_at = :now"]
    params: dict = {"now": now, "id": file_id}

    if body.file_tags is not None:
        updates.append("file_tags = :file_tags")
        params["file_tags"] = body.file_tags

    # AFC Admin/Manager cannot change visibility
    if body.visibility is not None:
        if claims.is_afc():
            raise ForbiddenError("Only AF staff can change file visibility")
        updates.append("visibility = :visibility")
        params["visibility"] = body.visibility

    conn.execute(text(f"""
        UPDATE shipment_files SET {', '.join(updates)} WHERE id = :id
    """), params)

    # Re-fetch for response
    updated_row = conn.execute(text("SELECT * FROM shipment_files WHERE id = :id"), {"id": file_id}).fetchone()

    return {"status": "OK", "data": _file_row_to_dict(updated_row), "msg": "File updated"}


# ---------------------------------------------------------------------------
# 1e. DELETE /shipments/{shipment_id}/files/{file_id}
# ---------------------------------------------------------------------------

@router.delete("/{shipment_id}/files/{file_id}")
async def delete_shipment_file(
    shipment_id: str,
    file_id: int,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    """Soft-delete a file. AFU only."""
    now = datetime.now(timezone.utc).isoformat()

    row = conn.execute(text("""
        SELECT id, shipment_id FROM shipment_files WHERE id = :id
    """), {"id": file_id}).fetchone()

    if not row:
        raise NotFoundError(f"File {file_id} not found")
    if row[1] != shipment_id:
        raise NotFoundError(f"File {file_id} not found on shipment {shipment_id}")

    conn.execute(text("""
        UPDATE shipment_files SET trash = TRUE, updated_at = :now WHERE id = :id
    """), {"now": now, "id": file_id})

    logger.info("File %d soft-deleted on %s by %s", file_id, shipment_id, claims.uid)
    return {"deleted": True, "file_id": file_id}


# ---------------------------------------------------------------------------
# 1f. GET /shipments/{shipment_id}/files/{file_id}/download
# ---------------------------------------------------------------------------

@router.get("/{shipment_id}/files/{file_id}/download")
async def download_shipment_file(
    shipment_id: str,
    file_id: int,
    claims: Claims = Depends(require_auth),
    conn=Depends(get_db),
):
    """Generate a signed GCS URL for file download."""
    row = conn.execute(text("""
        SELECT id, shipment_id, visibility, file_location FROM shipment_files WHERE id = :id
    """), {"id": file_id}).fetchone()

    if not row:
        raise NotFoundError(f"File {file_id} not found")
    if row[1] != shipment_id:
        raise NotFoundError(f"File {file_id} not found on shipment {shipment_id}")

    # AFC regular: only visible files
    if claims.is_afc() and claims.role not in (AFC_ADMIN, AFC_M):
        if not row[2]:  # visibility
            raise NotFoundError(f"File {file_id} not found")

    file_location = row[3] or ""
    if not file_location:
        raise HTTPException(status_code=500, detail="File location not set")

    import os
    import google.auth
    import google.auth.transport.requests
    from google.cloud import storage as gcs_storage
    from datetime import timedelta

    key_file = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if key_file and os.path.isfile(key_file):
        # Local dev: sign directly with the service account key (no IAM API needed)
        from google.oauth2 import service_account as sa
        sa_creds = sa.Credentials.from_service_account_file(key_file)
        gcs_client = gcs_storage.Client(project="cloud-accele-freight", credentials=sa_creds)
        bucket = gcs_client.bucket(FILES_BUCKET_NAME)
        blob = bucket.blob(file_location)
        signed_url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=15),
            method="GET",
        )
    else:
        # Cloud Run: use metadata-server credentials + IAM signBytes
        credentials, project = google.auth.default(
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        auth_request = google.auth.transport.requests.Request()
        credentials.refresh(auth_request)
        gcs_client = gcs_storage.Client(project="cloud-accele-freight", credentials=credentials)
        bucket = gcs_client.bucket(FILES_BUCKET_NAME)
        blob = bucket.blob(file_location)
        signed_url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=15),
            method="GET",
            service_account_email=credentials.service_account_email,
            access_token=credentials.token,
        )

    return {"download_url": signed_url}
