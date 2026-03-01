"""
core/db_queries.py — Shared SQL query helpers.

All queries use SQLAlchemy text() — no ORM.
"""

import json
from sqlalchemy import text
from core.constants import STATUS_LABELS


def get_shipment_stats(conn, company_id: str | None = None) -> dict:
    """Single SQL aggregation query for dashboard KPI cards and tab badges."""
    where = "WHERE s.trash = FALSE"
    params = {}
    if company_id:
        where += " AND s.company_id = :company_id"
        params["company_id"] = company_id

    row = conn.execute(text(f"""
        SELECT
            COUNT(*) FILTER (WHERE
                s.status IN (3001, 3002, 4001, 4002)
                OR (s.status = 2001 AND s.migrated_from_v1 = FALSE)
            ) AS active,
            COUNT(*) FILTER (WHERE
                s.status = 5001
                OR (s.status = 2001 AND s.migrated_from_v1 = TRUE)
            ) AS completed,
            COUNT(*) FILTER (WHERE
                s.status = 5001 AND s.issued_invoice = FALSE
            ) AS to_invoice,
            COUNT(*) FILTER (WHERE s.status IN (1001, 1002)) AS draft,
            COUNT(*) FILTER (WHERE s.status = -1) AS cancelled
        FROM shipments s
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
        return "(s.status IN (3001, 3002, 4001, 4002) OR (s.status = 2001 AND s.migrated_from_v1 = FALSE))"
    if tab == "completed":
        return "(s.status = 5001 OR (s.status = 2001 AND s.migrated_from_v1 = TRUE))"
    if tab == "to_invoice":
        return "(s.status = 5001 AND s.issued_invoice = FALSE)"
    if tab == "draft":
        return "s.status IN (1001, 1002)"
    if tab == "cancelled":
        return "s.status = -1"
    return "TRUE"  # all


def list_shipments(conn, tab: str, company_id: str | None, limit: int, offset: int) -> tuple[list[dict], int]:
    """Paginated shipment list with company name JOIN. Returns (rows, total_count)."""
    tab_filter = _tab_where(tab)

    where = f"s.trash = FALSE AND {tab_filter}"
    params: dict = {"limit": limit, "offset": offset}
    if company_id:
        where += " AND s.company_id = :company_id"
        params["company_id"] = company_id

    # Total count
    total = conn.execute(text(f"""
        SELECT COUNT(*) FROM shipments s WHERE {where}
    """), params).scalar() or 0

    # Paginated rows
    rows = conn.execute(text(f"""
        SELECT s.id AS shipment_id, 2 AS data_version, s.migrated_from_v1,
               s.status, s.order_type, s.transaction_type, s.incoterm_code AS incoterm,
               s.origin_port, s.dest_port AS destination_port,
               s.company_id, c.name AS company_name,
               s.cargo_ready_date::text, s.updated_at::text AS updated
        FROM shipments s
        LEFT JOIN companies c ON c.id = s.company_id
        WHERE {where}
        ORDER BY s.countid DESC
        LIMIT :limit OFFSET :offset
    """), params).fetchall()

    items = []
    for r in rows:
        items.append({
            "shipment_id": r[0],
            "data_version": r[1],
            "migrated_from_v1": r[2] or False,
            "status": r[3],
            "order_type": r[4] or "",
            "transaction_type": r[5] or "",
            "incoterm": r[6] or "",
            "origin_port": r[7] or "",
            "destination_port": r[8] or "",
            "company_id": r[9] or "",
            "company_name": r[10] or "",
            "cargo_ready_date": (r[11] or "")[:10] if r[11] else "",
            "updated": (r[12] or "")[:10] if r[12] else "",
        })

    return items, total


def search_shipments(conn, q: str, company_id: str | None, limit: int) -> list[dict]:
    """ILIKE search on id, company name, origin_port, dest_port."""
    params: dict = {"q": f"%{q}%", "limit": limit}
    where = "s.trash = FALSE"
    if company_id:
        where += " AND s.company_id = :company_id"
        params["company_id"] = company_id

    rows = conn.execute(text(f"""
        SELECT s.id AS shipment_id, 2 AS data_version, s.status,
               s.order_type, s.company_id, c.name AS company_name,
               s.origin_port, s.dest_port AS destination_port, s.updated_at::text AS updated
        FROM shipments s
        LEFT JOIN companies c ON c.id = s.company_id
        WHERE {where}
          AND (s.id ILIKE :q OR c.name ILIKE :q OR s.origin_port ILIKE :q OR s.dest_port ILIKE :q)
        ORDER BY s.updated_at DESC
        LIMIT :limit
    """), params).fetchall()

    items = []
    for r in rows:
        items.append({
            "shipment_id": r[0],
            "data_version": r[1],
            "status": r[2],
            "status_label": STATUS_LABELS.get(r[2], str(r[2])),
            "order_type": r[3] or "",
            "company_id": r[4] or "",
            "company_name": r[5] or "",
            "origin_port": r[6] or "",
            "destination_port": r[7] or "",
            "updated": (r[8] or "")[:10] if r[8] else "",
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
    """Full shipment row with company_name JOIN."""
    row = conn.execute(text("""
        SELECT s.*, c.name AS company_name
        FROM shipments s
        LEFT JOIN companies c ON c.id = s.company_id
        WHERE s.id = :id
    """), {"id": shipment_id}).fetchone()

    if not row:
        return None

    # Map row to dict using column names
    cols = row._mapping
    data = dict(cols)

    # Parse JSONB columns
    for key in ("cargo", "booking", "parties", "bl_document", "type_details",
                "exception_data", "route_nodes", "status_history", "creator"):
        data[key] = _parse_jsonb(data.get(key))

    # Rename for API compat
    data["exception"] = data.pop("exception_data", None)
    data["quotation_id"] = data["id"]
    data["created"] = str(data.get("created_at") or "")
    data["updated"] = str(data.get("updated_at") or "")

    # Compat fields expected by platform
    data["data_version"] = 2
    data["origin_port_un_code"] = data.get("origin_port") or ""
    data["destination_port_un_code"] = data.get("dest_port") or ""
    data["origin_terminal_id"] = data.get("origin_terminal")
    data["destination_terminal_id"] = data.get("dest_terminal")

    # Timestamps to string
    for key in ("etd", "eta", "created_at", "updated_at", "cargo_ready_date"):
        if data.get(key) is not None:
            data[key] = str(data[key])

    return data


def next_shipment_id(conn) -> tuple[str, int]:
    """Get next shipment ID from sequence. Returns (id_string, countid)."""
    countid = conn.execute(text("SELECT nextval('shipment_countid_seq')")).scalar()
    return f"AF-{countid:06d}", countid


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
