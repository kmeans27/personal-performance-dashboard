"""FastAPI application: JSON API plus the static front-end it serves."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import config, db
from .api import analytics as analytics_api
from .api import days as days_api

PAGES = ("log", "calendar", "trends", "insights", "demo", "settings")


def create_app() -> FastAPI:
    db.init_db()
    app = FastAPI(
        title=f"{config.APP_NAME} API",
        version=config.APP_VERSION,
        description="A personal performance dashboard. Self-hosted, local, yours.",
    )
    app.include_router(days_api.router, prefix="/api")
    app.include_router(analytics_api.router, prefix="/api")

    web = config.web_dir()
    if web.exists():
        for page in PAGES:
            app.get(f"/{page}", include_in_schema=False)(_page_route(web, page))
        app.mount("/", StaticFiles(directory=web, html=True), name="web")
    return app


def _page_route(web: Path, page: str):
    def route() -> FileResponse:
        return FileResponse(web / f"{page}.html")

    route.__name__ = f"page_{page}"
    return route
