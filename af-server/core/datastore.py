"""
core/datastore.py

Google Cloud Datastore client — singleton per process.

Replaces: model/init_model.py  initialise_datastore()

The client is initialised once on first use and reused for the lifetime
of the Cloud Run container instance. FastAPI's async model means we do
not initialise per-request as V1 Flask did.

Locally: set GOOGLE_APPLICATION_CREDENTIALS to the service account JSON path.
On Cloud Run: uses the service account attached to the Cloud Run service
              (Application Default Credentials).
"""

import os
from datetime import datetime
from functools import lru_cache

from google.cloud import datastore

from core.constants import PROJECT_ID


@lru_cache(maxsize=1)
def get_client() -> datastore.Client:
    """
    Return the shared Datastore client.

    lru_cache ensures this is called only once — equivalent to a module-level
    singleton but lazy (initialised on first request, not at import time).
    """
    return datastore.Client(project=PROJECT_ID)


# ---------------------------------------------------------------------------
# Helpers  —  thin wrappers that handle the patterns used throughout V1
# ---------------------------------------------------------------------------

def entity_to_dict(entity) -> dict:
    """
    Convert a Datastore entity to a plain dict, preserving the key id/name.

    V1 did this inline everywhere with dict(entity). This version also
    attaches the entity key as 'id' so callers don't need to inspect the key.
    """
    if entity is None:
        return {}
    d = dict(entity)
    key = entity.key
    d["id"] = key.name or key.id
    return d


def parse_timestamp(value) -> datetime | None:
    """
    Parse timestamp strings in any format stored in Datastore.

    V1 format: '2024-03-15 10:22:05' (no timezone, no microseconds)
    V2 format: '2026-02-27T05:02:31.499440+00:00' (ISO 8601 with tz)
    Datastore native: datetime object (returned directly)
    """
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        pass
    try:
        return datetime.strptime(str(value), '%Y-%m-%d %H:%M:%S')
    except ValueError:
        pass
    try:
        return datetime.strptime(str(value), '%Y-%m-%d %H:%M:%S.%f')
    except ValueError:
        pass
    return None


def get_multi_chunked(client, keys: list, chunk_size: int = 500) -> list:
    """
    Fetch Datastore entities in chunks to avoid the 1000-key hard limit.
    Returns a flat list of entities (None values for missing keys are excluded).
    """
    results = []
    for i in range(0, len(keys), chunk_size):
        chunk = keys[i:i + chunk_size]
        entities = client.get_multi(chunk)
        results.extend([e for e in entities if e is not None])
    return results


def make_key(kind: str, identifier: str | int):
    """Shortcut for client.key(kind, identifier)."""
    return get_client().key(kind, identifier)


def get_entity(kind: str, identifier: str | int) -> dict | None:
    """Fetch a single entity by kind + id/name. Returns dict or None."""
    client = get_client()
    entity = client.get(client.key(kind, identifier))
    if entity is None:
        return None
    return entity_to_dict(entity)


def run_query(
    kind: str,
    filters: list[tuple] | None = None,
    order: list[str] | None = None,
    limit: int | None = None,
    projection: list[str] | None = None,
    cursor: str | None = None,
) -> tuple[list[dict], str | None]:
    """
    Run a Datastore query and return (results, next_cursor).

    filters:    list of (property, operator, value) tuples
                e.g. [("trash", "=", False), ("status", ">=", 2001)]
    order:      list of property names; prefix with "-" for descending
    limit:      max results per page
    projection: list of property names to fetch (keys-only style)
    cursor:     urlsafe cursor string for pagination

    Returns:
        results     — list of plain dicts (entity_to_dict applied)
        next_cursor — urlsafe string or None if no more pages
    """
    client = get_client()
    query = client.query(kind=kind)

    if projection:
        query.projection = projection

    if filters:
        for prop, op, val in filters:
            query.add_filter(prop, op, val)

    if order:
        query.order = order

    next_cursor = None

    if limit is not None:
        start = bytes(cursor, "utf-8") if cursor else None
        query_iter = query.fetch(limit=limit, start_cursor=start)
        page = next(query_iter.pages)
        rows = list(page)
        token = query_iter.next_page_token
        next_cursor = token.decode("utf-8") if token else None
    else:
        rows = list(query.fetch())

    return [entity_to_dict(r) for r in rows], next_cursor
