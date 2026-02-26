"""
routers/companies.py  —  stub
Full implementation follows after shipments stats (S1) is live.
"""
from fastapi import APIRouter, Depends
from core.auth import Claims, require_auth

router = APIRouter()

@router.get("")
async def list_companies(claims: Claims = Depends(require_auth)):
    return {"status": "OK", "data": [], "msg": "Companies — implementation in progress"}

@router.get("/{company_id}")
async def get_company(company_id: str, claims: Claims = Depends(require_auth)):
    return {"status": "OK", "data": None, "msg": "Company get — implementation in progress"}
