"""SQLite storage.

One table of day entries with a JSON payload keeps the schema stable while the
field catalogue evolves. Everything is local: `pulse` never phones home.
"""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS day_entries (
    day        TEXT PRIMARY KEY,
    payload    TEXT NOT NULL,
    source     TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@contextmanager
def connection(path: Path | None = None) -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(path or config.db_path())
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db(path: Path | None = None) -> None:
    with connection(path) as conn:
        conn.executescript(SCHEMA)
        conn.execute(
            "INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '1')"
        )


def row_to_entry(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "day": row["day"],
        "values": json.loads(row["payload"]),
        "source": row["source"],
        "updated_at": row["updated_at"],
    }
