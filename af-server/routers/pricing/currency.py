"""
routers/pricing/currency.py — Currency exchange rate management endpoints.

Rate storage convention:
  currency_rates.rate stores the POST-ADJUSTMENT rate.
  The adjustment_pct from currency_rate_pairs is applied AT WRITE TIME only
  (scraper: final_rate = normalised * (1 + adj_pct / 100)).
  The pairs-with-series endpoint returns raw_rate = stored value, and
  effective_rate = stored value (same thing — adjustment already baked in).
  The adj_pct badge on the UI is informational only.
"""

import logging
import re
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text

from core.auth import Claims, require_afu, require_afu_admin
from core.db import get_db

try:
    import httpx
    from bs4 import BeautifulSoup
    _SCRAPER_AVAILABLE = True
except ImportError:
    _SCRAPER_AVAILABLE = False

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class CurrencyRateCreate(BaseModel):
    rate: float
    week_of: date
    notes: Optional[str] = None


class CurrencyPairCreate(BaseModel):
    base_currency: str
    target_currency: str


class CurrencyPairUpdate(BaseModel):
    adjustment_pct: Optional[float] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _monday_of_week(d: date) -> date:
    """Return the Monday of the ISO week containing d."""
    return d - timedelta(days=d.weekday())


_CURRENCY_RE = re.compile(r'^[A-Z]{3}$')


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/pairs")
async def list_currency_pairs(
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    rows = conn.execute(text("""
        SELECT
            cr.base_currency,
            cr.target_currency,
            COALESCE(crp.adjustment_pct, 0)     AS adjustment_pct,
            COALESCE(crp.is_active, true)        AS is_active,
            crp.id                               AS pair_id,
            lr.rate                              AS current_rate,
            lr.effective_from                    AS current_effective_from
        FROM (
            SELECT DISTINCT base_currency, target_currency
            FROM currency_rates
        ) cr
        LEFT JOIN currency_rate_pairs crp
            ON crp.base_currency = cr.base_currency
           AND crp.target_currency = cr.target_currency
        LEFT JOIN LATERAL (
            SELECT rate, effective_from
            FROM currency_rates r
            WHERE r.base_currency = cr.base_currency
              AND r.target_currency = cr.target_currency
              AND r.effective_from <= CURRENT_DATE
            ORDER BY r.effective_from DESC
            LIMIT 1
        ) lr ON true
        ORDER BY cr.base_currency, cr.target_currency
    """)).fetchall()

    data = [
        {
            "base_currency": r[0],
            "target_currency": r[1],
            "adjustment_pct": float(r[2]),
            "is_active": bool(r[3]),
            "pair_id": r[4],
            "current_rate": float(r[5]) if r[5] is not None else None,
            "current_effective_from": str(r[6]) if r[6] is not None else None,
        }
        for r in rows
    ]
    return {"status": "OK", "data": data}


@router.post("/pairs")
async def create_currency_pair(
    body: CurrencyPairCreate,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    base = body.base_currency.strip().upper()
    target = body.target_currency.strip().upper()

    if not _CURRENCY_RE.match(base):
        raise HTTPException(status_code=400, detail=f"Invalid base currency: {base}")
    if not _CURRENCY_RE.match(target):
        raise HTTPException(status_code=400, detail=f"Invalid target currency: {target}")
    if base == target:
        raise HTTPException(status_code=400, detail="Base and target currency must be different")

    existing = conn.execute(text("""
        SELECT 1 FROM currency_rates
        WHERE base_currency = :base AND target_currency = :target
        LIMIT 1
    """), {"base": base, "target": target}).fetchone()
    if existing:
        raise HTTPException(status_code=409, detail=f"Pair {base}/{target} already exists")

    monday = _monday_of_week(date.today())
    row = conn.execute(text("""
        INSERT INTO currency_rates (base_currency, target_currency, rate, effective_from, notes)
        VALUES (:base, :target, 1.0, :eff, 'Initial rate — please update')
        RETURNING id
    """), {"base": base, "target": target, "eff": monday}).fetchone()

    pair_row = conn.execute(text("""
        INSERT INTO currency_rate_pairs (base_currency, target_currency)
        VALUES (:base, :target)
        ON CONFLICT (base_currency, target_currency) DO NOTHING
        RETURNING id
    """), {"base": base, "target": target}).fetchone()

    pair_id = pair_row[0] if pair_row else None

    return {"status": "OK", "data": {
        "base_currency": base, "target_currency": target,
        "id": row[0], "pair_id": pair_id,
    }}


@router.patch("/pairs/{pair_id}")
async def update_currency_pair(
    pair_id: int,
    body: CurrencyPairUpdate,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    existing = conn.execute(text(
        "SELECT id FROM currency_rate_pairs WHERE id = :id"
    ), {"id": pair_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail=f"Currency pair {pair_id} not found")

    updates = []
    params: dict = {"id": pair_id}

    if body.adjustment_pct is not None:
        updates.append("adjustment_pct = :adj")
        params["adj"] = body.adjustment_pct
    if body.is_active is not None:
        updates.append("is_active = :active")
        params["active"] = body.is_active
    if body.notes is not None:
        updates.append("notes = :notes")
        params["notes"] = body.notes

    if not updates:
        return {"status": "OK", "msg": "No changes"}

    updates.append("updated_at = NOW()")
    conn.execute(text(
        f"UPDATE currency_rate_pairs SET {', '.join(updates)} WHERE id = :id"
    ), params)

    return {"status": "OK", "msg": "Pair updated"}


@router.get("/pairs-with-series")
async def list_currency_pairs_with_series(
    weeks: int = Query(default=8, ge=1, le=52),
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    today = date.today()
    today_monday = _monday_of_week(today)
    mondays = [today_monday - timedelta(weeks=i) for i in range(weeks, -1, -1)]
    max_monday = today_monday

    # 1. Fetch all pairs
    pair_rows = conn.execute(text("""
        SELECT
            cr.base_currency,
            cr.target_currency,
            COALESCE(crp.adjustment_pct, 0)     AS adjustment_pct,
            COALESCE(crp.is_active, true)        AS is_active,
            crp.id                               AS pair_id,
            lr.rate                              AS current_rate,
            lr.effective_from                    AS current_effective_from
        FROM (
            SELECT DISTINCT base_currency, target_currency
            FROM currency_rates
        ) cr
        LEFT JOIN currency_rate_pairs crp
            ON crp.base_currency = cr.base_currency
           AND crp.target_currency = cr.target_currency
        LEFT JOIN LATERAL (
            SELECT rate, effective_from
            FROM currency_rates r
            WHERE r.base_currency = cr.base_currency
              AND r.target_currency = cr.target_currency
              AND r.effective_from <= CURRENT_DATE
            ORDER BY r.effective_from DESC
            LIMIT 1
        ) lr ON true
        ORDER BY cr.base_currency, cr.target_currency
    """)).fetchall()

    # 2. Fetch all rate rows up to max_monday for carry-forward
    rate_rows = conn.execute(text("""
        SELECT id, base_currency, target_currency, rate, effective_from
        FROM currency_rates
        WHERE effective_from <= :max_monday
        ORDER BY base_currency, target_currency, effective_from DESC
    """), {"max_monday": max_monday}).fetchall()

    # Group rates by (base, target) — already sorted DESC by effective_from
    from collections import defaultdict
    rates_by_pair: dict[tuple[str, str], list] = defaultdict(list)
    for r in rate_rows:
        rates_by_pair[(r[1], r[2])].append({
            "id": r[0], "rate": float(r[3]), "effective_from": r[4],
        })

    # 3. Build response
    # NOTE: stored rate is post-adjustment — effective_rate == raw_rate (no re-application).
    # adjustment_pct is returned for display (badge) only.
    data = []
    for pr in pair_rows:
        base_c, target_c = pr[0], pr[1]
        adj_pct = float(pr[2])
        pair_rates = rates_by_pair.get((base_c, target_c), [])

        time_series = []
        for monday in mondays:
            active_rate = None
            for rr in pair_rates:
                if rr["effective_from"] <= monday:
                    active_rate = rr
                    break

            iso_cal = monday.isocalendar()
            week_key = f"{iso_cal[0]}-W{iso_cal[1]:02d}"

            if active_rate:
                stored = active_rate["rate"]
                time_series.append({
                    "week_key": week_key,
                    "week_monday": str(monday),
                    "raw_rate": stored,
                    "effective_rate": stored,  # adjustment already baked into stored value
                    "rate_id": active_rate["id"],
                })
            else:
                time_series.append({
                    "week_key": week_key,
                    "week_monday": str(monday),
                    "raw_rate": None,
                    "effective_rate": None,
                    "rate_id": None,
                })

        data.append({
            "base_currency": base_c,
            "target_currency": target_c,
            "adjustment_pct": adj_pct,
            "is_active": bool(pr[3]),
            "pair_id": pr[4],
            "current_rate": float(pr[5]) if pr[5] is not None else None,
            "current_effective_from": str(pr[6]) if pr[6] is not None else None,
            "time_series": time_series,
        })

    return {"status": "OK", "data": data}


@router.get("/{base}/{target}/rates")
async def list_currency_rates(
    base: str,
    target: str,
    claims: Claims = Depends(require_afu),
    conn=Depends(get_db),
):
    base = base.upper()
    target = target.upper()

    rows = conn.execute(text("""
        SELECT id, base_currency, target_currency, rate, effective_from, notes, created_at, updated_at
        FROM currency_rates
        WHERE base_currency = :base AND target_currency = :target
        ORDER BY effective_from DESC
    """), {"base": base, "target": target}).fetchall()

    data = [
        {
            "id": r[0],
            "base_currency": r[1],
            "target_currency": r[2],
            "rate": float(r[3]),
            "effective_from": str(r[4]),
            "notes": r[5],
            "created_at": str(r[6]) if r[6] else None,
            "updated_at": str(r[7]) if r[7] else None,
        }
        for r in rows
    ]
    return {"status": "OK", "data": data}


@router.post("/{base}/{target}/rates")
async def upsert_currency_rate(
    base: str,
    target: str,
    body: CurrencyRateCreate,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    base = base.upper()
    target = target.upper()

    if body.rate <= 0:
        raise HTTPException(status_code=400, detail="Rate must be greater than 0")

    monday = _monday_of_week(body.week_of)

    row = conn.execute(text("""
        INSERT INTO currency_rates (base_currency, target_currency, rate, effective_from, notes)
        VALUES (:base, :target, :rate, :eff, :notes)
        ON CONFLICT (base_currency, target_currency, effective_from)
        DO UPDATE SET rate = EXCLUDED.rate, notes = EXCLUDED.notes, updated_at = NOW()
        RETURNING id, effective_from
    """), {
        "base": base,
        "target": target,
        "rate": body.rate,
        "eff": monday,
        "notes": body.notes,
    }).fetchone()

    return {"status": "OK", "data": {"id": row[0], "effective_from": str(row[1])}}


@router.delete("/rates/{rate_id}")
async def delete_currency_rate(
    rate_id: int,
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    row = conn.execute(text("""
        SELECT id, base_currency, target_currency FROM currency_rates WHERE id = :id
    """), {"id": rate_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail=f"Rate {rate_id} not found")

    count = conn.execute(text("""
        SELECT COUNT(*) FROM currency_rates
        WHERE base_currency = :base AND target_currency = :target
    """), {"base": row[1], "target": row[2]}).fetchone()

    if count and count[0] <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last rate for a currency pair")

    conn.execute(text("DELETE FROM currency_rates WHERE id = :id"), {"id": rate_id})

    return {"status": "OK", "msg": "Rate deleted"}


# ---------------------------------------------------------------------------
# RHB FX Scraper
# ---------------------------------------------------------------------------

@router.post("/fetch-rhb")
async def fetch_rhb_rates(
    claims: Claims = Depends(require_afu_admin),
    conn=Depends(get_db),
):
    if not _SCRAPER_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Scraper dependencies not available (httpx, beautifulsoup4). Install them in the server environment.",
        )

    # Step 1 — Fetch page
    url = "https://www.rhbgroup.com/treasury-rates/foreign-exchange/index.html"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch RHB page: {e}")

    # Step 2 — Parse table
    soup = BeautifulSoup(resp.text, "html.parser")

    # Extract timestamp
    rhb_timestamp = ""
    for el in soup.find_all(string=re.compile(r"UPDATED AT", re.IGNORECASE)):
        text_str = el.strip()
        match = re.search(r"UPDATED AT\s+(.+)", text_str, re.IGNORECASE)
        if match:
            rhb_timestamp = match.group(1).strip()
            break

    # Find the FX table
    table = None
    for t in soup.find_all("table"):
        headers = [th.get_text(strip=True).upper() for th in t.find_all("th")]
        if any("BANK SELL" in h for h in headers):
            table = t
            break

    if not table:
        raise HTTPException(status_code=502, detail="Could not find FX rate table on RHB page")

    # Parse rows
    def _parse_rate_cell(cell_text: str) -> float | None:
        val = cell_text.strip().replace(",", "")
        if not val or val == "-":
            return None
        try:
            return float(val)
        except ValueError:
            return None

    rhb_rows: list[dict] = []
    for tr in table.find_all("tr")[1:]:  # skip header row
        cells = tr.find_all("td")
        if len(cells) < 6:
            continue

        code = cells[0].get_text(strip=True).upper()
        if not code or len(code) != 3:
            continue

        try:
            unit = int(cells[2].get_text(strip=True) or "1")
        except ValueError:
            unit = 1

        rhb_rows.append({
            "code": code,
            "unit": unit,
            "sell_tt_od": _parse_rate_cell(cells[3].get_text(strip=True)),
            "buy_tt": _parse_rate_cell(cells[4].get_text(strip=True)),
            "buy_od": _parse_rate_cell(cells[5].get_text(strip=True)),
        })

    rhb_by_code = {r["code"]: r for r in rhb_rows}

    # Step 3 — Load existing active pairs
    pair_rows = conn.execute(text("""
        SELECT base_currency, target_currency, adjustment_pct, is_active
        FROM currency_rate_pairs
        WHERE is_active = true
    """)).fetchall()

    monday = _monday_of_week(date.today())
    updated_count = 0
    skipped_count = 0
    skipped_pairs: list[str] = []

    for pr in pair_rows:
        base_c, target_c, adj_pct, _ = pr[0], pr[1], float(pr[2]), pr[3]

        # Determine which RHB code and rate column to use
        if target_c == "MYR":
            # RHB quotes foreign/MYR directly — use Bank Sell TT/OD
            # e.g. USD sell = 4.0790 → stored as 4.0790 * (1 + adj/100)
            rhb_code = base_c
            rate_column = "sell_tt_od"
        elif base_c == "MYR":
            # RHB quotes foreign/MYR — invert to get MYR/foreign
            # e.g. USD buy OD = 3.6840 → 1/3.6840 = 0.2715 → stored as 0.2715 * (1 + adj/100)
            rhb_code = target_c
            rate_column = "buy_od"
        else:
            # Neither base nor target is MYR — skip
            skipped_count += 1
            skipped_pairs.append(f"{base_c}_{target_c}")
            continue

        rhb_entry = rhb_by_code.get(rhb_code)
        if not rhb_entry:
            skipped_count += 1
            skipped_pairs.append(f"{base_c}_{target_c}")
            continue

        raw_rate = rhb_entry.get(rate_column)
        if raw_rate is None:
            skipped_count += 1
            skipped_pairs.append(f"{base_c}_{target_c}")
            continue

        # Normalise per-unit (e.g. JPY quoted per 100 → divide by 100)
        normalised = raw_rate / rhb_entry["unit"]

        # Invert for MYR-origin pairs, then apply adjustment
        if base_c == "MYR":
            final_rate = round((1.0 / normalised) * (1 + adj_pct / 100), 6)
        else:
            final_rate = round(normalised * (1 + adj_pct / 100), 6)

        notes = f"RHB scrape {date.today().isoformat()} — {rhb_timestamp}"

        conn.execute(text("""
            INSERT INTO currency_rates
                (base_currency, target_currency, rate, effective_from, notes)
            VALUES (:base, :target, :rate, :monday, :notes)
            ON CONFLICT (base_currency, target_currency, effective_from)
            DO UPDATE SET rate = EXCLUDED.rate, notes = EXCLUDED.notes, updated_at = NOW()
        """), {
            "base": base_c,
            "target": target_c,
            "rate": final_rate,
            "monday": monday,
            "notes": notes,
        })
        updated_count += 1

    return {"status": "OK", "data": {
        "updated": updated_count,
        "skipped": skipped_count,
        "skipped_pairs": skipped_pairs,
        "rhb_timestamp": rhb_timestamp,
        "effective_from": str(monday),
    }}
