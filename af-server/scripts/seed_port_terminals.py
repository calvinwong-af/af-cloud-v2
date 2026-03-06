"""
scripts/seed_port_terminals.py

Seeds the PostgreSQL `ports` table with port + terminal data.
Idempotent — uses INSERT ... ON CONFLICT DO UPDATE.

Run with: python -m scripts.seed_port_terminals
"""

import sys
import json

sys.path.insert(0, ".")

from dotenv import load_dotenv
load_dotenv(".env.local")

from core.db import get_engine
from sqlalchemy import text


PORTS = [
    {
        "un_code": "MYPKG",
        "name": "Port Klang",
        "country": "Malaysia",
        "country_code": "MY",
        "port_type": "SEA",
        "has_terminals": True,
        "terminals": [
            {"terminal_id": "MYPKG_W", "name": "Westports", "is_default": True},
            {"terminal_id": "MYPKG_N", "name": "Northport", "is_default": False},
        ],
    },
    {
        "un_code": "BDCGP",
        "name": "Chattogram (Chittagong)",
        "country": "Bangladesh",
        "country_code": "BD",
        "port_type": "SEA",
        "has_terminals": False,
        "terminals": [],
    },
    {"un_code": "CNSHK", "name": "Shekou", "country": "China", "country_code": "CN", "port_type": "SEA", "has_terminals": False, "terminals": []},
    {"un_code": "CNSHA", "name": "Shanghai", "country": "China", "country_code": "CN", "port_type": "SEA", "has_terminals": False, "terminals": []},
    {"un_code": "CNYTN", "name": "Yantian", "country": "China", "country_code": "CN", "port_type": "SEA", "has_terminals": False, "terminals": []},
    {"un_code": "CNNGB", "name": "Ningbo", "country": "China", "country_code": "CN", "port_type": "SEA", "has_terminals": False, "terminals": []},
    {"un_code": "CNQZH", "name": "Quanzhou", "country": "China", "country_code": "CN", "port_type": "SEA", "has_terminals": False, "terminals": []},
    {"un_code": "CNXMN", "name": "Xiamen", "country": "China", "country_code": "CN", "port_type": "SEA", "has_terminals": False, "terminals": []},
    {"un_code": "CNTAO", "name": "Qingdao", "country": "China", "country_code": "CN", "port_type": "SEA", "has_terminals": False, "terminals": []},
    {"un_code": "SGSIN", "name": "Singapore", "country": "Singapore", "country_code": "SG", "port_type": "SEA", "has_terminals": False, "terminals": []},
    {"un_code": "THBKK", "name": "Bangkok", "country": "Thailand", "country_code": "TH", "port_type": "SEA", "has_terminals": False, "terminals": []},
    {"un_code": "ZADUR", "name": "Durban", "country": "South Africa", "country_code": "ZA", "port_type": "SEA", "has_terminals": False, "terminals": []},
    {"un_code": "ZACPT", "name": "Cape Town", "country": "South Africa", "country_code": "ZA", "port_type": "SEA", "has_terminals": False, "terminals": []},
    {"un_code": "GBFXT", "name": "Felixstowe", "country": "United Kingdom", "country_code": "GB", "port_type": "SEA", "has_terminals": False, "terminals": []},
    {"un_code": "NLRTM", "name": "Rotterdam", "country": "Netherlands", "country_code": "NL", "port_type": "SEA", "has_terminals": False, "terminals": []},
    {"un_code": "AEJEA", "name": "Jebel Ali", "country": "United Arab Emirates", "country_code": "AE", "port_type": "SEA", "has_terminals": False, "terminals": []},
    {"un_code": "USNYC", "name": "New York", "country": "United States", "country_code": "US", "port_type": "SEA", "has_terminals": False, "terminals": []},
    {"un_code": "USLAX", "name": "Los Angeles", "country": "United States", "country_code": "US", "port_type": "SEA", "has_terminals": False, "terminals": []},
]

UPSERT_SQL = text("""
    INSERT INTO ports (un_code, name, country, country_code, port_type, has_terminals, terminals)
    VALUES (:un_code, :name, :country, :country_code, :port_type, :has_terminals, CAST(:terminals AS jsonb))
    ON CONFLICT (un_code) DO UPDATE SET
        name = EXCLUDED.name,
        country = EXCLUDED.country,
        country_code = EXCLUDED.country_code,
        port_type = EXCLUDED.port_type,
        has_terminals = EXCLUDED.has_terminals,
        terminals = EXCLUDED.terminals
""")


def main():
    engine = get_engine()
    count = 0

    with engine.connect() as conn:
        for port in PORTS:
            conn.execute(UPSERT_SQL, {
                "un_code": port["un_code"],
                "name": port["name"],
                "country": port["country"],
                "country_code": port["country_code"],
                "port_type": port["port_type"],
                "has_terminals": port["has_terminals"],
                "terminals": json.dumps(port["terminals"]),
            })
            count += 1
        conn.commit()

    print(f"Done. {count} ports upserted to PostgreSQL.")


if __name__ == "__main__":
    main()
