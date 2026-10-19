"""Runtime configuration. Everything is overridable through env vars so the
app can be self-hosted from any directory."""

from __future__ import annotations

import os
from pathlib import Path

APP_NAME = "Pulse"
APP_TAGLINE = "One glance. Four rings. One score."
APP_VERSION = "0.1.0"

DEFAULT_PORT = 8765


def project_root() -> Path:
    """Repository root when running from a checkout."""
    return Path(__file__).resolve().parents[2]


def data_dir() -> Path:
    path = Path(os.environ.get("PULSE_DATA_DIR", project_root() / ".data")).expanduser()
    path.mkdir(parents=True, exist_ok=True)
    return path


def db_path() -> Path:
    explicit = os.environ.get("PULSE_DB")
    if explicit:
        path = Path(explicit).expanduser()
        path.parent.mkdir(parents=True, exist_ok=True)
        return path
    return data_dir() / "pulse.db"


def web_dir() -> Path:
    explicit = os.environ.get("PULSE_WEB_DIR")
    if explicit:
        return Path(explicit).expanduser()
    return project_root() / "web"


def port() -> int:
    return int(os.environ.get("PULSE_PORT", DEFAULT_PORT))


def host() -> str:
    return os.environ.get("PULSE_HOST", "127.0.0.1")
