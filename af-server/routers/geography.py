"""
routers/geography.py  —  stub
Port from model/geography_model.py — ports, countries, cities.
Implementation prioritised after S1 (stats fix) is live.
"""
from fastapi import APIRouter, Depends
from core.auth import Claims, require_auth

router = APIRouter()

@router.get("/ports")
async def list_ports(claims: Claims = Depends(require_auth)):
    return {"status": "OK", "data": [], "msg": "Ports — implementation in progress"}

@router.get("/countries")
async def list_countries(claims: Claims = Depends(require_auth)):
    return {"status": "OK", "data": [], "msg": "Countries — implementation in progress"}
