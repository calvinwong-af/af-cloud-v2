"""
routers/pricing/ — Pricing module endpoints (FCL + LCL rate cards and rates).
"""

from fastapi import APIRouter
from .fcl import router as fcl_router
from .lcl import router as lcl_router

router = APIRouter()
router.include_router(fcl_router, prefix="/fcl", tags=["Pricing - FCL"])
router.include_router(lcl_router, prefix="/lcl", tags=["Pricing - LCL"])
