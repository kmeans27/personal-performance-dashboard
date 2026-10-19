"""Reaching Pulse from a phone on the same network."""

import re
from pathlib import Path

from pulse import net

ROOT = Path(__file__).resolve().parents[1]


def test_lan_addresses_never_include_loopback():
    for address in net.lan_addresses():
        assert not address.startswith("127.")
        assert re.fullmatch(r"\d{1,3}(\.\d{1,3}){3}", address)


def test_phone_urls_point_at_the_port():
    for url in net.phone_urls(8765):
        assert url.startswith("http://")
        assert url.endswith(":8765")
        assert "127.0.0.1" not in url


def test_the_frontend_version_matches_the_backend():
    from pulse import config

    chrome = (ROOT / "web" / "js" / "core" / "chrome.js").read_text()
    shown = re.search(r'"(v\d+\.\d+\.\d+)"', chrome)
    assert shown, "the footer version moved or vanished"
    assert shown.group(1) == f"v{config.APP_VERSION}"
