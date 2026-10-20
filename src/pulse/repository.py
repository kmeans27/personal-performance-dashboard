"""Data access for day entries and settings."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable

from . import db

DEFAULT_SETTINGS: dict[str, Any] = {
    "avoid_habit_name": "Clean day",
    "gym_target": 2.5,
    "weight_goal": None,
    "week_starts_on": "monday",
    "sources_dismissed": False,
}

# The two sources the dashboard knows how to explain. Imports can carry any
# `source` string; only these two get a row on Today.
SOURCES: tuple[dict[str, str], ...] = (
    {"id": "apple-health", "label": "Apple Health"},
    {"id": "screen-time", "label": "Screen Time"},
)

SOURCE_ALIASES = {
    "applehealth": "apple-health",
    "health": "apple-health",
    "health-connect": "apple-health",
    "healthconnect": "apple-health",
    "screentime": "screen-time",
    "screen": "screen-time",
}


def normalize_source(source: str) -> str:
    """Map "Apple Health", "apple_health" and friends onto one id."""
    key = str(source or "").strip().lower().replace("_", "-").replace(" ", "-")
    key = SOURCE_ALIASES.get(key, key)
    return key


def get_day(day: str) -> dict[str, Any] | None:
    with db.connection() as conn:
        row = conn.execute("SELECT * FROM day_entries WHERE day = ?", (day,)).fetchone()
    return db.row_to_entry(row) if row else None


def get_days(start: str, end: str) -> list[dict[str, Any]]:
    with db.connection() as conn:
        rows = conn.execute(
            "SELECT * FROM day_entries WHERE day BETWEEN ? AND ? ORDER BY day",
            (start, end),
        ).fetchall()
    return [db.row_to_entry(r) for r in rows]


def all_days() -> list[dict[str, Any]]:
    with db.connection() as conn:
        rows = conn.execute("SELECT * FROM day_entries ORDER BY day").fetchall()
    return [db.row_to_entry(r) for r in rows]


def upsert_day(day: str, values: dict[str, Any], source: str = "manual") -> dict[str, Any]:
    """Merge `values` into the day. Passing None deletes a single key's value."""
    existing = get_day(day)
    merged: dict[str, Any] = dict(existing["values"]) if existing else {}
    for key, value in values.items():
        if value is None:
            merged.pop(key, None)
        else:
            merged[key] = value
    stamp = db.now_iso()
    with db.connection() as conn:
        conn.execute(
            """
            INSERT INTO day_entries (day, payload, source, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(day) DO UPDATE SET
                payload = excluded.payload,
                source = excluded.source,
                updated_at = excluded.updated_at
            """,
            (day, json.dumps(merged), source, stamp, stamp),
        )
    return {"day": day, "values": merged, "source": source, "updated_at": stamp}


def delete_day(day: str) -> bool:
    with db.connection() as conn:
        cursor = conn.execute("DELETE FROM day_entries WHERE day = ?", (day,))
    return cursor.rowcount > 0


def import_days(entries: list[dict[str, Any]]) -> int:
    for entry in entries:
        upsert_day(entry["day"], entry.get("values", {}), source=entry.get("source", "import"))
    record_imports(entry.get("source", "import") for entry in entries)
    return len(entries)


# ------------------------------------------------------------------ sources
# Provenance is tracked separately from the day rows: a later manual edit must
# not erase the fact that Apple Health delivered something this morning.


def record_imports(sources: Iterable[str]) -> None:
    stamp = db.now_iso()
    unique = {normalize_source(source) for source in sources if source}
    if not unique:
        return
    with db.connection() as conn:
        for source in unique:
            conn.execute(
                "INSERT INTO imports (source, received_at) VALUES (?, ?) "
                "ON CONFLICT(source) DO UPDATE SET received_at = excluded.received_at",
                (source, stamp),
            )


def source_status(hours: int = 36) -> list[dict[str, Any]]:
    """The known sources, with the last time each one posted and whether that
    was recent enough to count as 'set up and working'."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    stored: dict[str, str] = {}
    with db.connection() as conn:
        for row in conn.execute("SELECT source, received_at FROM imports"):
            stored[row["source"]] = row["received_at"]
    out: list[dict[str, Any]] = []
    for source in SOURCES:
        received = stored.get(source["id"])
        recent = False
        if received:
            try:
                recent = datetime.fromisoformat(received) >= cutoff
            except ValueError:  # pragma: no cover - defensive
                recent = False
        out.append({**source, "received_at": received, "recent": recent})
    return out


# ------------------------------------------------------------------ settings


def get_settings() -> dict[str, Any]:
    stored = dict(DEFAULT_SETTINGS)
    with db.connection() as conn:
        for row in conn.execute("SELECT key, value FROM settings"):
            try:
                stored[row["key"]] = json.loads(row["value"])
            except json.JSONDecodeError:
                stored[row["key"]] = row["value"]
    return stored


def update_settings(patch: dict[str, Any]) -> dict[str, Any]:
    with db.connection() as conn:
        for key, value in patch.items():
            conn.execute(
                "INSERT INTO settings (key, value) VALUES (?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (key, json.dumps(value)),
            )
    return get_settings()


def stats() -> dict[str, Any]:
    with db.connection() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS days, MIN(day) AS first, MAX(day) AS last FROM day_entries"
        ).fetchone()
    return {"days": row["days"], "first_day": row["first"], "last_day": row["last"]}
