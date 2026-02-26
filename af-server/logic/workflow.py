"""
logic/workflow.py

Incoterm-driven task generation rules.
Ported from: logic/workflow_status.py + constants.INCOTERM_LEVELS

TODO: Full port of WorkflowStatus class.
"""
from core.constants import INCOTERM_LEVELS, WORKFLOW_PROCESS_LEVEL


def get_applicable_processes(incoterm: str, transaction_type: str) -> list[str]:
    """
    Return the list of workflow process names that apply to a shipment
    based on its incoterm and transaction type (IMPORT/EXPORT).

    Used to auto-generate the task checklist on shipment creation (S6).
    """
    levels = INCOTERM_LEVELS.get(incoterm, {}).get(transaction_type)
    if not levels:
        return []

    start_level, end_level = levels
    process_order = [
        "cargo_to_port",       # 1
        "export_clearance",    # 2
        "vessel_departure",    # 3
        "vessel_in_transit",   # 4
        "vessel_arrival",      # 5
        "import_clearance",    # 6
        "shipment_delivery",   # 7
        "shipment_closed",     # 8
    ]

    return [p for i, p in enumerate(process_order, start=1) if start_level <= i <= end_level]
