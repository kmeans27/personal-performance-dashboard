"""Shaping analytics into exactly what the front-end renders."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Sequence

from .. import analytics
from .. import metrics as M
from ..insights import insights as build_insights

CATEGORIES = M.CATEGORIES

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


# ------------------------------------------------------------------- board
# The board payload hands the front-end finished tiles: what to draw, what it
# says, and whether the day has an answer for it yet. Formatting lives here so
# there is exactly one place that decides how a value reads.


def _digits(metric: M.Metric) -> int:
    if not metric.step or metric.step >= 1:
        return 0
    return 1 if metric.step < 0.11 else 2


def _number(value: float, digits: int, grouped: bool) -> str:
    text = f"{value:,.{digits}f}" if grouped else f"{value:.{digits}f}"
    if "." in text:  # 7.50 h is a spreadsheet, 7.5 h is a person
        text = text.rstrip("0").rstrip(".")
    return text


def _display(metric: M.Metric, value: Any) -> tuple[str | None, str]:
    """The value as a person reads it, plus its unit, kept apart for layout."""
    if value is None:
        return None, metric.unit
    if metric.input == "toggle":
        return ("Yes" if value else "No"), ""
    if metric.input == "time":
        return str(value), ""
    if metric.input == "scale":
        index = int(value) - 1 if isinstance(value, (int, float)) else -1
        text = metric.labels[index] if 0 <= index < len(metric.labels) else str(value)
        return text, ""
    if metric.input == "counter":
        count = int(round(float(value)))
        return _number(count, 0, False), metric.unit
    number = float(value)
    return _number(number, _digits(metric), metric.unit == "steps"), metric.unit


def _progress(metric: M.Metric, value: Any, score: float | None, cap: float | None) -> float | None:
    if value is None:
        return None
    if metric.input == "toggle":
        return 1.0 if value else 0.0
    if metric.input == "scale":
        span = float((metric.max or 5) - (metric.min or 1)) or 1.0
        return max(0.0, min(1.0, (float(value) - (metric.min or 1)) / span))
    if score is not None:
        return max(0.0, min(1.0, float(score)))
    if cap:
        return max(0.0, min(1.0, float(value) / float(cap)))
    return None


def _tile_payload(
    tile: M.Tile,
    values: dict[str, Any],
    metric_scores: dict[str, float],
    weekly: dict[str, dict[str, Any]],
    settings: dict[str, Any],
) -> dict[str, Any]:
    fields = [M.METRIC_INDEX[f] for f in tile.fields if f in M.METRIC_INDEX]
    primary = fields[0] if fields else None
    card = weekly.get(tile.id) if tile.weekly else None
    answered = any(values.get(f.id) is not None for f in fields)

    display: str | None = None
    unit = tile.unit or (primary.unit if primary else "")
    sub: str | None = None
    progress: float | None = None

    if tile.chart == "clock":
        if answered:
            display = " → ".join(values.get(f.id) or "—" for f in fields)
    elif primary:
        display, _ = _display(primary, values.get(primary.id))
        progress = _progress(primary, values.get(primary.id), metric_scores.get(primary.id), tile.cap)

    tracked = bool(card and card.get("tracked"))
    if card and not tracked:
        display, progress = None, None

    if tile.id == "learned":
        note = values.get("learned_what")
        sub = str(note) if note else None
    elif tile.id == "weight":
        goal = settings.get("weight_goal")
        if goal:
            text = _number(float(goal), 0 if float(goal).is_integer() else 1, False)
            sub = f"Goal {text} kg"

    if card:
        # Weekly fields read as progress toward the week's target, never as a
        # daily zero — so their number is the week's count, not today's.
        if tracked:
            progress = float(card["progress"])
            count = float(card["count"])
            display = _number(count, 0 if count.is_integer() else 1, False)

    empty = not answered and not tracked
    state = "empty" if empty else (
        "done" if (progress or 0) >= 1 or (answered and progress is None) else "open"
    )

    filled = 0
    if tile.chart == "segments" and card and tracked:
        filled = max(0, min(tile.cells, int(round(float(card["count"])))))
    elif tile.chart == "segments" and answered:
        filled = 1

    caption = "Not logged yet" if empty else (card["caption"] if card else tile.target)

    label = tile.label or (primary.label if primary else tile.id)

    if settings.get("avoid_habit_name") and primary and primary.id == "avoid_habit":
        label = settings["avoid_habit_name"]

    return {
        "id": tile.id,
        "label": label,
        "category": tile.category,
        "chart": tile.chart,
        "size": tile.size,
        "fields": list(tile.fields),
        "weekly": tile.weekly,
        "optional": tile.optional,
        "state": state,
        "settled": answered,
        "display": display,
        "unit": unit,
        "sub": sub,
        "progress": round(progress, 4) if progress is not None else None,
        "cells": tile.cells,
        "filled": filled,
        "caption": caption,
    }


def build_board_payload(
    values: dict[str, Any],
    score: analytics.DayScore | None,
    weekly: list[dict[str, Any]],
    settings: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Every field as a finished tile: what to draw, what it says, and whether
    the day has an answer for it yet."""
    settings = settings or {}
    metric_scores = (score.metrics if score else {}) or {}
    cards = {card["id"]: card for card in weekly}
    tiles = [_tile_payload(tile, values, metric_scores, cards, settings) for tile in M.TILES]

    daily = [t for t in tiles if not t["weekly"] and not t["optional"]]
    logged = len([t for t in daily if t["settled"]])
    return {
        "tiles": tiles,
        "daily_total": len(daily),
        "daily_logged": logged,
        "complete": bool(daily) and logged == len(daily),
    }


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
    weekly = analytics.weekly_progress(entries, day, settings)

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
        "weekly": weekly,
        "board": build_board_payload(values, score, weekly, settings),
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
