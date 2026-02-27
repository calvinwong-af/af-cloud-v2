"""
logic/incoterm_tasks.py

Pure rules engine for incoterm-based shipment tasks.
No Datastore calls. No HTTP calls. Only logic.

Task types map to freight workflow legs:
  Leg 1 — Origin haulage / cargo pickup
  Leg 2 — Freight booking
  Leg 3 — Export customs clearance
  Leg 7 — Import customs clearance
  Leg 8 — Destination haulage / delivery

Levels 4–6 are milestones only (no actionable tasks).
"""

import uuid
from datetime import date, datetime, timedelta, timezone

# ---------------------------------------------------------------------------
# Task type constants
# ---------------------------------------------------------------------------
ORIGIN_HAULAGE = "ORIGIN_HAULAGE"
FREIGHT_BOOKING = "FREIGHT_BOOKING"
EXPORT_CLEARANCE = "EXPORT_CLEARANCE"
IMPORT_CLEARANCE = "IMPORT_CLEARANCE"
DESTINATION_HAULAGE = "DESTINATION_HAULAGE"

# ---------------------------------------------------------------------------
# Task statuses
# ---------------------------------------------------------------------------
PENDING = "PENDING"
IN_PROGRESS = "IN_PROGRESS"
COMPLETED = "COMPLETED"
BLOCKED = "BLOCKED"

# ---------------------------------------------------------------------------
# Assigned-to values
# ---------------------------------------------------------------------------
AF = "AF"
CUSTOMER = "CUSTOMER"
THIRD_PARTY = "THIRD_PARTY"

# ---------------------------------------------------------------------------
# Leg levels (display order)
# ---------------------------------------------------------------------------
TASK_LEG_LEVEL: dict[str, int] = {
    ORIGIN_HAULAGE: 1,
    FREIGHT_BOOKING: 2,
    EXPORT_CLEARANCE: 3,
    IMPORT_CLEARANCE: 7,
    DESTINATION_HAULAGE: 8,
}

TASK_LABELS: dict[str, str] = {
    ORIGIN_HAULAGE: "Origin Haulage",
    FREIGHT_BOOKING: "Freight Booking",
    EXPORT_CLEARANCE: "Export Clearance",
    IMPORT_CLEARANCE: "Import Clearance",
    DESTINATION_HAULAGE: "Destination Haulage",
}

# ---------------------------------------------------------------------------
# Incoterm rules matrix
# ---------------------------------------------------------------------------
_INCOTERM_RULES: dict[str, dict[str, list[str]]] = {
    "EXW": {
        "EXPORT": [],
        "IMPORT": [ORIGIN_HAULAGE, FREIGHT_BOOKING, EXPORT_CLEARANCE, IMPORT_CLEARANCE, DESTINATION_HAULAGE],
    },
    "FCA": {
        "EXPORT": [FREIGHT_BOOKING, EXPORT_CLEARANCE],
        "IMPORT": [ORIGIN_HAULAGE, FREIGHT_BOOKING, EXPORT_CLEARANCE, IMPORT_CLEARANCE, DESTINATION_HAULAGE],
    },
    "FOB": {
        "EXPORT": [ORIGIN_HAULAGE, FREIGHT_BOOKING, EXPORT_CLEARANCE],
        "IMPORT": [FREIGHT_BOOKING, IMPORT_CLEARANCE, DESTINATION_HAULAGE],
    },
    "CFR": {
        "EXPORT": [ORIGIN_HAULAGE, FREIGHT_BOOKING, EXPORT_CLEARANCE],
        "IMPORT": [IMPORT_CLEARANCE, DESTINATION_HAULAGE],
    },
    "CIF": {
        "EXPORT": [ORIGIN_HAULAGE, FREIGHT_BOOKING, EXPORT_CLEARANCE],
        "IMPORT": [IMPORT_CLEARANCE, DESTINATION_HAULAGE],
    },
    "CNF": {
        "EXPORT": [ORIGIN_HAULAGE, FREIGHT_BOOKING, EXPORT_CLEARANCE],
        "IMPORT": [IMPORT_CLEARANCE, DESTINATION_HAULAGE],
    },
    "CPT": {
        "EXPORT": [ORIGIN_HAULAGE, FREIGHT_BOOKING, EXPORT_CLEARANCE],
        "IMPORT": [IMPORT_CLEARANCE, DESTINATION_HAULAGE],
    },
    "CIP": {
        "EXPORT": [ORIGIN_HAULAGE, FREIGHT_BOOKING, EXPORT_CLEARANCE],
        "IMPORT": [IMPORT_CLEARANCE, DESTINATION_HAULAGE],
    },
    "DAP": {
        "EXPORT": [ORIGIN_HAULAGE, FREIGHT_BOOKING, EXPORT_CLEARANCE, IMPORT_CLEARANCE, DESTINATION_HAULAGE],
        "IMPORT": [IMPORT_CLEARANCE, DESTINATION_HAULAGE],
    },
    "DPU": {
        "EXPORT": [ORIGIN_HAULAGE, FREIGHT_BOOKING, EXPORT_CLEARANCE, IMPORT_CLEARANCE, DESTINATION_HAULAGE],
        "IMPORT": [IMPORT_CLEARANCE, DESTINATION_HAULAGE],
    },
    "DDP": {
        "EXPORT": [ORIGIN_HAULAGE, FREIGHT_BOOKING, EXPORT_CLEARANCE, IMPORT_CLEARANCE, DESTINATION_HAULAGE],
        "IMPORT": [IMPORT_CLEARANCE, DESTINATION_HAULAGE],
    },
}


# ---------------------------------------------------------------------------
# Due date calculation
# ---------------------------------------------------------------------------

def _calculate_due_date(
    task_type: str,
    etd: date | None,
    eta: date | None,
    cargo_ready_date: date | None,
) -> str | None:
    """Calculate due date for a task type. Returns ISO date string or None."""
    result: date | None = None

    if task_type == ORIGIN_HAULAGE:
        if cargo_ready_date:
            result = cargo_ready_date
        elif etd:
            result = etd - timedelta(days=3)
    elif task_type == FREIGHT_BOOKING:
        if etd:
            result = etd - timedelta(days=7)
    elif task_type == EXPORT_CLEARANCE:
        if etd:
            result = etd - timedelta(days=2)
    elif task_type == IMPORT_CLEARANCE:
        if eta:
            result = eta + timedelta(days=1)
    elif task_type == DESTINATION_HAULAGE:
        if eta:
            result = eta + timedelta(days=3)

    return result.isoformat() if result else None


# ---------------------------------------------------------------------------
# Task generation
# ---------------------------------------------------------------------------

def generate_tasks(
    incoterm: str,
    transaction_type: str,
    etd: date | None = None,
    eta: date | None = None,
    cargo_ready_date: date | None = None,
    updated_by: str = "system",
) -> list[dict]:
    """
    Returns a list of task dicts ready to be stored as workflow_tasks
    on the ShipmentWorkFlow Kind. Each dict matches the task data model.
    """
    incoterm_upper = incoterm.upper().strip()
    txn_upper = transaction_type.upper().strip()

    rules = _INCOTERM_RULES.get(incoterm_upper)
    if not rules:
        return []

    task_types = rules.get(txn_upper, [])
    if not task_types:
        return []

    now = datetime.now(timezone.utc).isoformat()
    has_freight_booking = FREIGHT_BOOKING in task_types

    tasks: list[dict] = []
    for task_type in task_types:
        # Determine initial status — EXPORT_CLEARANCE blocked when FREIGHT_BOOKING present
        if task_type == EXPORT_CLEARANCE and has_freight_booking:
            initial_status = BLOCKED
        else:
            initial_status = PENDING

        due_date = _calculate_due_date(task_type, etd, eta, cargo_ready_date)

        tasks.append({
            "task_id": str(uuid.uuid4()),
            "task_type": task_type,
            "leg_level": TASK_LEG_LEVEL[task_type],
            "status": initial_status,
            "assigned_to": AF,
            "third_party_name": None,
            "visibility": "VISIBLE",
            "due_date": due_date,
            "due_date_override": False,
            "notes": None,
            "completed_at": None,
            "updated_by": updated_by,
            "updated_at": now,
        })

    # Sort by leg level for display order
    tasks.sort(key=lambda t: t["leg_level"])
    return tasks


# ---------------------------------------------------------------------------
# Due date recalculation
# ---------------------------------------------------------------------------

def recalculate_due_dates(
    tasks: list[dict],
    etd: date | None = None,
    eta: date | None = None,
    cargo_ready_date: date | None = None,
    updated_by: str = "system",
) -> list[dict]:
    """
    Re-runs due date formulas on tasks where due_date_override is False.
    Returns the updated task list. Does not write to Datastore.
    """
    now = datetime.now(timezone.utc).isoformat()

    for task in tasks:
        if task.get("due_date_override", False):
            continue

        new_due = _calculate_due_date(
            task["task_type"], etd, eta, cargo_ready_date,
        )
        if new_due != task.get("due_date"):
            task["due_date"] = new_due
            task["updated_by"] = updated_by
            task["updated_at"] = now

    return tasks
