"""API: summaries, ranges, trends, insights and the demo dataset."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from .. import analytics, repository
from ..demo import DEMO_DAYS, generate_days
from ..insights import insights as build_insights
from .views import build_day_payload, build_range_payload

router = APIRouter(tags=["analytics"])

_DEMO_CACHE: dict[str, list[dict[str, Any]]] = {}


def today_str() -> str:
    return date.today().isoformat()


def _load(start: str, end: str) -> tuple[list[dict[str, Any]], dict[str, analytics.DayScore]]:
    """Load the requested range plus a warm-up window, so weekly fields,
    rhythm scoring and insights always have their history."""
    warmup = (date.fromisoformat(start) - timedelta(days=analytics.WARMUP_DAYS)).isoformat()
    loaded = repository.get_days(warmup, end)
    scores = analytics.build_day_scores(loaded)
    return loaded, scores


def demo_entries() -> list[dict[str, Any]]:
    if "days" not in _DEMO_CACHE:
        _DEMO_CACHE["days"] = generate_days(DEMO_DAYS)
    return _DEMO_CACHE["days"]


def _demo_scored() -> tuple[list[dict[str, Any]], dict[str, analytics.DayScore]]:
    entries = demo_entries()
    return entries, analytics.build_day_scores(entries)


def _range_request(start: str | None, end: str | None, days: int) -> tuple[str, str]:
    end = end or today_str()
    start = start or (date.fromisoformat(end) - timedelta(days=days - 1)).isoformat()
    if start > end:
        raise HTTPException(status_code=422, detail="start must be before end")
    return start, end


@router.get("/today")
def today() -> dict:
    day = today_str()
    entries, scores = _load(day, day)
    return build_day_payload(entries, scores, day, include_insight=True, settings=repository.get_settings())


@router.get("/range")
def range_endpoint(
    start: str | None = None,
    end: str | None = None,
    days: int = Query(90, ge=1, le=730),
) -> dict:
    start, end = _range_request(start, end, days)
    entries, scores = _load(start, end)
    in_range = [e for e in entries if start <= e["day"] <= end]
    return {"start": start, "end": end, "days": build_range_payload(in_range, scores)}


@router.get("/trends")
def trends(days: int = Query(30, ge=7, le=180)) -> dict:
    end = today_str()
    start = (date.fromisoformat(end) - timedelta(days=2 * days)).isoformat()
    entries, scores = _load(start, end)
    rows = analytics.trends(entries, scores, days=days)
    return {"window": days, "trends": [t.__dict__ for t in rows]}


@router.get("/insights")
def insights(days: int = Query(90, ge=21, le=730)) -> dict:
    end = today_str()
    start = (date.fromisoformat(end) - timedelta(days=days - 1)).isoformat()
    entries, _ = _load(start, end)
    rows = build_insights(entries, window_days=days)
    return {
        "window": days,
        "ready": len(entries) >= 24,
        "days_logged": len(entries),
        "insights": [i.__dict__ for i in rows],
        "disclaimer": "Correlations in your own data, not causes.",
    }


# ------------------------------------------------------------------- demo


@router.get("/demo/summary")
def demo_summary() -> dict:
    entries, scores = _demo_scored()
    day = entries[-1]["day"]
    payload = build_day_payload(entries, scores, day, include_insight=True)
    payload["demo"] = True
    payload["story"] = {
        "days": len(entries),
        "rough_week": "one rough week, framed as room to grow",
        "streak": "a three-week good streak",
        "trend": "a slow drift upwards",
    }
    return payload


@router.get("/demo/range")
def demo_range(days: int = Query(DEMO_DAYS, ge=1, le=DEMO_DAYS)) -> dict:
    entries, scores = _demo_scored()
    recent = entries[-days:]
    start, end = recent[0]["day"], recent[-1]["day"]
    scoped = [e for e in entries if start <= e["day"] <= end]
    return {"start": start, "end": end, "days": build_range_payload(scoped, scores)}


@router.get("/demo/trends")
def demo_trends(days: int = Query(30, ge=7, le=90)) -> dict:
    entries, scores = _demo_scored()
    rows = analytics.trends(entries, scores, days=days)
    return {"window": days, "trends": [t.__dict__ for t in rows]}


@router.get("/demo/insights")
def demo_insights(days: int = Query(90, ge=21, le=DEMO_DAYS)) -> dict:
    entries, _ = _demo_scored()
    rows = build_insights(entries, window_days=days)
    return {
        "window": days,
        "ready": True,
        "days_logged": len(entries),
        "insights": [i.__dict__ for i in rows],
        "disclaimer": "Correlations in this demo data, not causes.",
    }


@router.get("/demo/day/{day}")
def demo_day(day: str) -> dict:
    entries, scores = _demo_scored()
    if day not in scores:
        raise HTTPException(status_code=404, detail="no demo data for that day")
    payload = build_day_payload(entries, scores, day)
    payload["demo"] = True
    payload["insight"] = None
    return payload
