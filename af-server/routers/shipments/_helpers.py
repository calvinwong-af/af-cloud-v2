"""
routers/shipments/_helpers.py

Core utility functions used across shipments sub-modules.
This module must NOT import from other sub-modules (leaf in the dependency graph).

Domain-specific helpers live in:
  - _file_helpers.py — GCS file operations and file record helpers
  - _port_helpers.py — Port and company matching helpers
  - _status_helpers.py — Status advancement, task helpers, and system logging
"""

import json
import logging
from datetime import datetime, timezone

from core.constants import (
    STATUS_BOOKING_CONFIRMED,
    STATUS_DEPARTED,
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
