"""
routers/shipments/__init__.py

Shipments router package. Combines all sub-module routers into a single
APIRouter that main.py imports as `routers.shipments.router`.

Sub-router include order matters for FastAPI route matching:
  core → status → bl → files → tasks → route_nodes → doc_apply

Static routes (/stats, /search, /file-tags, /parse-bl, /create-from-bl)
are defined in their respective modules before any parameterised routes
to preserve FastAPI's matching priority.
"""
from fastapi import APIRouter

from .core import router as core_router
from .status import router as status_router
from .bl import router as bl_router
from .files import router as files_router
from .tasks import router as tasks_router
from .route_nodes import router as route_nodes_router
from .doc_apply import router as doc_apply_router

router = APIRouter()

router.include_router(core_router)
router.include_router(status_router)
router.include_router(bl_router)
router.include_router(files_router)
router.include_router(tasks_router)
router.include_router(route_nodes_router)
router.include_router(doc_apply_router)
