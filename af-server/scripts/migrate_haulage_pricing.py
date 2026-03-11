"""
scripts/migrate_haulage_pricing.py

Migrate PricingHaulage + PTMonthlyRateHaulageTransport (kind=PT-HAULAGE)
from Google Cloud Datastore to PostgreSQL haulage_rate_cards + haulage_rates.

Field mapping:
  PricingHaulage (Datastore kind)     → haulage_rate_cards
    port_un_code                      → port_un_code (normalised — see LEGACY_PORT_TERMINAL_MAP)
    terminal_id                       → terminal_id (resolved from legacy port codes)
    city_code                         → area_id (looked up via areas table)
    container_size                    → container_size ('*' → 'wildcard')
    include_depot_gate_fee            → include_depot_gate_fee
    trash                             → is_active (inverted)
    (inferred from rate rows)         → side_loader_available

  PTMonthlyRateHaulageTransport       → haulage_rates
    (where kind = 'PT-HAULAGE')
    is_price=True, supplier_id=None   → supplier_id = NULL (list price reference)
    is_price=False                    → supplier_id (via resolve_supplier_id)
    price.price                       → list_price
    price.min_price                   → min_list_price
    cost.cost                         → cost
    cost.min_cost                     → min_cost
    charges.toll_fee                  → surcharges JSONB (HA-TOL)
    charges.side_loader_surcharge     → side_loader_surcharge (dedicated column)
    faf                               → SKIPPED (port-level, future migration 040)
    month_year (JAN-2024)             → effective_from (first of month)
    roundup_qty                       → roundup_qty
    uom                               → uom (default: CONTAINER)
    currency                          → currency (default: MYR)

Filters:
  - Date cutoff: only migrate rate rows where effective_from >= 2024-01-01
  - Trash filter: skip PricingHaulage where trash = True
  - Port Klang supplier filter: for MYPKG + MYPKG_N cards, only migrate rates for
    AFS-0023 (Singa Gemini). AFS-0004 excluded. List price rows always migrated.

Supplier ID handling:
  - supplier_id has hard FK to companies(id) (migration 039)
  - Legacy rate rows already use AFS- prefix — no remap required
  - All supplier IDs validated against companies table at runtime

Design note:
  Step 2 fetches all PT-HAULAGE rate entities from Datastore and holds them in memory.
  Step 4 reuses these same entities — no second Datastore fetch — to avoid gRPC timeout
  on large datasets (150K+ entities).

Run from af-server root with Cloud SQL Auth Proxy running and venv active:
    .venv\\Scripts\\python scripts\\migrate_haulage_pricing.py --dry-run
    .venv\\Scripts\\python scripts\\migrate_haulage_pricing.py
"""

import argparse
import json
import logging
import os
import sys
from collections import defaultdict
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

from sqlalchemy import text
from core.db import get_engine
from google.cloud import datastore
from google.cloud.datastore.query import PropertyFilter

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

PROJECT_ID = 'cloud-accele-freight'
KIND_PRICING_HAULAGE = 'PricingHaulage'
KIND_MONTHLY_RATE = 'PTMonthlyRateHaulageTransport'
PT_HAULAGE = 'PT-HAULAGE'

_MONTH_MAP = {
    "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
    "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12,
}

BATCH_SIZE = 500
CUTOFF_DATE = date(2025, 1, 1)

# Supplier ID remap — not required, legacy rate rows already use AFS- prefix
SUPPLIER_ID_REMAP: dict[str, str] = {}

# Port Klang (MYPKG + MYPKG_N): only migrate rates for AFS-0023 (Singa Gemini).
# AFS-0004 is excluded — not active for migration.
MYPKG_SUPPLIER_FILTER = "AFS-0023"

# Second migration run — MYPKG and MYPKG_N only.
# All other ports already migrated in first run.
# Set to empty to migrate all ports.
INCLUDE_PORTS_ONLY: set[str] = {"MYPKG", "MYPKG_N"}

# Normalise legacy port codes and resolve terminal_id
LEGACY_PORT_TERMINAL_MAP = {
    "MYPKG_N": ("MYPKG", "MYPKG_N"),  # Northport
}

# Maps legacy Datastore city_code → new standardised area_code in areas table
LEGACY_AREA_CODE_MAP: dict[str, str] = {
    "AE-215":              "AE-DU-001",
    "AE-DXB-000":          "AE-DU-002",
    "AE-DXB-002":          "AE-DU-003",
    "AU-NSW-SYD":          "AU-NSW-001",
    "AU-WA-6069":          "AU-WA-001",
    "BD-1222":             "BD-DHA-001",
    "BE-AN-2110":          "BE-VAN-001",
    "BN-T4":               "BN-00-001",
    "CH-3400":             "CH-BE-001",
    "CH-ZUR-000":          "CH-ZH-001",
    "CN-AH-15-0564":       "CN-AH-001",
    "CN-BJ":               "CN-BJ-001",
    "CN-BJ-10-100020":     "CN-BJ-002",
    "CN-BJ-10-10080":      "CN-BJ-003",
    "CN-FJ":               "CN-FJ-001",
    "CN-FJ-02-361006":     "CN-FJ-002",
    "CN-GD":               "CN-GD-001",
    "CN-GD-01-020-440115": "CN-GD-002",
    "CN-GD-01-020-511300": "CN-GD-003",
    "CN-GD-01-020-528400": "CN-GD-004",
    "CN-GD-03":            "CN-GD-005",
    "CN-GD-06":            "CN-GD-006",
    "CN-GD-13-51600":      "CN-GD-007",
    "CN-GDG-003":          "CN-GD-008",
    "CN-GZ-020":           "CN-GZ-001",
    "CN-HB-433000":        "CN-HB-001",
    "CN-HE-01-050000":     "CN-HE-001",
    "CN-JS":               "CN-JS-001",
    "CN-JS-0510":          "CN-JS-002",
    "CN-JS-13":            "CN-JS-003",
    "CN-JS-215000":        "CN-JS-004",
    "CN-LN-01-110000":     "CN-LN-001",
    "CN-SC-01":            "CN-SC-001",
    "CN-SD-02-266500":     "CN-SD-001",
    "CN-SH-201100":        "CN-SH-001",
    "CN-ZH-05":            "CN-ZJ-001",
    "CN-ZJ-02":            "CN-ZJ-002",
    "CN-ZJ-03-325000":     "CN-ZJ-003",
    "DE-24568":            "DE-SH-001",
    "DE-33442":            "DE-NW-001",
    "DE-42329":            "DE-NW-002",
    "DE-85774":            "DE-BY-001",
    "ES-07608":            "ES-IB-001",
    "ES-08292":            "ES-CT-001",
    "ES-28880":            "ES-MD-001",
    "ES-29620":            "ES-AN-001",
    "FR-ARA-01150":        "FR-ARA-001",
    "FR-BFC-89107":        "FR-BFC-001",
    "HK-HKG-002":          "HK-00-001",
    "HK-HKG-003":          "HK-00-002",
    "ID-31":               "ID-JI-001",
    "ID-338":              "ID-JI-002",
    "ID-60183":            "ID-JI-003",
    "ID-JKT-0001":         "ID-JK-001",
    "IN-221401":           "IN-UP-001",
    "IN-247001":           "IN-UP-002",
    "IN-302003":           "IN-RJ-001",
    "IN-533005":           "IN-AP-001",
    "IN-GJ-07":            "IN-GJ-001",
    "IN-KA-560":           "IN-KA-001",
    "IT-00159":            "IT-LAZ-001",
    "IT-20099":            "IT-LOM-001",
    "IT-21054":            "IT-LOM-002",
    "IT-42018":            "IT-EMR-001",
    "IT-45-001":           "IT-EMR-002",
    "JP-160":              "JP-TYO-001",
    "JP-173":              "JP-TYO-002",
    "JP-311":              "JP-IBR-001",
    "JP-370":              "JP-GUN-001",
    "JP-616-8312":         "JP-KYO-001",
    "KH-PNH-000":          "KH-00-001",
    "KR-INC-001":          "KR-ICN-001",
    "KR-INC-002":          "KR-GYG-001",
    "KR-PUS-000":          "KR-PUS-001",
    "KR-SEL-05609":        "KR-SEL-001",
    "MN-210":              "MN-00-001",
    "MO-0001":             "MO-00-001",
    "MY-JHR-000":          "MY-JHR-030",
    "MY-JHR-030":          "MY-JHR-031",
    "MY-KUL-000":          "MY-KUL-000",
    "MY-KUL-000-A":        "MY-KUL-070",
    "MY-KUL-099":          "MY-KUL-071",
    "MY-KUL-GOMBAK":       "MY-KUL-072",
    "MY-KUL-SETAPAK":      "MY-KUL-073",
    "MY-LBU-001":          "MY-LBN-001",
    "MY-LBU-002":          "MY-LBN-002",
    "MY-MLK-000":          "MY-MLK-000",
    "MY-SBH-012":          "MY-SBH-001",
    "MY-SBH-89850":        "MY-SBH-002",
    "MY-SBH-91000":        "MY-SBH-003",
    "MY-SEL-064":          "MY-SGR-001",
    "MY-SWK-002":          "MY-SWK-001",
    "MY-SWK-93010":        "MY-SWK-002",
    "MY-SWK-93350":        "MY-SWK-003",
    "MY-SWK-94300":        "MY-SWK-004",
    "MY-SWK-98000":        "MY-SWK-005",
    "MY-SWK-98850":        "MY-SWK-006",
    "NL-0050":             "NL-GR-001",
    "NZ-0001":             "NZ-CAN-001",
    "PL-05092":            "PL-MZ-001",
    "PL-80209":            "PL-PM-001",
    "PT-4590-049":         "PT-OPO-001",
    "PT-4750-823":         "PT-OPO-002",
    "SG-SIN-002":          "SG-00-001",
    "SG-SIN-347730":       "SG-00-002",
    "SG-SIN-69201":        "SG-00-003",
    "SI-1330":             "SI-00-001",
    "TH-13":               "TH-PTM-001",
    "TH-BKK":              "TH-BKK-001",
    "TH-BKK-10250":        "TH-BKK-002",
    "TH-BKK-10400":        "TH-BKK-003",
    "TN-8080":             "TN-NAB-001",
    "TW-HSZ-300":          "TW-00-001",
    "TW-NWT":              "TW-00-002",
    "TW-NWT-251":          "TW-00-003",
    "UK-B24":              "GB-ENG-001",
    "UK-D7":               "GB-ENG-002",
    "US-IN-001":           "US-IN-001",
    "US-LA-70123":         "US-LA-001",
    "US-OH-45066":         "US-OH-001",
    "US-OH-45414":         "US-OH-002",
    "US-TX-78557":         "US-TX-001",
    "VN-013":              "VN-QN-001",
    "VN-024":              "VN-HN-001",
    "VN-028-00001":        "VN-SGN-001",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_month_year(month_year: str) -> date | None:
    """Convert 'JAN-2024' → date(2024, 1, 1)."""
    if not month_year or "-" not in month_year:
        return None
    parts = month_year.strip().upper().split("-")
    if len(parts) != 2:
        return None
    month_str, year_str = parts
    month = _MONTH_MAP.get(month_str)
    if not month:
        return None
    try:
        year = int(year_str)
    except ValueError:
        return None
    return date(year, month, 1)


def _safe_float(val) -> float | None:
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _safe_int(val, default=0) -> int:
    if val is None:
        return default
    try:
        return int(val)
    except (ValueError, TypeError):
        return default


def load_valid_company_ids(conn) -> set[str]:
    """Load all company IDs from the companies table."""
    rows = conn.execute(text("SELECT id FROM companies")).fetchall()
    return {r[0] for r in rows}


def load_areas_map(conn) -> dict[str, int]:
    """Returns {area_code: area_id} from the areas table."""
    rows = conn.execute(text("SELECT area_code, area_id FROM areas")).fetchall()
    return {r[0]: r[1] for r in rows}


def resolve_supplier_id(legacy_id: str | None, valid_ids: set[str]) -> str | None:
    """
    Resolve a legacy supplier ID to a valid companies.id.
    Returns None for list price rows, "SKIP" sentinel for invalid suppliers.
    """
    if legacy_id is None:
        return None
    remapped = SUPPLIER_ID_REMAP.get(legacy_id, legacy_id)
    if remapped not in valid_ids:
        logger.warning(f"  WARN: supplier_id {legacy_id!r} (resolved: {remapped!r}) "
                       f"not found in companies — skipping rate row")
        return "SKIP"
    return remapped


# ---------------------------------------------------------------------------
# Step 2: Fetch rate entities once + scan for side_loader + FAF
# ---------------------------------------------------------------------------

def fetch_and_scan_rate_entities(
    ds_client,
) -> tuple[list, set[int], dict[str, set[tuple]]]:
    """
    Single Datastore fetch of all PT-HAULAGE rate entities.
    Returns:
      - entities: raw list (reused by migrate_rates — avoids second fetch)
      - cards_with_side_loader: set of pt_id ints where any row has side_loader_surcharge > 0
      - faf_log: {port_un_code: set of (faf_percent, faf_value)} for migration 040 reference
    """
    logger.info("\n=== Step 2: Fetching rate entities + scanning for side_loader / FAF ===")

    query = ds_client.query(kind=KIND_MONTHLY_RATE)
    query.add_filter(filter=PropertyFilter("kind", "=", PT_HAULAGE))
    entities = list(query.fetch())
    logger.info(f"  Fetched {len(entities)} PT-HAULAGE rate entities from Datastore")

    cards_with_side_loader: set[int] = set()
    faf_log: dict[str, set[tuple]] = defaultdict(set)
    supplier_ids_per_port: dict[str, set[str]] = defaultdict(set)

    for e in entities:
        month_year = e.get("month_year", "")
        effective_from = _parse_month_year(month_year)
        if not effective_from or effective_from < CUTOFF_DATE:
            continue

        pt_id_raw = e.get("pt_id")
        try:
            pt_id = int(pt_id_raw)
        except (TypeError, ValueError):
            continue

        # Side loader inference
        charges_data = e.get("charges") or {}
        sl = _safe_float(charges_data.get("side_loader_surcharge"))
        if sl is not None and sl > 0:
            cards_with_side_loader.add(pt_id)

        # FAF logging (for migration 040)
        faf_data = e.get("faf") or {}
        faf_percent = _safe_float(faf_data.get("faf_percent") or faf_data.get("percent"))
        faf_value = _safe_float(faf_data.get("faf_value") or faf_data.get("value"))
        port = (e.get("port_un_code") or "").strip()
        if port in LEGACY_PORT_TERMINAL_MAP:
            port = LEGACY_PORT_TERMINAL_MAP[port][0]
        if faf_percent is not None or faf_value is not None:
            faf_log[port].add((faf_percent, faf_value))

        # Supplier ID tracking for dry-run reporting
        is_price = bool(e.get("is_price", False))
        supplier_id = None if is_price else (e.get("supplier_id") or None)
        if supplier_id and port:
            supplier_ids_per_port[port].add(supplier_id)

    logger.info(f"  Cards with side_loader_surcharge > 0: {len(cards_with_side_loader)}")

    logger.info("\n  Distinct supplier IDs per port:")
    for port in sorted(supplier_ids_per_port.keys()):
        sids = sorted(supplier_ids_per_port[port])
        logger.info(f"    {port}: {sids}")

    return entities, cards_with_side_loader, dict(faf_log)


# ---------------------------------------------------------------------------
# Step 3: Migrate PricingHaulage → haulage_rate_cards
# ---------------------------------------------------------------------------

def migrate_rate_cards(
    ds_client,
    conn,
    areas_map: dict[str, int],
    cards_with_side_loader: set[int],
    dry_run: bool,
) -> dict[int, int]:
    """
    Migrate PricingHaulage → haulage_rate_cards.
    Returns card_map: {datastore_pt_id: haulage_rate_cards.id}
    """
    logger.info("\n=== Step 3: Haulage Rate Cards ===")

    query = ds_client.query(kind=KIND_PRICING_HAULAGE)
    entities = list(query.fetch())
    logger.info(f"  Fetched {len(entities)} PricingHaulage entities from Datastore")

    card_map: dict[int, int] = {}
    mypkg_pt_ids: set[int] = set()  # pt_ids belonging to MYPKG/MYPKG_N cards
    migrated = 0
    skipped_trash = 0
    skipped_no_area = 0
    skipped_no_city = 0
    port_counts: dict[str, int] = defaultdict(int)

    for e in entities:
        pt_id = e.key.id_or_name
        if not pt_id:
            logger.warning("  WARN: PricingHaulage entity with no key id, skipping")
            continue

        if e.get("trash", False):
            skipped_trash += 1
            continue

        port_un_code = (e.get("port_un_code") or "").strip()
        city_code = (e.get("city_code") or "").strip()
        container_size_raw = (e.get("container_size") or "").strip()
        include_dgf = bool(e.get("include_depot_gate_fee", False))

        # If INCLUDE_PORTS_ONLY is set, skip all other ports
        if INCLUDE_PORTS_ONLY and port_un_code not in INCLUDE_PORTS_ONLY:
            continue

        # Normalise legacy port codes and resolve terminal_id
        terminal_id = None
        if port_un_code in LEGACY_PORT_TERMINAL_MAP:
            port_un_code, terminal_id = LEGACY_PORT_TERMINAL_MAP[port_un_code]

        # Normalise container_size
        container_size = "wildcard" if container_size_raw == "*" else container_size_raw
        if container_size not in ("20", "40", "40HC", "wildcard"):
            logger.warning(f"  WARN: pt_id={pt_id} unknown container_size={container_size_raw!r}, skipping")
            continue

        if not city_code:
            skipped_no_city += 1
            logger.warning(f"  WARN: pt_id={pt_id} has no city_code, skipping")
            continue

        # Translate legacy city_code → new area_code → area_id
        mapped_code = LEGACY_AREA_CODE_MAP.get(city_code, city_code)
        area_id = areas_map.get(mapped_code)
        if area_id is None:
            skipped_no_area += 1
            logger.warning(f"  WARN: pt_id={pt_id} city_code={city_code!r} (mapped={mapped_code!r}) not found in areas table, skipping")
            continue

        # Track MYPKG pt_ids for supplier filter in Step 4
        if port_un_code == "MYPKG":
            mypkg_pt_ids.add(int(pt_id))

        # Infer side_loader_available from rate row scan
        side_loader = int(pt_id) in cards_with_side_loader

        rate_card_key = (
            f"{port_un_code}:{terminal_id}:{area_id}:{container_size}"
            if terminal_id
            else f"{port_un_code}:{area_id}:{container_size}"
        )
        is_active = not bool(e.get("trash", False))

        if dry_run:
            migrated += 1
            card_map[int(pt_id)] = -1
            port_counts[port_un_code] += 1
            continue

        row = conn.execute(text("""
            INSERT INTO haulage_rate_cards
                (rate_card_key, port_un_code, terminal_id, area_id, container_size,
                 include_depot_gate_fee, side_loader_available, is_active)
            VALUES
                (:key, :port, :terminal_id, :area_id, :container_size,
                 :dgf, :side_loader, :active)
            ON CONFLICT (rate_card_key) DO NOTHING
            RETURNING id
        """), {
            "key": rate_card_key,
            "port": port_un_code,
            "terminal_id": terminal_id,
            "area_id": area_id,
            "container_size": container_size,
            "dgf": include_dgf,
            "side_loader": side_loader,
            "active": is_active,
        }).fetchone()

        if row:
            card_map[int(pt_id)] = row[0]
            migrated += 1
            port_counts[port_un_code] += 1
        else:
            existing = conn.execute(text(
                "SELECT id FROM haulage_rate_cards WHERE rate_card_key = :key"
            ), {"key": rate_card_key}).fetchone()
            if existing:
                card_map[int(pt_id)] = existing[0]
                port_counts[port_un_code] += 1

    logger.info(f"  Migrated: {migrated}")
    logger.info(f"  Skipped (trashed): {skipped_trash}")
    logger.info(f"  Skipped (no city_code): {skipped_no_city}")
    logger.info(f"  Skipped (area not found): {skipped_no_area}")
    logger.info(f"  Cards inferred as side_loader_available=TRUE: {sum(1 for pid in card_map if pid in cards_with_side_loader)}")
    logger.info(f"  Card map size: {len(card_map)}")
    logger.info(f"  MYPKG pt_ids: {len(mypkg_pt_ids)}")
    logger.info(f"  Breakdown by port:")
    for port in sorted(port_counts.keys()):
        logger.info(f"    {port}: {port_counts[port]}")
    return card_map, mypkg_pt_ids


# ---------------------------------------------------------------------------
# Step 4: Migrate rate entities → haulage_rates (reuses entities from Step 2)
# ---------------------------------------------------------------------------

def migrate_rates(
    entities: list,
    conn,
    card_map: dict[int, int],
    mypkg_pt_ids: set[int],
    valid_company_ids: set[str],
    dry_run: bool,
):
    """
    Process pre-fetched PT-HAULAGE rate entities → haulage_rates.
    Receives the entity list from fetch_and_scan_rate_entities — no second Datastore fetch.
    """
    logger.info("\n=== Step 4: Haulage Rates ===")
    logger.info(f"  Processing {len(entities)} PT-HAULAGE entities (reusing Step 2 fetch)")

    grouped: dict[tuple[int, str | None], list[dict]] = defaultdict(list)

    skipped_old = 0
    skipped_no_card = 0
    skipped_supplier_invalid = 0
    skipped_mypkg_filter = 0
    parse_errors = 0
    count_list_price = 0
    count_supplier = 0

    for e in entities:
        month_year = e.get("month_year", "")
        effective_from = _parse_month_year(month_year)

        if not effective_from:
            parse_errors += 1
            continue

        if effective_from < CUTOFF_DATE:
            skipped_old += 1
            continue

        pt_id_raw = e.get("pt_id")
        try:
            pt_id = int(pt_id_raw)
        except (TypeError, ValueError):
            parse_errors += 1
            logger.warning(f"  WARN: Could not parse pt_id={pt_id_raw!r}, skipping")
            continue

        if pt_id not in card_map:
            skipped_no_card += 1
            continue

        db_card_id = card_map[pt_id]
        if db_card_id == -1:
            db_card_id = pt_id  # dry run surrogate

        is_price = bool(e.get("is_price", False))
        raw_supplier_id = None if is_price else (e.get("supplier_id") or None)

        # Port Klang supplier filter — keyed on pt_id membership, not port_un_code
        # (port_un_code is not stored on rate entities, only on PricingHaulage cards)
        if pt_id in mypkg_pt_ids and not is_price and raw_supplier_id != MYPKG_SUPPLIER_FILTER:
            skipped_mypkg_filter += 1
            continue

        # Resolve supplier_id against companies table
        supplier_id = resolve_supplier_id(raw_supplier_id, valid_company_ids)
        if supplier_id == "SKIP":
            skipped_supplier_invalid += 1
            continue

        if is_price:
            count_list_price += 1
        else:
            count_supplier += 1

        price_data = e.get("price") or {}
        cost_data = e.get("cost") or {}
        charges_data = e.get("charges") or {}

        # Toll fee → surcharges JSONB (side_loader goes to dedicated column)
        surcharges = []
        toll_fee = _safe_float(charges_data.get("toll_fee"))
        if toll_fee is not None and toll_fee > 0:
            surcharges.append({
                "code": "HA-TOL",
                "description": "Toll Fee",
                "amount": toll_fee,
            })

        side_loader_surcharge = _safe_float(charges_data.get("side_loader_surcharge"))

        grouped[(db_card_id, supplier_id)].append({
            "rate_card_id": db_card_id,
            "supplier_id": supplier_id,
            "effective_from": effective_from,
            "currency": (e.get("currency") or "MYR").strip(),
            "uom": (e.get("uom") or "CONTAINER").strip(),
            "list_price": _safe_float(price_data.get("price")) if is_price else None,
            "min_list_price": _safe_float(price_data.get("min_price")) if is_price else None,
            "cost": _safe_float(cost_data.get("cost")) if not is_price else None,
            "min_cost": _safe_float(cost_data.get("min_cost")) if not is_price else None,
            "surcharges": surcharges if surcharges else None,
            "side_loader_surcharge": side_loader_surcharge,
            "roundup_qty": _safe_int(e.get("roundup_qty"), default=0),
            "rate_status": "PUBLISHED",
        })

    logger.info(f"  Skipped (pre-{CUTOFF_DATE.year}): {skipped_old}")
    logger.info(f"  Skipped (no matching rate card): {skipped_no_card}")
    logger.info(f"  Skipped (supplier not in companies): {skipped_supplier_invalid}")
    logger.info(f"  Skipped (MYPKG supplier filter): {skipped_mypkg_filter}")
    logger.info(f"  Parse errors: {parse_errors}")
    logger.info(f"  Groups (card+supplier combos): {len(grouped)}")
    logger.info(f"  List price rows: {count_list_price}")
    logger.info(f"  Supplier cost rows: {count_supplier}")

    total_rows = sum(len(v) for v in grouped.values())

    if dry_run:
        logger.info(f"  [DRY RUN] Would insert {total_rows} haulage_rates rows")
        return

    # Insert with date range closing
    batch: list[dict] = []
    total_inserted = 0

    for (db_card_id, supplier_id), rows in grouped.items():
        rows.sort(key=lambda r: r["effective_from"])

        for i, row in enumerate(rows):
            if i < len(rows) - 1:
                next_from = rows[i + 1]["effective_from"]
                row["effective_to"] = next_from - timedelta(days=1)
            else:
                row["effective_to"] = None

            batch.append({
                "rate_card_id": row["rate_card_id"],
                "supplier_id": row["supplier_id"],
                "effective_from": row["effective_from"],
                "effective_to": row["effective_to"],
                "rate_status": row["rate_status"],
                "currency": row["currency"],
                "uom": row["uom"],
                "list_price": row["list_price"],
                "min_list_price": row["min_list_price"],
                "cost": row["cost"],
                "min_cost": row["min_cost"],
                "surcharges": json.dumps(row["surcharges"]) if row["surcharges"] else None,
                "side_loader_surcharge": row["side_loader_surcharge"],
                "roundup_qty": row["roundup_qty"],
            })
            total_inserted += 1

            if len(batch) >= BATCH_SIZE:
                _insert_rates(conn, batch)
                batch.clear()

    if batch:
        _insert_rates(conn, batch)

    logger.info(f"  haulage_rates rows inserted: {total_inserted}")


def _insert_rates(conn, batch: list[dict]):
    conn.execute(text("""
        INSERT INTO haulage_rates
            (rate_card_id, supplier_id, effective_from, effective_to,
             rate_status, currency, uom,
             list_price, min_list_price, cost, min_cost,
             surcharges, side_loader_surcharge, roundup_qty)
        VALUES
            (:rate_card_id, :supplier_id, :effective_from, :effective_to,
             :rate_status, :currency, :uom,
             :list_price, :min_list_price, :cost, :min_cost,
             CAST(:surcharges AS jsonb), :side_loader_surcharge, :roundup_qty)
    """), batch)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Migrate PricingHaulage from Datastore to PostgreSQL"
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Print counts only — no DB writes")
    args = parser.parse_args()

    key_file = os.path.join(os.path.dirname(__file__), '..', 'cloud-accele-freight-key.json')
    if os.path.exists(key_file):
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = os.path.abspath(key_file)

    ds_client = datastore.Client(project=PROJECT_ID)
    engine = get_engine()

    with engine.connect() as conn:
        # Step 1: Load reference data from PostgreSQL
        logger.info("\n=== Step 1: Loading reference data from PostgreSQL ===")
        valid_company_ids = load_valid_company_ids(conn)
        logger.info(f"  Companies loaded: {len(valid_company_ids)}")
        areas_map = load_areas_map(conn)
        logger.info(f"  Areas loaded: {len(areas_map)}")

        if not areas_map:
            logger.error("  ERROR: No areas found in DB. Run area migrations first.")
            sys.exit(1)

        # Step 2: Single Datastore fetch — scan for side_loader + FAF, keep entities for Step 4
        rate_entities, cards_with_side_loader, faf_log = fetch_and_scan_rate_entities(ds_client)

        # Step 3: Rate cards (separate Datastore kind — PricingHaulage)
        card_map, mypkg_pt_ids = migrate_rate_cards(ds_client, conn, areas_map, cards_with_side_loader, args.dry_run)

        # Step 4: Rates — reuse rate_entities from Step 2, no second fetch
        migrate_rates(rate_entities, conn, card_map, mypkg_pt_ids, valid_company_ids, args.dry_run)

        # FAF summary for migration 040
        if faf_log:
            logger.info("\nFAF values encountered (for future migration 040):")
            for port in sorted(faf_log.keys()):
                vals = sorted(faf_log[port], key=lambda t: (t[0] is None, t[0] or 0, t[1] is None, t[1] or 0))
                percents = sorted(set(v[0] for v in vals if v[0] is not None and v[0] != 0))
                values = sorted(set(v[1] for v in vals if v[1] is not None and v[1] != 0))
                logger.info(f"  {port}: faf_percent={percents} faf_value={values}")

        if not args.dry_run:
            conn.commit()

    prefix = "DRY RUN — " if args.dry_run else ""
    logger.info(f"\n{prefix}Migration complete.")
    logger.info(f"  Rate cards mapped: {len(card_map)}")


if __name__ == "__main__":
    main()
