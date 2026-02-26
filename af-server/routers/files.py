"""
routers/files.py  —  stub
GCS signed URL generation for file uploads and downloads.
Port from model/files_model.py.
"""
from fastapi import APIRouter, Depends
from core.auth import Claims, require_auth

router = APIRouter()

@router.get("/upload-url")
async def get_upload_url(claims: Claims = Depends(require_auth)):
    return {"status": "OK", "data": None, "msg": "File upload URL — implementation in progress"}
