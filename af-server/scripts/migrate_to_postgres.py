"""
scripts/migrate_to_postgres.py — Migrate data from Datastore to PostgreSQL.

Usage:
    cd af-server
    .venv/Scripts/python scripts/migrate_to_postgres.py --dry-run
    .venv/Scripts/python scripts/migrate_to_postgres.py --commit
"""

import argparse
import json
import sys
import os
from datetime import datetime, timezone
from psycopg2.extras import Json as PgJson

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(".env.local")

from sqlalchemy import text
from core.db import get_engine
from core.datastore import get_client, parse_timestamp


def _ts(val) -> str | None:
    """Convert Datastore timestamp to ISO string."""
    if val is None:
        return None
    dt = parse_timestamp(val)
    if dt is not None:
        return dt.isoformat()
    s = str(val).strip()
    return s if s else None


def _json_dumps(val) -> str | None:
    """Serialize a value to JSON string, or None if empty."""
    if val is None:
        return None
    if isinstance(val, str):
        try:
            return json.dumps(json.loads(val), default=str)
        except Exception:
            return val
    return json.dumps(val, default=str)


def _pg_json(val):
    """Wrap a value as psycopg2 Json for JSONB columns — avoids ::jsonb cast syntax."""
    if val is None:
        return None
    if isinstance(val, str):
        try:
            return PgJson(json.loads(val))
        except Exception:
            return PgJson({})
    return PgJson(val)


def _date_str(val) -> str | None:
    """Extract YYYY-MM-DD from a value."""
    if val is None:
        return None
    dt = parse_timestamp(val)
    if dt is not None:
        return dt.strftime("%Y-%m-%d")
    s = str(val).strip()
    return s[:10] if s else None


def migrate_companies(ds_client, pg_conn, dry_run: bool) -> int:
    """Migrate Company Kind → companies table."""
    query = ds_client.query(kind="Company")
    entities = list(query.fetch())
    count = 0

    for e in entities:
        cid = e.key.name or str(e.key.id)
        if not cid:
            continue

        row = {
            "id": cid,
            "name": e.get("name") or cid,
            "short_name": e.get("short_name"),
            "account_type": e.get("account_type") or "AFC",
            "email": e.get("email"),
            "phone": e.get("phone"),
            "address": _pg_json(e.get("address")),
            "xero_contact_id": e.get("xero_contact_id"),
            "approved": bool(e.get("approved", False)),
            "has_platform_access": bool(e.get("has_platform_access", False)),
            "trash": bool(e.get("trash", False)),
            "created_at": _ts(e.get("created") or e.get("created_at")) or datetime.now(timezone.utc).isoformat(),
            "updated_at": _ts(e.get("updated") or e.get("updated_at")) or datetime.now(timezone.utc).isoformat(),
        }

        if not dry_run:
            pg_conn.execute(text("""
                INSERT INTO companies (id, name, short_name, account_type, email, phone, address,
                    xero_contact_id, approved, has_platform_access, trash, created_at, updated_at)
                VALUES (:id, :name, :short_name, :account_type, :email, :phone, :address,
                    :xero_contact_id, :approved, :has_platform_access, :trash, :created_at, :updated_at)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name, short_name = EXCLUDED.short_name,
                    account_type = EXCLUDED.account_type, email = EXCLUDED.email,
                    phone = EXCLUDED.phone, address = EXCLUDED.address,
                    xero_contact_id = EXCLUDED.xero_contact_id,
                    approved = EXCLUDED.approved, has_platform_access = EXCLUDED.has_platform_access,
                    trash = EXCLUDED.trash, updated_at = EXCLUDED.updated_at
            """), row)
        count += 1

    return count


def migrate_ports(ds_client, pg_conn, dry_run: bool) -> int:
    """Migrate Port Kind → ports table."""
    query = ds_client.query(kind="Port")
    entities = list(query.fetch())
    count = 0

    for e in entities:
        un_code = e.get("un_code") or e.key.name or ""
        if not un_code:
            continue

        row = {
            "un_code": un_code,
            "name": e.get("name") or e.get("port_name") or un_code,
            "country": e.get("country") or "",
            "country_code": e.get("country_code") or "",
            "port_type": e.get("port_type") or "SEA",
            "has_terminals": bool(e.get("has_terminals", False)),
            "terminals": _pg_json(e.get("terminals") or []),
            "created_at": _ts(e.get("created") or e.get("created_at")) or datetime.now(timezone.utc).isoformat(),
        }

        if not dry_run:
            pg_conn.execute(text("""
                INSERT INTO ports (un_code, name, country, country_code, port_type,
                    has_terminals, terminals, created_at)
                VALUES (:un_code, :name, :country, :country_code, :port_type,
                    :has_terminals, :terminals, :created_at)
                ON CONFLICT (un_code) DO UPDATE SET
                    name = EXCLUDED.name, country = EXCLUDED.country,
                    country_code = EXCLUDED.country_code, port_type = EXCLUDED.port_type,
                    has_terminals = EXCLUDED.has_terminals, terminals = EXCLUDED.terminals
            """), row)
        count += 1

    return count


def migrate_file_tags(ds_client, pg_conn, dry_run: bool) -> int:
    """Migrate FileTags Kind → file_tags table."""
    query = ds_client.query(kind="FileTags")
    entities = list(query.fetch())
    count = 0

    for e in entities:
        tag_id = e.key.name or str(e.key.id)
        if not tag_id:
            continue

        row = {
            "id": tag_id,
            "label": e.get("label") or e.get("name") or tag_id,
            "color": e.get("color"),
        }

        if not dry_run:
            pg_conn.execute(text("""
                INSERT INTO file_tags (id, label, color)
                VALUES (:id, :label, :color)
                ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, color = EXCLUDED.color
            """), row)
        count += 1

    return count


def migrate_shipments(ds_client, pg_conn, dry_run: bool) -> tuple[int, int]:
    """Migrate Quotation Kind (data_version=2) → shipments table."""
    from google.cloud.datastore.query import PropertyFilter

    query = ds_client.query(kind="Quotation")
    query.add_filter(filter=PropertyFilter("data_version", "=", 2))
    entities = list(query.fetch())

    migrated = 0
    skipped = 0
    max_countid = 0

    for e in entities:
        sid = e.key.name or str(e.key.id)
        if not sid:
            skipped += 1
            continue

        company_id = e.get("company_id") or ""
        if not company_id:
            skipped += 1
            continue

        countid = e.get("countid") or 0
        if isinstance(countid, (int, float)):
            countid = int(countid)
        else:
            countid = 0

        # Some V1-migrated records have countid=0 — derive from shipment ID
        # e.g. AF-000002 → 2, AF-003867 → 3867
        if countid == 0 and sid.startswith("AF-"):
            try:
                countid = int(sid.split("-")[1])
            except (IndexError, ValueError):
                pass

        if countid > max_countid:
            max_countid = countid

        row = {
            "id": sid,
            "countid": countid,
            "company_id": company_id,
            "order_type": e.get("order_type") or "SEA_FCL",
            "transaction_type": e.get("transaction_type") or "IMPORT",
            "incoterm_code": e.get("incoterm_code") or e.get("incoterm") or None,
            "status": e.get("status") or 1001,
            "issued_invoice": bool(e.get("issued_invoice", False)),
            "migrated_from_v1": bool(e.get("migrated_from_v1", False)),
            "trash": bool(e.get("trash", False)),
            "origin_port": e.get("origin_port_un_code") or e.get("origin_port") or None,
            "origin_terminal": e.get("origin_terminal_id") or None,
            "dest_port": e.get("destination_port_un_code") or e.get("destination_port") or None,
            "dest_terminal": e.get("destination_terminal_id") or None,
            "cargo_ready_date": _date_str(e.get("cargo_ready_date")),
            "etd": _ts(e.get("etd")),
            "eta": _ts(e.get("eta")),
            "cargo": _pg_json(e.get("cargo")),
            "booking": _pg_json(e.get("booking")),
            "parties": _pg_json(e.get("parties")),
            "bl_document": _pg_json(e.get("bl_document")),
            "type_details": _pg_json(e.get("type_details")),
            "exception_data": _pg_json(e.get("exception")),
            "route_nodes": _pg_json(e.get("route_nodes")),
            "status_history": _pg_json(e.get("status_history") or []),
            "creator": _pg_json(e.get("creator")),
            "created_at": _ts(e.get("created") or e.get("created_at")) or datetime.now(timezone.utc).isoformat(),
            "updated_at": _ts(e.get("updated") or e.get("updated_at")) or datetime.now(timezone.utc).isoformat(),
        }

        if not dry_run:
            pg_conn.execute(text("""
                INSERT INTO shipments (id, countid, company_id, order_type, transaction_type,
                    incoterm_code, status, issued_invoice, migrated_from_v1, trash,
                    origin_port, origin_terminal, dest_port, dest_terminal,
                    cargo_ready_date, etd, eta,
                    cargo, booking, parties, bl_document, type_details, exception_data,
                    route_nodes, status_history, creator, created_at, updated_at)
                VALUES (:id, :countid, :company_id, :order_type, :transaction_type,
                    :incoterm_code, :status, :issued_invoice, :migrated_from_v1, :trash,
                    :origin_port, :origin_terminal, :dest_port, :dest_terminal,
                    :cargo_ready_date, :etd, :eta,
                    :cargo, :booking, :parties, :bl_document,
                    :type_details, :exception_data,
                    :route_nodes, :status_history, :creator,
                    :created_at, :updated_at)
                ON CONFLICT (id) DO UPDATE SET
                    status = EXCLUDED.status, issued_invoice = EXCLUDED.issued_invoice,
                    trash = EXCLUDED.trash, booking = EXCLUDED.booking,
                    parties = EXCLUDED.parties, bl_document = EXCLUDED.bl_document,
                    type_details = EXCLUDED.type_details, exception_data = EXCLUDED.exception_data,
                    route_nodes = EXCLUDED.route_nodes, status_history = EXCLUDED.status_history,
                    etd = EXCLUDED.etd, eta = EXCLUDED.eta, updated_at = EXCLUDED.updated_at
            """), row)
        migrated += 1

    return migrated, skipped, max_countid


def migrate_workflows(ds_client, pg_conn, dry_run: bool) -> int:
    """Migrate ShipmentWorkFlow Kind → shipment_workflows table."""
    query = ds_client.query(kind="ShipmentWorkFlow")
    entities = list(query.fetch())
    count = 0

    for e in entities:
        sid = e.key.name or str(e.key.id)
        if not sid:
            continue

        # Skip orphaned V1 AFCQ- workflows — no corresponding shipment in PostgreSQL
        if sid.startswith("AFCQ-"):
            continue

        row = {
            "shipment_id": sid,
            "company_id": e.get("company_id") or "",
            "workflow_tasks": _pg_json(e.get("workflow_tasks") or []),
            "status_history": _pg_json(e.get("status_history") or []),
            "completed": bool(e.get("completed", False)),
            "created_at": _ts(e.get("created") or e.get("created_at")) or datetime.now(timezone.utc).isoformat(),
            "updated_at": _ts(e.get("updated") or e.get("updated_at")) or datetime.now(timezone.utc).isoformat(),
        }

        if not dry_run:
            pg_conn.execute(text("""
                INSERT INTO shipment_workflows (shipment_id, company_id, workflow_tasks,
                    status_history, completed, created_at, updated_at)
                VALUES (:shipment_id, :company_id, :workflow_tasks,
                    :status_history, :completed, :created_at, :updated_at)
                ON CONFLICT (shipment_id) DO UPDATE SET
                    workflow_tasks = EXCLUDED.workflow_tasks,
                    status_history = EXCLUDED.status_history,
                    completed = EXCLUDED.completed, updated_at = EXCLUDED.updated_at
            """), row)
        count += 1

    return count


def migrate_files(ds_client, pg_conn, dry_run: bool) -> int:
    """Migrate Files Kind → shipment_files table."""
    query = ds_client.query(kind="Files")
    entities = list(query.fetch())
    count = 0

    for e in entities:
        file_id = e.key.id
        shipment_id = e.get("shipment_order_id") or ""
        if not shipment_id or not file_id:
            continue

        permission = e.get("permission") or {}
        if not isinstance(permission, dict):
            permission = {}

        tags = e.get("file_tags") or []
        if isinstance(tags, str):
            try:
                tags = json.loads(tags)
            except (ValueError, TypeError):
                tags = [tags] if tags else []
        tags_array = "{" + ",".join(f'"{t}"' for t in tags) + "}" if tags else "{}"

        row = {
            "shipment_id": shipment_id,
            "company_id": e.get("company_id") or "",
            "file_name": e.get("file_name") or "untitled",
            "file_location": e.get("file_location") or "",
            "file_tags": tags_array,
            "file_description": e.get("file_description"),
            "file_size_kb": e.get("file_size") or 0,
            "visibility": e.get("visibility") if e.get("visibility") is not None else True,
            "notification_sent": bool(e.get("notification_sent", False)),
            "uploaded_by_uid": permission.get("owner") or "",
            "uploaded_by_email": e.get("user") or "",
            "trash": bool(e.get("trash", False)),
            "created_at": _ts(e.get("created") or e.get("created_at")) or datetime.now(timezone.utc).isoformat(),
            "updated_at": _ts(e.get("updated") or e.get("updated_at")) or datetime.now(timezone.utc).isoformat(),
        }

        if not dry_run:
            pg_conn.execute(text("""
                INSERT INTO shipment_files (shipment_id, company_id, file_name, file_location,
                    file_tags, file_description, file_size_kb, visibility, notification_sent,
                    uploaded_by_uid, uploaded_by_email, trash, created_at, updated_at)
                VALUES (:shipment_id, :company_id, :file_name, :file_location,
                    :file_tags, :file_description, :file_size_kb, :visibility,
                    :notification_sent, :uploaded_by_uid, :uploaded_by_email, :trash,
                    :created_at, :updated_at)
            """), row)
        count += 1

    return count


def seed_sequence(pg_conn, max_countid: int, dry_run: bool):
    """Seed shipment_countid_seq to MAX(countid) + 1."""
    if not dry_run and max_countid > 0:
        pg_conn.execute(text(f"SELECT setval('shipment_countid_seq', {max_countid})"))
    return max_countid


def main():
    parser = argparse.ArgumentParser(description="Migrate Datastore to PostgreSQL")
    parser.add_argument("--dry-run", action="store_true", help="Read data without writing")
    parser.add_argument("--commit", action="store_true", help="Write data to PostgreSQL")
    args = parser.parse_args()

    if not args.dry_run and not args.commit:
        print("Specify --dry-run or --commit")
        sys.exit(1)

    dry_run = not args.commit

    ds_client = get_client()
    engine = get_engine()

    with engine.connect() as pg_conn:
        print("Migrating companies...")
        n_companies = migrate_companies(ds_client, pg_conn, dry_run)
        print(f"  Companies:  {n_companies} {'(dry run)' if dry_run else 'migrated'}")

        print("Migrating ports...")
        n_ports = migrate_ports(ds_client, pg_conn, dry_run)
        print(f"  Ports:      {n_ports} {'(dry run)' if dry_run else 'migrated'}")

        print("Migrating file tags...")
        n_tags = migrate_file_tags(ds_client, pg_conn, dry_run)
        print(f"  File Tags:  {n_tags} {'(dry run)' if dry_run else 'migrated'}")

        print("Migrating shipments...")
        n_shipments, n_skipped, max_countid = migrate_shipments(ds_client, pg_conn, dry_run)
        print(f"  Shipments:  {n_shipments} {'(dry run)' if dry_run else 'migrated'}, {n_skipped} skipped")

        print("Migrating workflows...")
        n_workflows = migrate_workflows(ds_client, pg_conn, dry_run)
        print(f"  Workflows:  {n_workflows} {'(dry run)' if dry_run else 'migrated'}")

        print("Migrating files...")
        n_files = migrate_files(ds_client, pg_conn, dry_run)
        print(f"  Files:      {n_files} {'(dry run)' if dry_run else 'migrated'}")

        seq = seed_sequence(pg_conn, max_countid, dry_run)
        print(f"  Sequence seeded at: {seq}")

        if not dry_run:
            pg_conn.commit()
            print("\nMigration committed successfully!")
        else:
            print("\nDry run complete — no data written.")


if __name__ == "__main__":
    main()
