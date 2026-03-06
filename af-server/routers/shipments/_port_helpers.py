"""
routers/shipments/_port_helpers.py — Port and company matching helpers.
"""

import logging

from sqlalchemy import text

logger = logging.getLogger(__name__)


_PORT_ALIASES: dict[str, str] = {
    "PORT KELANG":     "MYPKG",
    "KELANG":          "MYPKG",
    "PORT KLANG":      "MYPKG",
    "KLANG":           "MYPKG",
    "TANJUNG PELEPAS": "MYTPP",
    "PTP":             "MYTPP",
    "TANJUNG PRIOK":   "IDJKT",
    "PRIOK":           "IDJKT",
    "JAKARTA":         "IDJKT",
    "LAEM CHABANG":    "THLCH",
    "HAIPHONG":        "VNHPH",
    "HO CHI MINH":     "VNSGN",
    "SAIGON":          "VNSGN",
    "VUNG TAU":        "VNVUT",
    "SHANGHAI":        "CNSHA",
    "NINGBO":          "CNNGB",
    "SHENZHEN":        "CNSZX",
    "YANTIAN":         "CNYTN",
    "GUANGZHOU":       "CNGZU",
    "NANSHA":          "CNNSA",
    "BUSAN":           "KRPUS",
    "PUSAN":           "KRPUS",
    "HAMBURG":         "DEHAM",
    "BREMERHAVEN":     "DEBRV",
    "ROTTERDAM":       "NLRTM",
    "ANTWERP":         "BEANR",
    "FELIXSTOWE":      "GBFXT",
    "SINGAPORE":       "SGSIN",
    "HONG KONG":       "HKHKG",
    "DUBAI":           "AEDXB",
    "JEBEL ALI":       "AEJEA",
    "CHITTAGONG":       "BDCGP",
    "CHATTOGRAM":       "BDCGP",
    "COLOMBO":         "LKCMB",
    "CHENNAI":         "INMAA",
    "MUNDRA":          "INMUN",
    "NHAVA SHEVA":     "INNSA",
    "JAWAHARLAL NEHRU":"INNSA",
    "SYDNEY":          "AUSYD",
    "MELBOURNE":       "AUMEL",
    "LOS ANGELES":     "USLAX",
    "LONG BEACH":      "USLGB",
    "NEW YORK":        "USNYC",
    "SAVANNAH":        "USSAV",
    "PIRAEUS":         "GRPIR",
}


def _match_port_un_code(conn, port_text: str) -> str | None:
    """Match free-text port name to a ports table UN code."""
    if not port_text:
        return None
    port_text_upper = port_text.upper().strip()
    # Check alias dictionary first — exact match
    if port_text_upper in _PORT_ALIASES:
        return _PORT_ALIASES[port_text_upper]
    # Try stripping country suffix (e.g. "CHITTAGONG, BANGLADESH" → "CHITTAGONG")
    if "," in port_text_upper:
        city_part = port_text_upper.split(",")[0].strip()
        if city_part in _PORT_ALIASES:
            return _PORT_ALIASES[city_part]

    # Quick check: if it looks like a UN code already (5 uppercase letters)
    if len(port_text_upper) == 5 and port_text_upper.isalpha():
        row = conn.execute(text("""
            SELECT id FROM geography WHERE id = :code
        """), {"code": port_text_upper}).fetchone()
        if row:
            logger.debug("[port_match] Direct UN code hit: %s", port_text_upper)
            return port_text_upper

    # Search ports table for matching name
    rows = conn.execute(text("""
        SELECT un_code, name FROM ports
        WHERE UPPER(name) = :exact
        LIMIT 1
    """), {"exact": port_text_upper}).fetchall()

    if rows:
        logger.debug("[port_match] Exact name match: %s -> %s", port_text_upper, rows[0][0])
        return rows[0][0]

    # Contains match
    row = conn.execute(text("""
        SELECT un_code, name FROM ports
        WHERE UPPER(name) LIKE :pattern OR :search LIKE '%' || UPPER(name) || '%'
        LIMIT 1
    """), {"pattern": f"%{port_text_upper}%", "search": port_text_upper}).fetchone()

    if row:
        logger.debug("[port_match] Contains match: '%s' ~ '%s' -> %s", port_text_upper, row[1], row[0])
        return row[0]

    logger.debug("[port_match] No match for '%s'", port_text_upper)
    return None


def _match_company(conn, consignee_name: str) -> list[dict]:
    """Match consignee name against companies table. Returns top 3 matches."""
    if not consignee_name:
        return []
    name_lower = consignee_name.lower().strip()
    logger.debug("[company_match] Looking for: '%s'", name_lower)

    import re as _re

    def _normalise(s: str) -> str:
        """Strip punctuation, collapse spaces for fuzzy comparison."""
        s = s.lower()
        s = _re.sub(r'[^a-z0-9\s]', ' ', s)  # remove punctuation
        s = _re.sub(r'\s+', ' ', s).strip()   # collapse whitespace
        return s

    name_norm = _normalise(name_lower)
    name_words = [w for w in name_norm.split() if len(w) > 2]

    # Fetch companies matching by ILIKE for pre-filtering, then score in Python
    rows = conn.execute(text("""
        SELECT id, name FROM companies
        WHERE trash = FALSE AND name IS NOT NULL AND name != ''
    """)).fetchall()

    matches: list[dict] = []
    for r in rows:
        company_name = r[1]
        company_norm = _normalise(company_name)

        # Score: exact normalised match = 1.0, contains = 0.8, word overlap = 0.5+
        score = 0.0
        if company_norm == name_norm:
            score = 1.0
        elif name_norm in company_norm or company_norm in name_norm:
            score = 0.8
        else:
            # Word overlap on normalised strings
            company_words = set(company_norm.split())
            matched = sum(1 for w in name_words if w in company_words)
            if matched >= 2:
                score = 0.5 + (matched / max(len(name_words), 1)) * 0.3

        if score > 0.3:
            logger.debug("[company_match] Hit: '%s' norm:'%s' (score %.2f)", company_name, company_norm, score)
            matches.append({
                "company_id": r[0],
                "name": company_name,
                "score": round(score, 2),
            })

    matches.sort(key=lambda m: m["score"], reverse=True)
    logger.debug("[company_match] Total matches for '%s': %d", name_lower, len(matches))
    return matches[:3]
