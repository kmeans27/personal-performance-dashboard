"""`uv run pulse` — start the dashboard."""

from __future__ import annotations

import argparse
import threading
import webbrowser

import uvicorn

from . import config


def main() -> None:
    parser = argparse.ArgumentParser(prog="pulse", description="Personal performance dashboard")
    parser.add_argument("--host", default=config.host())
    parser.add_argument("--port", type=int, default=config.port())
    parser.add_argument("--reload", action="store_true", help="auto-reload (development)")
    parser.add_argument("--no-browser", action="store_true", help="do not open a browser")
    args = parser.parse_args()

    url = f"http://{'localhost' if args.host in ('127.0.0.1', '0.0.0.0') else args.host}:{args.port}"
    print(f"\n  {config.APP_NAME} — {config.APP_TAGLINE}")
    print(f"  data: {config.db_path()}")
    print(f"  open: {url}\n")

    if not args.no_browser:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()

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
