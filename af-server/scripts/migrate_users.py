#!/usr/bin/env python3
"""
scripts/migrate_users.py

Migrate user data from Datastore (UserAccount + UserIAM + CompanyUserAccount)
to the PostgreSQL users table.

Steps:
  1. Reads all UserAccount entities from Datastore
  2. For each, fetches the corresponding UserIAM and CompanyUserAccount
  3. Upserts into the users PostgreSQL table
  4. Prints a summary: total processed, inserted/updated, skipped, errors

Use --dry-run to preview without writing.

Usage:
    .venv/Scripts/python scripts/migrate_users.py
    .venv/Scripts/python scripts/migrate_users.py --dry-run
"""

import argparse
import logging
import os
import sys

# Allow running from af-server root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env.local"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def _batch_get(ds, keys: list) -> dict:
    """Fetch a list of Datastore keys in chunks of 1000. Returns uid → entity map."""
    results = {}
    for i in range(0, len(keys), 1000):
        chunk = keys[i:i + 1000]
        entities = ds.get_multi(chunk)
        for e in entities:
            if e:
                uid = e.key.name or str(e.key.id)
                results[uid] = e
    return results


def run(dry_run: bool):
    from core.datastore import get_client
    from core.db import get_engine
    from sqlalchemy import text

    ds = get_client()
    engine = get_engine()

    # --- Read all UserAccount entities ---
    logger.info("Fetching UserAccount entities from Datastore...")
    query = ds.query(kind="UserAccount")
    accounts = list(query.fetch())
    logger.info("Found %d UserAccount entities", len(accounts))

    if not accounts:
        logger.warning("No UserAccount entities found — nothing to migrate")
        return

    # --- Deduplicate by email: AFU (staff) takes priority over AFC (customer) ---
    acct_by_email: dict = {}
    for acct in accounts:
        uid = acct.key.name or str(acct.key.id)
        email = (acct.get("email") or "").strip().lower()
        if not email:
            logger.warning("Skipping UserAccount uid=%s — no email", uid)
            continue
        existing = acct_by_email.get(email)
        if not existing:
            acct_by_email[email] = acct
        elif acct.get("account_type") == "AFU" and existing.get("account_type") != "AFU":
            acct_by_email[email] = acct  # AFU takes priority

    unique_accounts = list(acct_by_email.values())
    logger.info("%d unique accounts after email deduplication", len(unique_accounts))

    # --- Batch fetch UserIAM and CompanyUserAccount ---
    uids = [a.key.name or str(a.key.id) for a in unique_accounts]
    logger.info("Fetching UserIAM + CompanyUserAccount for %d users...", len(uids))

    iam_keys = [ds.key("UserIAM", uid) for uid in uids]
    cua_keys = [ds.key("CompanyUserAccount", uid) for uid in uids]
    iam_map = _batch_get(ds, iam_keys)
    cua_map = _batch_get(ds, cua_keys)

    logger.info("Found %d UserIAM, %d CompanyUserAccount entities", len(iam_map), len(cua_map))

    # --- Upsert into PostgreSQL ---
    total = inserted = skipped = errors = 0

    with engine.connect() as conn:
        for acct in unique_accounts:
            uid = acct.key.name or str(acct.key.id)
            email = (acct.get("email") or "").strip().lower()
            total += 1

            try:
                iam = iam_map.get(uid)
                cua = cua_map.get(uid)

                first_name = (acct.get("first_name") or "").strip()
                last_name = (acct.get("last_name") or "").strip()
                phone_number = (acct.get("phone_number") or "").strip() or None
                account_type = (acct.get("account_type") or "AFC").strip()
                email_validated = bool(acct.get("email_validated", False))

                # Normalize created_at to ISO string
                created_raw = acct.get("created") or acct.get("created_at")
                if created_raw and hasattr(created_raw, "isoformat"):
                    created_at = created_raw.isoformat()
                elif created_raw:
                    created_at = str(created_raw)
                else:
                    created_at = None

                # IAM fields
                role = (iam.get("role") or "").strip() if iam else ""
                valid_access = bool(iam.get("valid_access", True)) if iam else True

                # company_id: CUA is primary, IAM fallback
                company_id = None
                if cua:
                    company_id = cua.get("company_id") or None
                if not company_id and iam:
                    company_id = iam.get("company_id") or None

                last_login = iam.get("last_login") if iam else None

                row = {
                    "uid": uid,
                    "email": email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "phone_number": phone_number,
                    "account_type": account_type,
                    "role": role,
                    "company_id": company_id,
                    "valid_access": valid_access,
                    "email_validated": email_validated,
                    "last_login": last_login,
                    "created_at": created_at,
                }

                if dry_run:
                    logger.info(
                        "[DRY RUN] uid=%-30s email=%-40s type=%s role=%-12s valid=%s company=%s",
                        uid, email, account_type, role, valid_access, company_id,
                    )
                    inserted += 1
                    continue

                conn.execute(text("""
                    INSERT INTO users (
                        uid, email, first_name, last_name, phone_number,
                        account_type, role, company_id, valid_access,
                        email_validated, last_login, created_at, updated_at
                    ) VALUES (
                        :uid, :email, :first_name, :last_name, :phone_number,
                        :account_type, :role, :company_id, :valid_access,
                        :email_validated, :last_login,
                        COALESCE(:created_at::timestamptz, NOW()), NOW()
                    )
                    ON CONFLICT (uid) DO UPDATE SET
                        email           = EXCLUDED.email,
                        first_name      = EXCLUDED.first_name,
                        last_name       = EXCLUDED.last_name,
                        phone_number    = EXCLUDED.phone_number,
                        account_type    = EXCLUDED.account_type,
                        role            = EXCLUDED.role,
                        company_id      = EXCLUDED.company_id,
                        valid_access    = EXCLUDED.valid_access,
                        email_validated = EXCLUDED.email_validated,
                        last_login      = EXCLUDED.last_login,
                        updated_at      = NOW()
                """), row)

                inserted += 1

            except Exception as e:
                logger.error("Error migrating uid=%s email=%s: %s", uid, email, e)
                errors += 1

        if not dry_run:
            conn.commit()

    mode = "DRY RUN" if dry_run else "LIVE"
    action = "would upsert" if dry_run else "upserted"
    logger.info(
        "[%s] Migration complete: total=%d %s=%d skipped=%d errors=%d",
        mode, total, action, inserted, skipped, errors,
    )


def main():
    parser = argparse.ArgumentParser(description="Migrate users from Datastore to PostgreSQL")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing to DB")
    args = parser.parse_args()

    if args.dry_run:
        logger.info("=== DRY RUN — no changes will be written to PostgreSQL ===")

    run(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
