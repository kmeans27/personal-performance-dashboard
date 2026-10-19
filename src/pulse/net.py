"""Finding the address the phone should use.

Nothing clever: ask the machine for its own IPv4 addresses and pick the ones a
device on the same Wi-Fi could actually reach.
"""

from __future__ import annotations

import socket


def lan_addresses() -> list[str]:
    """Local-network IPv4 addresses, best first. Empty when fully offline."""
    found: set[str] = set()

    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            found.add(str(info[4][0]))
    except (socket.gaierror, OSError):
        pass

    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # No packet is sent: this just asks the routing table which interface
        # would be used to leave the machine, which is the one the phone shares.
        probe.connect(("8.8.8.8", 80))
        found.add(str(probe.getsockname()[0]))
    except OSError:
        pass
    finally:
        probe.close()

    return sorted(address for address in found if not address.startswith("127.") and address.count(".") == 3)


def phone_urls(port: int) -> list[str]:
    return [f"http://{address}:{port}" for address in lan_addresses()]
