# PROMPT-CURRENT — v2.77
**Date:** 03 March 2026
**Status:** READY — pass to Opus in VS Code

---

## Context

`af-server/routers/shipments.py` is 118 KB — too large to work with efficiently in
AI sessions. This prompt splits it into a package of focused sub-modules with no
functional changes. All endpoints, logic, helpers, and constants stay exactly the
same. Only file organisation changes.

This is a pure refactor. No API behaviour changes. No test changes required.

---

## Target Structure

Convert `routers/shipments.py` (single file) into `routers/shipments/` (package):

```
af-server/routers/shipments/
  __init__.py          ← creates the combined router, imports all sub-routers
  _helpers.py          ← all shared helper functions and constants
  _prompts.py          ← AI prompt string constants only
  core.py              ← stats, search, list, get single, create manual, delete
  status.py            ← status update, invoiced flag, exception flag, company reassign
  bl.py                ← parse-bl, create-from-bl, PATCH /bl, PATCH /parties
  files.py             ← file-tags GET, files CRUD (list/upload/update/delete/download)
  tasks.py             ← GET tasks, PATCH task, lazy_init helper
  route_nodes.py       ← GET/PUT/PATCH route-nodes, derive/enrich/assign helpers
  doc_apply.py         ← apply-awb, apply-booking-confirmation, save-document-file
```

---

## Precise Content Allocation

Read `routers/shipments.py` in full before starting. Allocate content as follows:

### `_helpers.py`
All shared utilities used across multiple sub-modules:
- `_parse_jsonb(val)` — JSONB parse helper + best-practice comment block
- `_resolve_gcs_path(company_id, shipment_id, filename)` — GCS path builder
- `_file_row_to_dict(row)` — converts shipment_files DB row to dict
- `_save_file_to_gcs(bucket, gcs_path, file_bytes, content_type)` — GCS upload
- `_create_file_record(conn, ...)` — inserts shipment_files record, returns dict
- `_PORT_ALIASES` — dict of port name → UN code mappings
- `_match_port_un_code(conn, port_text)` — fuzzy port name matcher
- `_match_company(conn, consignee_name)` — company name fuzzy matcher
- `_determine_initial_status(on_board_date)` — derives status from on_board_date
- `_maybe_unblock_export_clearance_pg(conn, shipment_id, user_id)` — task unblock logic
- `_log_system_action_pg(conn, action, entity_id, uid, email)` — system log writer

### `_prompts.py`
AI prompt string constants only — no functions, no imports beyond basic Python:
- `_BL_EXTRACTION_PROMPT`
- `_CLASSIFY_PROMPT_LOCAL`
- `_BC_EXTRACTION_PROMPT_LOCAL`
- `_AWB_EXTRACTION_PROMPT_LOCAL`

### `core.py`
Endpoints + supporting functions:
- `get_shipment_stats` — GET /stats
- `search_shipments` — GET /search
- `_id_matches(...)` — search helper
- `_fmt_date(val)` — date formatting helper
- `list_shipments` — GET /
- `get_shipment` — GET /{shipment_id}
- `_lazy_init_tasks_pg(conn, shipment_id, shipment_data)` — NOTE: also used by tasks.py; keep in core.py and import from there in tasks.py
- `create_shipment_manual` — POST /
- `CreateManualShipmentRequest` — Pydantic model
- `delete_shipment` — DELETE /{shipment_id}

### `status.py`
- `UpdateStatusRequest` — Pydantic model
- `update_shipment_status` — PATCH /{shipment_id}/status
- `UpdateInvoicedRequest` — Pydantic model
- `update_invoiced_status` — PATCH /{shipment_id}/invoiced
- `ExceptionRequest` — Pydantic model
- `update_exception_flag` — PATCH /{shipment_id}/exception
- `AssignCompanyRequest` — Pydantic model
- `assign_company` — PATCH /{shipment_id}/company

### `bl.py`
- `_BL_EXTRACTION_PROMPT` — import from `_prompts`
- `_CLASSIFY_PROMPT_LOCAL` — import from `_prompts`
- `_BC_EXTRACTION_PROMPT_LOCAL` — import from `_prompts`
- `_AWB_EXTRACTION_PROMPT_LOCAL` — import from `_prompts`
- `_call_claude_local(...)` — inline helper used only within parse_bl; define locally
- `_strip_fences(text)` — inline helper; define locally
- `parse_bl` — POST /parse-bl
- `CreateFromBLRequest` — Pydantic model
- `create_from_bl` — POST /create-from-bl
- `update_from_bl` — PATCH /{shipment_id}/bl
- `UpdatePartiesRequest` — Pydantic model
- `update_parties` — PATCH /{shipment_id}/parties

### `files.py`
- `get_file_tags` — GET /file-tags
- `list_shipment_files` — GET /{shipment_id}/files
- `upload_shipment_file` — POST /{shipment_id}/files
- `UpdateFileRequest` — Pydantic model
- `update_shipment_file` — PATCH /{shipment_id}/files/{file_id}
- `delete_shipment_file` — DELETE /{shipment_id}/files/{file_id}
- `download_shipment_file` — GET /{shipment_id}/files/{file_id}/download

### `tasks.py`
- `get_shipment_tasks` — GET /{shipment_id}/tasks
- `UpdateTaskRequest` — Pydantic model
- `update_shipment_task` — PATCH /{shipment_id}/tasks/{task_id}
- Import `_lazy_init_tasks_pg` from `.core`

### `route_nodes.py`
- `_derive_route_nodes(shipment_data)` — derive nodes from origin/dest codes
- `_enrich_route_nodes(conn, nodes)` — enrich with port details
- `_assign_sequences(nodes)` — auto-assign sequence numbers
- `get_route_nodes` — GET /{shipment_id}/route-nodes
- `RouteNodeInput` — Pydantic model
- `save_route_nodes` — PUT /{shipment_id}/route-nodes
- `RouteNodeTimingUpdate` — Pydantic model
- `update_route_node_timing` — PATCH /{shipment_id}/route-nodes/{sequence}

### `doc_apply.py`
- `ApplyBookingConfirmationRequest` — Pydantic model
- `apply_booking_confirmation` — POST /{shipment_id}/apply-booking-confirmation
- `ApplyAWBRequest` — Pydantic model
- `apply_awb` — POST /{shipment_id}/apply-awb
- `save_document_file` — POST /{shipment_id}/save-document-file

---

## `__init__.py` — Combined Router

This file must produce a single `router` that `main.py` can import exactly as before.
Use FastAPI's `include_router` to combine all sub-routers:

```python
"""
routers/shipments/__init__.py

Shipments router package. Combines all sub-module routers into a single
APIRouter that main.py imports as `routers.shipments.router`.
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
```

Each sub-module defines its own `router = APIRouter()` at the top.

---

## `main.py` — No Changes Required

`main.py` currently imports:
```python
from routers import shipments
app.include_router(shipments.router, prefix="/api/v2/shipments", ...)
```

This import path continues to work unchanged because `routers/shipments/__init__.py`
exports `router`. Verify `main.py` does not need modification — if it imports
directly from `routers.shipments` as a module attribute, it will still resolve.

---

## Import Rules for Sub-Modules

Every sub-module needs its own imports. Do not assume anything is inherited.
Common imports needed by most sub-modules:

```python
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text

from core.auth import Claims, require_auth, require_afu, require_afu_admin
from core.db import get_db
from core import db_queries
from core.constants import (...)
from core.exceptions import NotFoundError, ForbiddenError
from ._helpers import _parse_jsonb, _log_system_action_pg, ...
```

Each sub-module imports only what it actually uses. Do not blanket-import everything.

---

## Critical Rules

1. **No functional changes** — every endpoint path, method, behaviour, response shape,
   and error handling must be byte-for-byte identical to the original
2. **Delete `routers/shipments.py`** after the package is created and verified
3. **Preserve all comments** — the BEST PRACTICE comment block on `_parse_jsonb`,
   the file-saving contract comment on `save_document_file`, all section headers
4. **`_lazy_init_tasks_pg` lives in `core.py`** and is imported by `tasks.py` —
   do not duplicate it
5. **`_call_claude_local` and `_strip_fences`** are only used inside `parse_bl` in
   `bl.py` — define them as local functions within `bl.py`, not in `_helpers.py`
6. **Route order matters in FastAPI** — within each sub-router, preserve the exact
   order of route definitions from the original file. The combined router in
   `__init__.py` must include sub-routers in this order:
   core → status → bl → files → tasks → route_nodes → doc_apply
   This preserves FastAPI's route matching priority (static routes before parameterised)

---

## Verification Steps

After completing the split, verify:

1. Run `uvicorn main:app --reload` — server must start with zero import errors
2. Check all route prefixes resolve: GET /api/v2/shipments/stats, GET /api/v2/shipments/file-tags, GET /api/v2/shipments/search must all return 200 (not 422/404)
3. Confirm `routers/shipments.py` (the old single file) is deleted
4. Confirm `routers/shipments/` directory contains exactly 10 files:
   `__init__.py`, `_helpers.py`, `_prompts.py`, `core.py`, `status.py`, `bl.py`,
   `files.py`, `tasks.py`, `route_nodes.py`, `doc_apply.py`
5. No other files in the project are modified

---

## Notes

- This is the highest-risk split of the three planned (v2.77/v2.78/v2.79) due to
  Python import resolution — take extra care with circular imports
- `_helpers.py` and `_prompts.py` must never import from other sub-modules (they
  are leaves in the dependency graph)
- Sub-modules may import from `_helpers.py` and `_prompts.py` freely
- Sub-modules must NOT import from each other except `tasks.py` importing
  `_lazy_init_tasks_pg` from `core.py`
- After this split, the largest single file should be `bl.py` at approximately
  25-30 KB — all others should be under 20 KB
