"""
core/db_queries.py — Shared SQL query helpers.

All queries use SQLAlchemy text() — no ORM.
Unified orders architecture: queries JOIN orders + shipment_details.
"""

import json
from sqlalchemy import text
from core.constants import STATUS_LABELS


def get_shipment_stats(conn, company_id: str | None = None) -> dict:
    """Single SQL aggregation query for dashboard KPI cards and tab badges."""
    where = "WHERE o.trash = FALSE AND o.order_type = 'shipment'"
    params = {}
    if company_id:
        where += " AND o.company_id = :company_id"
        params["company_id"] = company_id

    row = conn.execute(text(f"""
        SELECT
            COUNT(*) FILTER (WHERE
                o.status IN ('confirmed', 'in_progress') AND o.completed = FALSE
            ) AS active,
            COUNT(*) FILTER (WHERE
                o.completed = TRUE OR o.status = 'completed'
            ) AS completed,
            COUNT(*) FILTER (WHERE
                (o.completed = TRUE OR o.status = 'completed') AND o.issued_invoice = FALSE
            ) AS to_invoice,
            COUNT(*) FILTER (WHERE o.status = 'draft') AS draft,
            COUNT(*) FILTER (WHERE o.status = 'cancelled') AS cancelled
        FROM orders o
        {where}
    """), params).fetchone()

    active = row[0] or 0
    completed = row[1] or 0
    to_invoice = row[2] or 0
    draft = row[3] or 0
    cancelled = row[4] or 0

    return {
        "active": active,
        "completed": completed,
        "to_invoice": to_invoice,
        "draft": draft,
        "cancelled": cancelled,
        "total": active + completed + cancelled + draft,
    }


def _tab_where(tab: str) -> str:
    """Return the WHERE clause fragment for a tab filter."""
    if tab == "active":
        return "o.status IN ('confirmed', 'in_progress') AND o.completed = FALSE"
    if tab == "completed":
        return "(o.completed = TRUE OR o.status = 'completed')"
    if tab == "to_invoice":
        return "((o.completed = TRUE OR o.status = 'completed') AND o.issued_invoice = FALSE)"
    if tab == "draft":
        return "o.status = 'draft'"
    if tab == "cancelled":
        return "o.status = 'cancelled'"
    return "TRUE"  # all


def list_shipments(conn, tab: str, company_id: str | None, limit: int, offset: int) -> tuple[list[dict], int]:
    """Paginated shipment list with company name JOIN. Returns (rows, total_count)."""
    tab_filter = _tab_where(tab)

    where = f"o.trash = FALSE AND o.order_type = 'shipment' AND {tab_filter}"
    params: dict = {"limit": limit, "offset": offset}
    if company_id:
        where += " AND o.company_id = :company_id"
        params["company_id"] = company_id

    # Total count
    total = conn.execute(text(f"""
        SELECT COUNT(*) FROM orders o WHERE {where}
    """), params).scalar() or 0

    # Paginated rows
    rows = conn.execute(text(f"""
        SELECT o.order_id, 2 AS data_version, o.migrated_from_v1,
               o.status, o.sub_status,
               sd.order_type_detail, sd.transaction_type, sd.incoterm_code AS incoterm,
               sd.origin_port, sd.dest_port AS destination_port,
               o.company_id, c.name AS company_name,
               sd.cargo_ready_date::text, o.updated_at::text AS updated,
               o.issued_invoice,
               sd.origin_terminal, sd.dest_terminal,
               (o.cargo->>'is_dg')::boolean AS cargo_is_dg,
               o.is_test
        FROM orders o
        JOIN shipment_details sd ON sd.order_id = o.order_id
        LEFT JOIN companies c ON c.id = o.company_id
        WHERE {where}
        ORDER BY o.countid DESC
        LIMIT :limit OFFSET :offset
    """), params).fetchall()

    items = []
    for r in rows:
        items.append({
            "shipment_id": r[0],
            "data_version": r[1],
            "migrated_from_v1": r[2] or False,
            "status": r[3],
            "sub_status": r[4],
            "order_type": r[5] or "",
            "transaction_type": r[6] or "",
            "incoterm": r[7] or "",
            "origin_port": r[8] or "",
            "destination_port": r[9] or "",
            "company_id": r[10] or "",
            "company_name": r[11] or "",
            "cargo_ready_date": (r[12] or "")[:10] if r[12] else "",
            "updated": (r[13] or "")[:10] if r[13] else "",
            "issued_invoice": r[14] or False,
            "origin_terminal": r[15] or None,
            "dest_terminal": r[16] or None,
            "cargo_is_dg": r[17] or False,
            "is_test": r[18] or False,
        })

    return items, total


def search_shipments(conn, q: str, company_id: str | None, limit: int, offset: int = 0) -> list[dict]:
    """ILIKE search on order_id, company name, origin_port, dest_port."""
    params: dict = {"q": f"%{q}%", "limit": limit, "offset": offset}
    where = "o.trash = FALSE AND o.order_type = 'shipment'"
    if company_id:
        where += " AND o.company_id = :company_id"
        params["company_id"] = company_id

    rows = conn.execute(text(f"""
        SELECT o.order_id, 2 AS data_version, o.migrated_from_v1,
               o.status, o.sub_status,
               sd.order_type_detail, sd.transaction_type, sd.incoterm_code AS incoterm,
               o.company_id, c.name AS company_name,
               sd.origin_port, sd.dest_port AS destination_port,
               sd.cargo_ready_date::text, o.updated_at::text AS updated,
               o.issued_invoice,
               sd.origin_terminal, sd.dest_terminal
        FROM orders o
        JOIN shipment_details sd ON sd.order_id = o.order_id
        LEFT JOIN companies c ON c.id = o.company_id
        WHERE {where}
          AND (o.order_id ILIKE :q OR c.name ILIKE :q OR sd.origin_port ILIKE :q OR sd.dest_port ILIKE :q)
        ORDER BY o.countid DESC
        LIMIT :limit OFFSET :offset
    """), params).fetchall()

    items = []
    for r in rows:
        items.append({
            "shipment_id": r[0],
            "data_version": r[1],
            "migrated_from_v1": r[2] or False,
            "status": r[3],
            "sub_status": r[4],
            "status_label": STATUS_LABELS.get(r[3], r[3] or ""),
            "order_type": r[5] or "",
            "transaction_type": r[6] or "",
            "incoterm": r[7] or "",
            "company_id": r[8] or "",
            "company_name": r[9] or "",
            "origin_port": r[10] or "",
            "destination_port": r[11] or "",
            "cargo_ready_date": (r[12] or "")[:10] if r[12] else "",
            "updated": (r[13] or "")[:10] if r[13] else "",
            "issued_invoice": r[14] or False,
            "origin_terminal": r[15] or None,
            "dest_terminal": r[16] or None,
        })

    return items


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


def get_shipment_by_id(conn, shipment_id: str) -> dict | None:
    """Full shipment row from orders + shipment_details with company_name JOIN."""
    row = conn.execute(text("""
        SELECT o.*, sd.*, c.name AS company_name
        FROM orders o
        JOIN shipment_details sd ON sd.order_id = o.order_id
        LEFT JOIN companies c ON c.id = o.company_id
        WHERE o.order_id = :id AND o.trash = FALSE
    """), {"id": shipment_id}).fetchone()

    if not row:
        return None

    # Map row to dict using column names
    cols = row._mapping
    data = dict(cols)

    # Parse JSONB columns
    for key in ("cargo", "booking", "parties", "bl_document", "type_details",
                "exception_data", "route_nodes", "status_history", "scope"):
        data[key] = _parse_jsonb(data.get(key))

    # Rename for API compat
    data["exception"] = data.pop("exception_data", None)
    data["quotation_id"] = data["order_id"]
    data["shipment_id"] = data["order_id"]
    data["id"] = data["order_id"]
    data["created"] = str(data.get("created_at") or "")
    data["updated"] = str(data.get("updated_at") or "")

    # Map order_type_detail to order_type for compat
    data["order_type_shipment"] = data.get("order_type_detail") or ""

    # Compat fields expected by platform
    data["data_version"] = 2
    data["origin_port_un_code"] = data.get("origin_port") or ""
    data["destination_port_un_code"] = data.get("dest_port") or ""
    data["origin_terminal_id"] = data.get("origin_terminal")
    data["destination_terminal_id"] = data.get("dest_terminal")

    # Normalize completed fields
    data["completed"] = data.get("completed") or False
    data["completed_at"] = str(data["completed_at"]) if data.get("completed_at") else None

    # Timestamps to string
    for key in ("created_at", "updated_at", "cargo_ready_date"):
        if data.get(key) is not None:
            data[key] = str(data[key])

    return data


def next_shipment_id(conn) -> tuple[str, int]:
    """Get next shipment ID from sequence. Returns (id_string, countid)."""
    countid = conn.execute(text("SELECT nextval('shipment_countid_seq')")).scalar()
    return f"AF-{countid:06d}", countid


def generate_transport_order_id(conn) -> str:
    """Generate next AFDO-XXXXXX transport order ID."""
    row = conn.execute(text(
        "SELECT order_id FROM orders WHERE order_type = 'transport' ORDER BY created_at DESC LIMIT 1"
    )).fetchone()
    if row:
        raw = row[0].replace('AFDO-', '').replace('GT-', '')
        next_num = int(raw) + 1
    else:
        next_num = 731
    return f"AFDO-{next_num:06d}"


def get_company_name(conn, company_id: str) -> str:
    """Quick company name lookup."""
    row = conn.execute(text("SELECT name FROM companies WHERE id = :id"), {"id": company_id}).fetchone()
    return row[0] if row else company_id


def list_companies(conn, search: str | None = None, limit: int = 200) -> list[dict]:
    """List companies with optional ILIKE name search."""
    params: dict = {"limit": limit}
    where = "trash = FALSE"
    if search:
        where += " AND name ILIKE :search"
        params["search"] = f"%{search}%"

    rows = conn.execute(text(f"""
        SELECT id, name, short_name, account_type, email, phone, address,
               xero_contact_id, approved, has_platform_access, trash,
               created_at::text, updated_at::text
        FROM companies
        WHERE {where}
        ORDER BY name
        LIMIT :limit
    """), params).fetchall()

    items = []
    for r in rows:
        items.append({
            "company_id": r[0],
            "id": r[0],
            "name": r[1] or "",
            "short_name": r[2] or "",
            "account_type": r[3] or "AFC",
            "email": r[4] or "",
            "phone": r[5] or "",
            "address": _parse_jsonb(r[6]),
            "xero_contact_id": r[7] or "",
            "approved": r[8] or False,
            "has_platform_access": r[9] or False,
            "trash": r[10] or False,
            "created_at": r[11] or "",
            "updated_at": r[12] or "",
        })

    return items
