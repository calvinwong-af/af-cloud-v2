"""
scripts/migrate_currency_rates.py

Migrate CurrencyConversion pairs from Google Cloud Datastore into the
PostgreSQL currency_rates table.

Each Datastore entity maps to one row in currency_rates with:
    effective_from = 2026-01-01   (baseline — first formal v2 rate date)
    notes          = "Migrated from legacy Datastore"

Datastore Kind: CurrencyConversion
  Key format : "{base_currency}-{target_currency}"  e.g. "USD-MYR"
  Fields     : base_currency, conversion_currency, conversion_rate

PostgreSQL target:
    base_currency   ← base_currency
    target_currency ← conversion_currency
    rate            ← conversion_rate
    effective_from  = 2026-01-01

Run from af-server root with Cloud SQL Auth Proxy running and venv active:
    .venv\\Scripts\\python scripts\\migrate_currency_rates.py --dry-run
    .venv\\Scripts\\python scripts\\migrate_currency_rates.py
"""

import argparse
import logging
import os
import re
import sys
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(".env.local")

import psycopg2
from google.cloud import datastore

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

EFFECTIVE_FROM = date(2026, 1, 1)
NOTES = "Migrated from legacy Datastore"
DATASTORE_KIND = "CurrencyConversion"


def _parse_dsn(database_url: str) -> str:
    return re.sub(r"\+psycopg2", "", database_url)


def fetch_from_datastore() -> list[dict]:
    """Fetch all CurrencyConversion entities from Datastore."""
    ds_client = datastore.Client()
    query = ds_client.query(kind=DATASTORE_KIND)
    results = []
    for entity in query.fetch():
        base = entity.get("base_currency", "").strip().upper()
        target = entity.get("conversion_currency", "").strip().upper()
        rate = entity.get("conversion_rate")

        if not base or not target:
            log.warning(f"Skipping entity with missing currency fields: {dict(entity)}")
            continue
        if base == target:
            log.warning(f"Skipping self-conversion pair: {base}-{target}")
            continue
        if rate is None or float(rate) <= 0:
            log.warning(f"Skipping {base}-{target}: invalid rate {rate}")
            continue

        results.append({
            "base_currency": base,
            "target_currency": target,
            "rate": float(rate),
        })
        log.info(f"  Found: {base} → {target}  rate={float(rate):.6f}")

    return results


def migrate(pairs: list[dict], dsn: str, dry_run: bool) -> None:
    if not pairs:
        log.warning("No currency pairs found in Datastore — nothing to migrate.")
        return

    log.info(f"\n{'DRY RUN — ' if dry_run else ''}Migrating {len(pairs)} currency pair(s) "
             f"with effective_from = {EFFECTIVE_FROM}...")

    if dry_run:
        for p in pairs:
            log.info(f"  [DRY RUN] INSERT {p['base_currency']}-{p['target_currency']} "
                     f"rate={p['rate']:.6f}")
        log.info("Dry run complete. No changes written.")
        return

    conn = psycopg2.connect(dsn)
    try:
        conn.autocommit = True
        cur = conn.cursor()

        inserted = 0
        skipped = 0

        for p in pairs:
            # Use ON CONFLICT DO NOTHING — safe to re-run
            cur.execute("""
                INSERT INTO currency_rates
                    (base_currency, target_currency, rate, effective_from, notes)
                VALUES
                    (%s, %s, %s, %s, %s)
                ON CONFLICT (base_currency, target_currency, effective_from)
                DO NOTHING
            """, (
                p["base_currency"],
                p["target_currency"],
                p["rate"],
                EFFECTIVE_FROM,
                NOTES,
            ))

            if cur.rowcount == 1:
                inserted += 1
                log.info(f"  Inserted: {p['base_currency']} → {p['target_currency']}  "
                         f"rate={p['rate']:.6f}")
            else:
                skipped += 1
                log.info(f"  Skipped (already exists): {p['base_currency']} → {p['target_currency']}")

        cur.close()
        log.info(f"\nMigration complete. Inserted: {inserted}  Skipped: {skipped}")
    finally:
        conn.close()


def verify(dsn: str) -> None:
    conn = psycopg2.connect(dsn)
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT base_currency, target_currency, rate, effective_from
            FROM currency_rates
            WHERE notes = %s
            ORDER BY base_currency, target_currency
        """, (NOTES,))
        rows = cur.fetchall()
        log.info(f"\nVerification — migrated rows in currency_rates ({len(rows)} found):")
        for row in rows:
            log.info(f"  {row[0]:<4} → {row[1]:<4}  rate={float(row[2]):.6f}  "
                     f"effective_from={row[3]}")
        cur.close()
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="Migrate CurrencyConversion from Datastore to PostgreSQL currency_rates"
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Print what would be migrated without writing to the database")
    args = parser.parse_args()

    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        log.error("DATABASE_URL not set in .env.local")
        sys.exit(1)

    dsn = _parse_dsn(database_url)

    # Verify currency_rates table exists
    try:
        conn = psycopg2.connect(dsn)
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM currency_rates LIMIT 1")
        cur.close()
        conn.close()
    except Exception as e:
        log.error(f"currency_rates table not accessible: {e}")
        log.error("Run run_migration_047.py first.")
        sys.exit(1)

    log.info("Fetching CurrencyConversion entities from Datastore...")
    pairs = fetch_from_datastore()
    log.info(f"Found {len(pairs)} valid pair(s).")

    migrate(pairs, dsn, dry_run=args.dry_run)

    if not args.dry_run:
        verify(dsn)


if __name__ == "__main__":
    main()
