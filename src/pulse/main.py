"""`uv run pulse` — start the dashboard."""

from __future__ import annotations

import argparse
import threading
import webbrowser

import uvicorn

from . import config, net


def main() -> None:
    parser = argparse.ArgumentParser(prog="pulse", description="Personal performance dashboard")
    parser.add_argument("--host", default=config.host())
    parser.add_argument("--port", type=int, default=config.port())
    parser.add_argument("--reload", action="store_true", help="auto-reload (development)")
    parser.add_argument("--no-browser", action="store_true", help="do not open a browser")
    args = parser.parse_args()

    local = f"http://localhost:{args.port}"
    print(f"\n  {config.APP_NAME} — {config.APP_TAGLINE}")
    print(f"  data:  {config.db_path()}")
    print(f"  open:  {local}")
    if args.host in ("0.0.0.0", "::"):
        for url in net.phone_urls(args.port):
            print(f"  phone: {url}   ← same Wi-Fi, nothing to install")
        if not net.lan_addresses():
            print("  phone: no local network address found — only this machine for now")
    elif args.host not in ("127.0.0.1", "localhost", "::1"):
        print(f"  open:  http://{args.host}:{args.port}")
    print(flush=True)

    if not args.no_browser:
        threading.Timer(0.8, lambda: webbrowser.open(local)).start()

    uvicorn.run(
        "pulse.server:create_app",
        factory=True,
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="info",
    )


if __name__ == "__main__":  # pragma: no cover
    main()
