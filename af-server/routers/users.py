"""
routers/users.py  —  stub
Full implementation follows after shipments stats (S1) is live.
"""
from fastapi import APIRouter, Depends
from core.auth import Claims, require_auth, require_afu_admin

router = APIRouter()

@router.get("")
async def list_users(claims: Claims = Depends(require_afu_admin)):
    return {"status": "OK", "data": [], "msg": "Users — implementation in progress"}
