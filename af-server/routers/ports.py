"""
routers/ports.py — Port + terminal lookup endpoints.
"""

import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from core.db import get_db

router = APIRouter()


@router.get("")
def list_ports(db=Depends(get_db)):
    """Return all ports with terminal data."""
    rows = db.execute(text(
        "SELECT p.un_code, p.name, p.country_code, c.name AS country_name, "
        "p.port_type, p.has_terminals, p.terminals, p.lat, p.lng "
        "FROM ports p LEFT JOIN countries c ON c.country_code = p.country_code "
        "ORDER BY p.name"
    )).fetchall()
    return [
        {
            "un_code": r.un_code,
            "name": r.name,
            "country_code": r.country_code,
            "country_name": r.country_name,
            "port_type": r.port_type,
            "has_terminals": r.has_terminals,
            "terminals": r.terminals if isinstance(r.terminals, list) else json.loads(r.terminals or "[]"),
            "lat": r.lat,
            "lng": r.lng,
        }
        for r in rows
    ]


@router.get("/{un_code}")
def get_port(un_code: str, db=Depends(get_db)):
    """Return a single port by UN code."""
    row = db.execute(
        text("SELECT p.un_code, p.name, p.country_code, c.name AS country_name, "
             "p.port_type, p.has_terminals, p.terminals, p.lat, p.lng "
             "FROM ports p LEFT JOIN countries c ON c.country_code = p.country_code "
             "WHERE p.un_code = :code"),
        {"code": un_code.upper()},
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail=f"Port {un_code} not found")
    return {
        "un_code": row.un_code,
        "name": row.name,
        "country_code": row.country_code,
        "country_name": row.country_name,
        "port_type": row.port_type,
        "has_terminals": row.has_terminals,
        "terminals": row.terminals if isinstance(row.terminals, list) else json.loads(row.terminals or "[]"),
        "lat": row.lat,
        "lng": row.lng,
    }
