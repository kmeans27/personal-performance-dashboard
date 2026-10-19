import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(monkeypatch):
    """A server with its own throwaway SQLite file."""
    tmp = tempfile.mkdtemp(prefix="pulse-test-")
    monkeypatch.setenv("PULSE_DB", str(Path(tmp) / "test.db"))
    from pulse.server import create_app

    with TestClient(create_app()) as test_client:
        yield test_client
