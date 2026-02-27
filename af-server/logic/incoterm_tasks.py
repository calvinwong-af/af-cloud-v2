"""
logic/incoterm_tasks.py

Pure rules engine for incoterm-based shipment tasks.
No Datastore calls. No HTTP calls. Only logic.

Task types map to freight workflow legs:
  Leg 1 — Origin haulage / cargo pickup
  Leg 2 — Freight booking
  Leg 3 — Export customs clearance
  Leg 4 — Port of Loading (POL)
  Leg 5 — Port of Discharge (POD)
  Leg 6 — Import customs clearance
  Leg 7 — Destination haulage / delivery
"""

import uuid
from datetime import date, datetime, timedelta, timezone

# ---------------------------------------------------------------------------
# Task type constants
# ---------------------------------------------------------------------------
ORIGIN_HAULAGE = "ORIGIN_HAULAGE"
FREIGHT_BOOKING = "FREIGHT_BOOKING"
EXPORT_CLEARANCE = "EXPORT_CLEARANCE"
POL = "POL"
POD = "POD"
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
# Task modes
# ---------------------------------------------------------------------------
ASSIGNED = "ASSIGNED"
TRACKED = "TRACKED"
IGNORED = "IGNORED"

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
    POL: 4,
    POD: 5,
    IMPORT_CLEARANCE: 6,
    DESTINATION_HAULAGE: 7,
}

# ---------------------------------------------------------------------------
# Display names
# ---------------------------------------------------------------------------
TASK_DISPLAY_NAMES: dict[str, str] = {
    ORIGIN_HAULAGE:      "Origin Haulage / Pickup",
    FREIGHT_BOOKING:     "Freight Booking",
    EXPORT_CLEARANCE:    "Export Customs Clearance",
    POL:                 "Port of Loading",
    POD:                 "Port of Discharge",
    IMPORT_CLEARANCE:    "Import Customs Clearance",
    DESTINATION_HAULAGE: "Destination Haulage / Delivery",
}

# ---------------------------------------------------------------------------
# Default mode by task type
# ---------------------------------------------------------------------------
_DEFAULT_MODE: dict[str, str] = {
    POL: TRACKED,
    POD: TRACKED,
}

# ---------------------------------------------------------------------------
# Incoterm rules matrix
# ---------------------------------------------------------------------------
_INCOTERM_RULES: dict[str, dict[str, list[str]]] = {
    "EXW": {
        "EXPORT": [],
        "IMPORT": [ORIGIN_HAULAGE, FREIGHT_BOOKING, EXPORT_CLEARANCE,
                   POL, POD, IMPORT_CLEARANCE, DESTINATION_HAULAGE],
        "DOMESTIC": [ORIGIN_HAULAGE, FREIGHT_BOOKING, POL, POD,
                     DESTINATION_HAULAGE],
    },
    "FCA": {
        "EXPORT": [FREIGHT_BOOKING, EXPORT_CLEARANCE, POL, POD],
        "IMPORT": [ORIGIN_HAULAGE, FREIGHT_BOOKING, EXPORT_CLEARANCE,
                   POL, POD, IMPORT_CLEARANCE, DESTINATION_HAULAGE],
        "DOMESTIC": [FREIGHT_BOOKING, POL, POD, DESTINATION_HAULAGE],
    },
    "FOB": {
        "EXPORT": [ORIGIN_HAULAGE, FREIGHT_BOOKING, EXPORT_CLEARANCE, POL, POD],
        "IMPORT": [FREIGHT_BOOKING, POL, POD, IMPORT_CLEARANCE, DESTINATION_HAULAGE],
        "DOMESTIC": [ORIGIN_HAULAGE, FREIGHT_BOOKING, POL, POD,
                     DESTINATION_HAULAGE],
    },
    "CFR": {
        "EXPORT": [ORIGIN_HAULAGE, FREIGHT_BOOKING, EXPORT_CLEARANCE, POL, POD],
        "IMPORT": [POL, POD, IMPORT_CLEARANCE, DESTINATION_HAULAGE],
        "DOMESTIC": [ORIGIN_HAULAGE, FREIGHT_BOOKING, POL, POD,
                     DESTINATION_HAULAGE],
    },
    "CIF": {
        "EXPORT": [ORIGIN_HAULAGE, FREIGHT_BOOKING, EXPORT_CLEARANCE, POL, POD],
        "IMPORT": [POL, POD, IMPORT_CLEARANCE, DESTINATION_HAULAGE],
        "DOMESTIC": [ORIGIN_HAULAGE, FREIGHT_BOOKING, POL, POD,
                     DESTINATION_HAULAGE],
    },
    "CNF": {
        "EXPORT": [ORIGIN_HAULAGE, FREIGHT_BOOKING, EXPORT_CLEARANCE, POL, POD],
        "IMPORT": [POL, POD, IMPORT_CLEARANCE, DESTINATION_HAULAGE],
        "DOMESTIC": [ORIGIN_HAULAGE, FREIGHT_BOOKING, POL, POD,
                     DESTINATION_HAULAGE],
    },
    "CPT": {
        "EXPORT": [ORIGIN_HAULAGE, FREIGHT_BOOKING, EXPORT_CLEARANCE, POL, POD],
        "IMPORT": [POL, POD, IMPORT_CLEARANCE, DESTINATION_HAULAGE],
        "DOMESTIC": [ORIGIN_HAULAGE, FREIGHT_BOOKING, POL, POD,
                     DESTINATION_HAULAGE],
    },
    "CIP": {
        "EXPORT": [ORIGIN_HAULAGE, FREIGHT_BOOKING, EXPORT_CLEARANCE, POL, POD],
        "IMPORT": [POL, POD, IMPORT_CLEARANCE, DESTINATION_HAULAGE],
        "DOMESTIC": [ORIGIN_HAULAGE, FREIGHT_BOOKING, POL, POD,
                     DESTINATION_HAULAGE],
    },
    "DAP": {
        "EXPORT": [ORIGIN_HAULAGE, FREIGHT_BOOKING, EXPORT_CLEARANCE,
                   POL, POD, IMPORT_CLEARANCE, DESTINATION_HAULAGE],
        "IMPORT": [POL, POD, IMPORT_CLEARANCE, DESTINATION_HAULAGE],
        "DOMESTIC": [ORIGIN_HAULAGE, FREIGHT_BOOKING, POL, POD,
                     DESTINATION_HAULAGE],
    },
    "DPU": {
        "EXPORT": [ORIGIN_HAULAGE, FREIGHT_BOOKING, EXPORT_CLEARANCE,
                   POL, POD, IMPORT_CLEARANCE, DESTINATION_HAULAGE],
        "IMPORT": [POL, POD, IMPORT_CLEARANCE, DESTINATION_HAULAGE],
        "DOMESTIC": [ORIGIN_HAULAGE, FREIGHT_BOOKING, POL, POD,
                     DESTINATION_HAULAGE],
    },
    "DDP": {
        "EXPORT": [ORIGIN_HAULAGE, FREIGHT_BOOKING, EXPORT_CLEARANCE,
                   POL, POD, IMPORT_CLEARANCE, DESTINATION_HAULAGE],
        "IMPORT": [POL, POD, IMPORT_CLEARANCE, DESTINATION_HAULAGE],
        "DOMESTIC": [ORIGIN_HAULAGE, FREIGHT_BOOKING, POL, POD,
                     DESTINATION_HAULAGE],
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
    elif task_type == POL:
        if etd:
            result = etd
    elif task_type == POD:
        if eta:
            result = eta
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
        mode = _DEFAULT_MODE.get(task_type, ASSIGNED)

        tasks.append({
            "task_id": str(uuid.uuid4()),
            "task_type": task_type,
            "display_name": TASK_DISPLAY_NAMES.get(task_type, task_type),
            "leg_level": TASK_LEG_LEVEL[task_type],
            "mode": mode,
            "status": initial_status,
            "assigned_to": AF,
            "third_party_name": None,
            "visibility": "VISIBLE",
            "scheduled_start": None,
            "scheduled_end": due_date,
            "actual_start": None,
            "actual_end": None,
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
            task["scheduled_end"] = new_due
            task["updated_by"] = updated_by
            task["updated_at"] = now

    return tasks


# ---------------------------------------------------------------------------
# Migration helper — apply defaults for tasks missing new fields
# ---------------------------------------------------------------------------

def migrate_task_on_read(task: dict) -> dict:
    """
    Apply default values for new fields on tasks read from Datastore.
    Does not write back — only enriches for API response.
    Also handles legacy type name migration (VESSEL_DEPARTURE → POL, etc.).
    """
    # Legacy type name migration
    tt = task.get("task_type", "")
    if tt == "VESSEL_DEPARTURE":
        task["task_type"] = POL
    elif tt == "VESSEL_ARRIVAL":
        task["task_type"] = POD
    elif tt == "IN_TRANSIT":
        # Mark as ignored — this task type no longer exists
        task["task_type"] = "IN_TRANSIT_LEGACY"
        task.setdefault("mode", IGNORED)
        task.setdefault("visibility", "HIDDEN")

    task_type = task.get("task_type", "")

    # display_name
    if not task.get("display_name"):
        task["display_name"] = TASK_DISPLAY_NAMES.get(task_type, task_type)

    # leg_level — update to new levels if still using old ones
    if task_type in TASK_LEG_LEVEL:
        task["leg_level"] = TASK_LEG_LEVEL[task_type]

    # mode
    if not task.get("mode"):
        task["mode"] = _DEFAULT_MODE.get(task_type, ASSIGNED)

    # timing fields
    if "scheduled_start" not in task:
        task["scheduled_start"] = None
    if "scheduled_end" not in task:
        task["scheduled_end"] = task.get("due_date")
    if "actual_start" not in task:
        task["actual_start"] = None
    if "actual_end" not in task:
        task["actual_end"] = task.get("completed_at")

    return task
