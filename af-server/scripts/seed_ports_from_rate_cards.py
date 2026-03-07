"""
scripts/seed_ports_from_rate_cards.py

Seeds missing ports into the `ports` table by scanning all port codes
referenced in `fcl_rate_cards` and `lcl_rate_cards`.

Usage:
    cd af-server
    .venv/Scripts/python scripts/seed_ports_from_rate_cards.py --dry-run
    .venv/Scripts/python scripts/seed_ports_from_rate_cards.py
"""

import sys
import argparse
import logging

sys.path.insert(0, ".")

from dotenv import load_dotenv
load_dotenv(".env.local")

from core.db import get_engine
from sqlalchemy import text

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger(__name__)

COUNTRY_NAMES = {
    "AE": "United Arab Emirates",
    "AU": "Australia",
    "BD": "Bangladesh",
    "BE": "Belgium",
    "BH": "Bahrain",
    "BR": "Brazil",
    "CA": "Canada",
    "CN": "China",
    "DE": "Germany",
    "EG": "Egypt",
    "ES": "Spain",
    "FR": "France",
    "GB": "United Kingdom",
    "HK": "Hong Kong",
    "ID": "Indonesia",
    "IN": "India",
    "IT": "Italy",
    "JP": "Japan",
    "KE": "Kenya",
    "KR": "South Korea",
    "KW": "Kuwait",
    "LK": "Sri Lanka",
    "MX": "Mexico",
    "MY": "Malaysia",
    "NG": "Nigeria",
    "NL": "Netherlands",
    "NZ": "New Zealand",
    "OM": "Oman",
    "PK": "Pakistan",
    "QA": "Qatar",
    "SA": "Saudi Arabia",
    "SG": "Singapore",
    "TH": "Thailand",
    "TR": "Turkey",
    "TW": "Taiwan",
    "US": "United States",
    "VN": "Vietnam",
    "ZA": "South Africa",
}

MISSING_PORTS_SQL = text("""
    SELECT DISTINCT port_code FROM (
        SELECT origin_port_code AS port_code FROM fcl_rate_cards
        UNION
        SELECT destination_port_code AS port_code FROM fcl_rate_cards
        UNION
        SELECT origin_port_code AS port_code FROM lcl_rate_cards
        UNION
        SELECT destination_port_code AS port_code FROM lcl_rate_cards
    ) all_codes
    WHERE port_code NOT IN (SELECT un_code FROM ports)
    ORDER BY port_code
""")

INSERT_SQL = text("""
    INSERT INTO ports (un_code, name, country, country_code, port_type, has_terminals, terminals)
    VALUES (:un_code, :name, :country, :country_code, :port_type, :has_terminals, '[]'::jsonb)
    ON CONFLICT (un_code) DO NOTHING
""")


def get_missing_ports(conn):
    rows = conn.execute(MISSING_PORTS_SQL).fetchall()
    return [r[0] for r in rows]


def derive_port_metadata(port_code: str) -> dict:
    cc = port_code[:2]
    return {
        "un_code": port_code,
        "name": port_code,
        "country": COUNTRY_NAMES.get(cc, cc),
        "country_code": cc,
        "port_type": "SEA",
        "has_terminals": False,
    }


def main():
    parser = argparse.ArgumentParser(description="Seed missing ports from rate cards")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be inserted without writing")
    args = parser.parse_args()

    engine = get_engine()

    with engine.connect() as conn:
        missing = get_missing_ports(conn)

        if not missing:
            log.info("No missing ports found. All rate card port codes exist in the ports table.")
            return

        log.info(f"Found {len(missing)} port codes in rate cards missing from ports table:\n")
        for code in missing:
            cc = code[:2]
            country = COUNTRY_NAMES.get(cc, cc)
            log.info(f"  {code}  ({cc} / {country})")

        if args.dry_run:
            log.info(f"\n[DRY RUN] Would insert {len(missing)} ports. No changes made.")
            remaining = len(missing)
            log.info(f"Verification: {remaining} rate card port codes would still be missing if not inserted.")
            return

        # Real run — insert
        inserted = 0
        skipped = 0
        for code in missing:
            meta = derive_port_metadata(code)
            result = conn.execute(INSERT_SQL, meta)
            if result.rowcount > 0:
                log.info(f"  Inserted: {code}")
                inserted += 1
            else:
                log.info(f"  Skipped (already exists): {code}")
                skipped += 1

        conn.commit()
        log.info(f"\nInserted {inserted} new ports. {skipped} already existed (skipped).")

        # Verification
        still_missing = get_missing_ports(conn)
        log.info(f"Verification: {len(still_missing)} rate card port codes still missing from ports.")


if __name__ == "__main__":
    main()
