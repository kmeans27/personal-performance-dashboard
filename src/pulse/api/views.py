"""Shaping analytics into exactly what the front-end renders."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Sequence

from .. import analytics
from ..insights import insights as build_insights
from ..metrics import CATEGORIES

CLOSING_STRONG = (
    "Rings settled. That is a day worth repeating — the dashboard already knows it."
)
CLOSING_LOGGED = "Logged. Everything above is now part of the picture."


def category_legend(score: analytics.DayScore | None) -> list[dict[str, Any]]:
    values = (score.categories if score else {}) or {}
    return [
        {
            "id": category.id,
            "label": category.label,
            "accent": category.accent,
            "blurb": category.blurb,
            "score": values.get(category.id),
        }
        for category in CATEGORIES
    ]


def build_day_payload(
    entries: Sequence[dict[str, Any]],
    scores: dict[str, analytics.DayScore],
    day: str,
    include_insight: bool = False,
    settings: dict[str, Any] | None = None,
) -> dict[str, Any]:
    score = scores.get(day)
    values = next((e["values"] for e in entries if e["day"] == day), {})
    focus = analytics.focus_line(score) if score else None
    logged_recent = [
        e["day"] for e in entries if e["day"] > (date.fromisoformat(day) - timedelta(days=30)).isoformat()
    ]

    payload: dict[str, Any] = {
        "day": day,
        "logged": score is not None,
        "values": values,
        "score": {
            "total": score.total if score else None,
            "categories": (score.categories if score else {}),
            "metrics": (score.metrics if score else {}),
            "coverage": score.coverage if score else 0.0,
        },
        "legend": category_legend(score),
        "focus": focus,
        "weekly": analytics.weekly_progress(entries, day, settings),
        "consistency": {
            "days_logged_30": len(logged_recent),
            "days_logged_total": len(entries),
        },
        "closing": CLOSING_STRONG if (score and (score.total or 0) >= 0.72) else CLOSING_LOGGED,
    }

    if include_insight:
        top = build_insights(entries)
        payload["insight"] = (
            {"sentence": top[0].sentence, "kind": top[0].kind, "strength": top[0].strength}
            if top
            else None
        )
        payload["insight_count"] = len(top)
    return payload


def build_range_payload(
    entries: Sequence[dict[str, Any]],
    scores: dict[str, analytics.DayScore],
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for entry in sorted(entries, key=lambda e: e["day"]):
        score = scores.get(entry["day"])
        out.append(
            {
                "day": entry["day"],
                "total": score.total if score else None,
                "categories": score.categories if score else {},
                "coverage": score.coverage if score else 0.0,
                "source": entry.get("source", "manual"),
            }
        )
    return out
