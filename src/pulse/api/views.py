"""Shaping analytics into exactly what the front-end renders."""

from __future__ import annotations

import math
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


def _agreed(unit: str, value: float | None) -> str:
    """One day, two days: the unit agrees with the number it sits beside."""
    if value is None or not unit.endswith("s") or abs(value) != 1:
        return unit
    return unit[:-1]


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


# What a card aims at, when the field has a plain number to chase. The ring
# scorers hold the same numbers; keeping them here keeps the card honest about
# the target it is drawing.
TILE_TARGETS = {"steps": 9000.0, "outdoor": 20.0, "deep_blocks": 3.0, "sleep": 7.0}

# Each category is a third of the score, so a field's weight is worth
# `weight * 100 / 3` points of the total. That is how a next move is priced.
SCORE_SHARE = 100 / 3


def _tile_weight(tile: M.Tile) -> float:
    """How much of the ring this card is worth, in its category's weights."""
    if tile.id == "rhythm":
        return 0.14
    return round(
        sum(m.weight for m in M.METRICS if m.id in tile.fields and m.scored and m.weight > 0),
        4,
    )


def _tile_score(
    tile: M.Tile,
    metric_scores: dict[str, float],
) -> float | None:
    """The card's own 0..1 score — the same number the ring uses, so a card
    that says 8 is contributing 0.8 of its weight."""
    if tile.id == "rhythm":
        return metric_scores.get("sleep_regular")
    primary = M.METRIC_INDEX.get(tile.fields[0]) if tile.fields else None
    if primary and primary.scored and primary.weight > 0:
        return metric_scores.get(primary.id)
    return None


def _fmt_gap(value: float) -> str:
    return _number(float(value), 0 if float(value).is_integer() else 1, False)


def _minutes(text: Any) -> int | None:
    if not isinstance(text, str) or ":" not in text:
        return None
    try:
        hour, minute = text.split(":")[:2]
        return (int(hour) % 24) * 60 + int(minute)
    except ValueError:
        return None


def _gap_line(
    tile: M.Tile,
    primary: M.Metric | None,
    values: dict[str, Any],
    card: dict[str, Any] | None,
    goal: float | None,
) -> str:
    """One line of plain words: where today sits against where it should land."""
    raw = values.get(primary.id) if primary else None
    number = isinstance(raw, (int, float)) and not isinstance(raw, bool)
    answered = any(value is not None for value in values.values())
    tracked = bool(card and card.get("tracked"))
    if not answered and not tracked:
        return tile.target

    if tile.id == "creatine":
        return "Taken today" if raw else "Not taken yet"

    if tile.id == "sleep" and number:
        value = float(raw)
        if value < 7:
            return f"{_fmt_gap(7 - value)}h short of target"
        if value > 9:
            return f"{_fmt_gap(value - 9)}h past the band"
        return "Inside 7–9 h"

    if tile.id == "steps" and number:
        remaining = 9000 - float(raw)
        if remaining > 0:
            return f"{_number(remaining, 0, True)} to go"
        return f"{_number(-remaining, 0, True)} past the bar"

    if tile.id == "outdoor" and number:
        remaining = 20 - float(raw)
        return f"{_number(remaining, 0, False)} min to go" if remaining > 0 else "20 min outside"

    if tile.id == "screen_hours" and number:
        value = float(raw)
        if value < 3:
            return f"{_fmt_gap(3 - value)}h under your limit"
        if value == 3:
            return "Right at your limit"
        return f"{_fmt_gap(value - 3)}h over your limit"

    if tile.id == "pickups" and number:
        value = float(raw)
        if value < 60:
            return f"{_number(60 - value, 0, False)} under your limit"
        if value == 60:
            return "Right at your limit"
        return f"{_number(value - 60, 0, False)} over your limit"

    if tile.id == "gym" and card:
        left = math.ceil(float(card["target"]) - float(card["count"]) - 0.001)
        if left > 0:
            return f"{left} session{'' if left == 1 else 's'} to go"
        return "Week target met"

    if tile.id == "alcohol" and card:
        count = int(round(float(card["count"])))
        return "Clean week" if count >= 7 else f"{count} of 7 days"

    if tile.id == "avoid_habit" and card:
        return f"{int(round(float(card['count'])))} of 30 days"

    if tile.id == "deep_blocks" and number:
        left = 3 - int(round(float(raw)))
        if left <= 0:
            return "A full day"
        return f"{left} block{'' if left == 1 else 's'} to go"

    if tile.id == "rhythm":
        bed = _minutes(values.get("bed_time"))
        wake = _minutes(values.get("wake_time"))
        if bed is not None and wake is not None:
            minutes = wake - bed
            if minutes <= 0:
                minutes += 1440
            return f"{minutes // 60}h {minutes % 60:02d}m in bed"
        return tile.target

    if tile.id == "weight":
        if goal is None:
            return "No goal set"
        if number:
            delta = float(raw) - goal
            if abs(delta) < 0.05:
                return "At your goal"
            return f"{abs(delta):.1f} kg {'above' if delta > 0 else 'under'} goal"
        return f"Goal {_number(goal, 0 if goal.is_integer() else 1, False)} kg"

    if tile.id == "mood":
        return "How was today overall?"

    if tile.id == "energy":
        return "What was in the tank"

    if primary and primary.input == "toggle":
        return "On target today" if raw else "Not today"

    return tile.target


def _yesterday(values_by_day: dict[str, dict[str, Any]], day: str, field: str) -> Any:
    key = (date.fromisoformat(day) - timedelta(days=1)).isoformat()
    value = (values_by_day.get(key) or {}).get(field)
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def _usual(
    values_by_day: dict[str, dict[str, Any]], day: str, field: str, span: int = 30
) -> float | None:
    """The value this field usually holds — the tick behind a felt 1–5."""
    anchor = date.fromisoformat(day)
    seen = [
        float(value)
        for offset in range(1, span + 1)
        if isinstance(
            (value := (values_by_day.get((anchor - timedelta(days=offset)).isoformat()) or {}).get(field)),
            (int, float),
        )
        and not isinstance(value, bool)
    ]
    return round(sum(seen) / len(seen), 2) if seen else None


def _avoid_days(values_by_day: dict[str, dict[str, Any]], day: str, span: int = 30) -> list[dict[str, Any]]:
    """The thirty dashes behind the clean-day card, oldest first."""
    anchor = date.fromisoformat(day)
    return [
        {
            "day": (anchor - timedelta(days=offset)).isoformat(),
            "clean": bool((values_by_day.get((anchor - timedelta(days=offset)).isoformat()) or {}).get("avoid_habit")),
        }
        for offset in range(span - 1, -1, -1)
    ]


def _tile_payload(
    tile: M.Tile,
    values: dict[str, Any],
    metric_scores: dict[str, float],
    weekly: dict[str, dict[str, Any]],
    settings: dict[str, Any],
    values_by_day: dict[str, dict[str, Any]] | None = None,
    day: str = "",
) -> dict[str, Any]:
    fields = [M.METRIC_INDEX[f] for f in tile.fields if f in M.METRIC_INDEX]
    primary = fields[0] if fields else None
    card = weekly.get(tile.id) if tile.weekly else None
    answered = any(values.get(f.id) is not None for f in fields)

    display: str | None = None
    unit = tile.unit or (primary.unit if primary else "")
    sub: str | None = None
    progress: float | None = None
    goal: float | None = None
    shown: float | None = None
    track = list(tile.track) if tile.track else None
    zone = list(tile.zone) if tile.zone else None

    if tile.chart == "night":
        if answered:
            display = " → ".join(values.get(f.id) or "—" for f in fields)
    elif primary:
        display, _ = _display(primary, values.get(primary.id))
        progress = _progress(primary, values.get(primary.id), metric_scores.get(primary.id), tile.cap)
        raw = values.get(primary.id)
        if isinstance(raw, (int, float)) and not isinstance(raw, bool):
            shown = float(raw)

    tracked = bool(card and card.get("tracked"))
    if card and not tracked:
        display, progress = None, None

    if tile.id == "learned":
        note = values.get("learned_what")
        sub = str(note) if note else None
    elif tile.id == "weight":
        raw = settings.get("weight_goal")
        if raw:
            goal = float(raw)
            reading = values.get("weight_kg")
            if isinstance(reading, (int, float)) and not isinstance(reading, bool):
                delta = float(reading) - goal
                if abs(delta) < 0.05:
                    sub = "At your goal"
                else:
                    sub = f"{abs(delta):.1f} kg {'above' if delta > 0 else 'under'} goal"
            else:
                text = _number(goal, 0 if goal.is_integer() else 1, False)
                sub = f"Goal {text} kg"
            # The weight card is a scale around the goal, so the goal is the
            # middle of the track rather than a line somewhere off the end.
            track = [round(goal - 6, 1), round(goal + 6, 1)]
            zone = [round(goal - 0.5, 1), round(goal + 0.5, 1)]

    if card:
        # Weekly fields read as progress toward the week's target, never as a
        # daily zero — so their number is the week's count, not today's.
        if tracked:
            progress = float(card["progress"])
            count = float(card["count"])
            display = _number(count, 0 if count.is_integer() else 1, False)
            shown = count

    unit = _agreed(unit, shown)

    empty = not answered and not tracked
    state = "empty" if empty else (
        "done" if (progress or 0) >= 1 or (answered and progress is None) else "open"
    )

    filled = 0
    if tile.chart in ("segments", "blocks") and card and tracked:
        filled = max(0, min(tile.cells, int(round(float(card["count"])))))
    elif tile.chart in ("segments", "blocks") and answered:
        filled = min(tile.cells, int(round(float(values.get(primary.id) or 0)))) or 1

    caption = "Not logged yet" if empty else (card["caption"] if card else tile.target)

    label = tile.label or (primary.label if primary else tile.id)

    if settings.get("avoid_habit_name") and primary and primary.id == "avoid_habit":
        label = settings["avoid_habit_name"]

    score = _tile_score(tile, metric_scores)
    weight = _tile_weight(tile)
    # What is still on the table, priced in points of the total score. A card
    # that has been answered but carries no score has nothing left to offer.
    stake: float | None = None
    if weight:
        if score is not None:
            stake = round(max(0.0, weight * (1 - score) * SCORE_SHARE), 2)
        elif answered or tracked:
            stake = 0.0
        else:
            stake = round(weight * SCORE_SHARE, 2)

    target_value = float(card["target"]) if card else TILE_TARGETS.get(tile.id)

    return {
        "id": tile.id,
        "label": label,
        "category": tile.category,
        "chart": tile.chart,
        "w": tile.w,
        "fields": list(tile.fields),
        # the raw inputs, so a card can draw its own geometry (a night window,
        # a position on a track) without asking the server for anything else
        "values": {f.id: values.get(f.id) for f in fields},
        "weekly": tile.weekly,
        "optional": tile.optional,
        "state": state,
        "settled": answered or tracked,
        "display": display,
        "unit": unit,
        "sub": sub,
        "progress": round(progress, 4) if progress is not None else None,
        "cells": tile.cells,
        "filled": filled,
        "caption": caption,
        "track": track,
        "zone": zone,
        "goal": goal,
        "target": target_value,
        "target_label": card["target_label"] if card else tile.target,
        # what an instrument needs to place a drag on its own axis
        "step": primary.step if primary else 1,
        "min": primary.min if primary else None,
        "labels": list(primary.labels) if primary else [],
        # the card's own score out of ten, and what it is worth in the ring
        "score": round(score, 4) if score is not None else None,
        "points": int(round(score * 10)) if score is not None else None,
        "weight": weight if weight else None,
        "stake": stake if weight else None,
        "gap": _gap_line(tile, primary, values, card, goal),
        "yesterday": _yesterday(values_by_day or {}, day, primary.id) if (primary and day) else None,
        "usual": _usual(values_by_day or {}, day, primary.id) if (primary and day) else None,
        "days": _avoid_days(values_by_day or {}, day) if tile.id == "avoid_habit" and day else None,
    }


def build_board_payload(
    values: dict[str, Any],
    score: analytics.DayScore | None,
    weekly: list[dict[str, Any]],
    settings: dict[str, Any] | None = None,
    entries: Sequence[dict[str, Any]] | None = None,
    day: str | None = None,
) -> dict[str, Any]:
    """Every field as a finished card: what to draw, what it says, how much of
    the ring it is worth, and whether the day has an answer for it yet."""
    settings = settings or {}
    metric_scores = (score.metrics if score else {}) or {}
    cards = {card["id"]: card for card in weekly}
    values_by_day = {entry["day"]: entry["values"] for entry in (entries or [])}
    tiles = [
        _tile_payload(tile, values, metric_scores, cards, settings, values_by_day, day or "")
        for tile in M.TILES
    ]

    daily = [t for t in tiles if not t["weekly"] and not t["optional"]]
    logged = len([t for t in daily if t["settled"]])
    return {
        "tiles": tiles,
        "daily_total": len(daily),
        "daily_logged": logged,
        "complete": bool(daily) and logged == len(daily),
        "next_move": _next_move(tiles),
    }


def _next_move(tiles: list[dict[str, Any]]) -> dict[str, Any] | None:
    """The open card that would move the total score most, priced honestly."""
    open_cards = [
        tile for tile in tiles
        if tile.get("stake") and (tile["state"] != "done")
    ]
    if not open_cards:
        return None
    order = {tile.id: index for index, tile in enumerate(M.TILES)}
    best = max(open_cards, key=lambda tile: (tile["stake"], -order[tile["id"]]))
    return {
        "id": best["id"],
        "label": best["label"],
        "category": best["category"],
        "line": best["gap"],
        "points": max(1, int(round(best["stake"]))),
    }


def _compare(scores: dict[str, analytics.DayScore], day: str) -> dict[str, Any]:
    """Yesterday's score and the usual one — two plain numbers, no trend line."""
    anchor = date.fromisoformat(day)
    previous = scores.get((anchor - timedelta(days=1)).isoformat())
    span = [
        score.total
        for key, score in scores.items()
        if score.total is not None
        and (anchor - timedelta(days=30)) <= date.fromisoformat(key) < anchor
    ]
    return {
        "yesterday": previous.total if previous else None,
        "usual": round(sum(span) / len(span), 4) if span else None,
        "usual_days": len(span),
    }


def _week(scores: dict[str, analytics.DayScore], day: str) -> list[dict[str, Any]]:
    """Monday to Sunday around a day — how the week itself has gone."""
    anchor = date.fromisoformat(day)
    monday = anchor - timedelta(days=anchor.weekday())
    out: list[dict[str, Any]] = []
    for offset in range(7):
        key = (monday + timedelta(days=offset)).isoformat()
        score = scores.get(key)
        out.append(
            {
                "day": key,
                "total": score.total if score else None,
                "categories": (score.categories if score else {}) or {},
                "logged": score is not None,
            }
        )
    return out


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
        "week": _week(scores, day),
        "compare": _compare(scores, day),
        "focus": focus,
        "weekly": weekly,
        "board": build_board_payload(values, score, weekly, settings, entries, day),
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
