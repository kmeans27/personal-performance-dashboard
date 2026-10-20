"""Turning raw day entries into rings, series, focus lines and trends.

Pure functions over plain dicts, so the same code scores the real database and
the generated demo data.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any, Iterable, Sequence

from . import metrics as M
from . import scoring as s

CATEGORY_INDEX = {c.id: c for c in M.CATEGORIES}
LOWER_IS_BETTER = {"screen_hours", "pickups", "alcohol"}
WARMUP_DAYS = 30


# --------------------------------------------------------------------- types


@dataclass
class MetricScore:
    id: str
    label: str
    category: str
    unit: str
    value: Any
    score: float | None
    weight: float
    weekly: bool


@dataclass
class DayScore:
    day: str
    total: float | None
    categories: dict[str, float | None]
    metrics: dict[str, float] = field(default_factory=dict)
    details: list[MetricScore] = field(default_factory=list)
    coverage: float = 0.0
    values: dict[str, Any] = field(default_factory=dict)


# ------------------------------------------------------------------- helpers


def to_date(day: str) -> date:
    return date.fromisoformat(day)


def window(day: date, length: int) -> list[date]:
    return [day - timedelta(days=offset) for offset in range(length - 1, -1, -1)]


def _safe(v: Any, default: float = 0.0) -> float:
    if v is None or isinstance(v, bool):
        return float(v) if isinstance(v, bool) else default
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def _parse_time(value: Any) -> Any:
    from datetime import time

    if not isinstance(value, str) or ":" not in value:
        return None
    try:
        hour, minute = value.split(":")[:2]
        return time(int(hour), int(minute))
    except ValueError:
        return None


def build_contexts(values_by_day: dict[str, dict[str, Any]]) -> dict[str, M.DayContext]:
    """One context per logged day, holding the trailing aggregates scorers need."""
    weekly_metrics = [m.id for m in M.METRICS if m.weekly]
    contexts: dict[str, M.DayContext] = {}

    for day_str, values in values_by_day.items():
        day = to_date(day_str)
        weekly = {
            metric_id: sum(
                _safe(values_by_day.get(d.isoformat(), {}).get(metric_id))
                for d in window(day, 7)
            )
            for metric_id in weekly_metrics
        }
        clean14 = sum(
            1
            for d in window(day, 14)
            if values_by_day.get(d.isoformat(), {}).get("avoid_habit")
        )
        clean30 = sum(
            1
            for d in window(day, 30)
            if values_by_day.get(d.isoformat(), {}).get("avoid_habit")
        )
        bed_times = [
            t
            for d in window(day, 14)
            if (t := _parse_time(values_by_day.get(d.isoformat(), {}).get("bed_time")))
        ]
        contexts[day_str] = M.DayContext(
            weekly=weekly,
            clean_days_14={"avoid_habit": clean14},
            clean_days_30={"avoid_habit": clean30},
            regularity=s.sleep_regularity(bed_times),
        )
    return contexts


def score_values(values: dict[str, Any], ctx: M.DayContext) -> tuple[dict[str, float], dict[str, float | None], list[MetricScore]]:
    """Returns (per-metric scores, per-category scores, details)."""
    metric_scores: dict[str, float] = {}
    weighted: dict[str, list[tuple[float, float]]] = {c.id: [] for c in M.CATEGORIES}
    details: list[MetricScore] = []

    for metric in M.METRICS:
        if metric.archived:
            continue
        value = values.get(metric.id)
        if metric.id == "avoid_habit" and not value:
            value = values.get(metric.id)
        score = M.score_metric(metric, value, ctx)
        if metric.id == "bed_time" and ctx.regularity is not None:
            details.append(
                MetricScore("sleep_regular", "Rhythm", "body", "", round(ctx.regularity, 3), ctx.regularity, 0.0, True)
            )
        if score is None:
            continue
        metric_scores[metric.id] = round(score, 4)
        if metric.scored and metric.weight > 0:
            weighted[metric.category].append((metric.weight, score))
        details.append(
            MetricScore(metric.id, metric.label, metric.category, metric.unit, value, round(score, 4), metric.weight, metric.weekly)
        )

    categories: dict[str, float | None] = {}
    for category, entries in weighted.items():
        total_weight = sum(w for w, _ in entries)
        categories[category] = (
            round(sum(w * v for w, v in entries) / total_weight, 4) if total_weight else None
        )

    # Sleep regularity is folded into the body ring as its own weighted metric.
    body = weighted["body"]
    regularity = next((d.score for d in details if d.id == "sleep_regular" and d.score is not None), None)
    if regularity is not None and body and categories.get("body") is not None:
        weights = [(w, v) for w, v in body]
        weights.append((0.14, float(regularity)))
        categories["body"] = round(
            sum(w * v for w, v in weights) / sum(w for w, _ in weights), 4
        )
        metric_scores["sleep_regular"] = round(float(regularity), 4)

    return metric_scores, categories, details


def build_day_scores(entries: Sequence[dict[str, Any]]) -> dict[str, DayScore]:
    """Scores every entry. `entries` may reach further back than you display."""
    ordered = sorted(entries, key=lambda e: e["day"])
    values_by_day = {e["day"]: dict(e.get("values") or {}) for e in ordered}
    contexts = build_contexts(values_by_day)

    scores: dict[str, DayScore] = {}
    answered_total = len([m for m in M.METRICS if not m.archived])
    for day_str, values in values_by_day.items():
        metric_scores, categories, details = score_values(values, contexts[day_str])
        present = [c for c in categories.values() if c is not None]
        total = round(sum(present) / len(present), 4) if present else None
        coverage = round(len(metric_scores) / answered_total, 3) if answered_total else 0.0
        scores[day_str] = DayScore(
            day=day_str,
            total=total,
            categories=categories,
            metrics=metric_scores,
            details=details,
            coverage=coverage,
            values=values,
        )
    return scores


# ------------------------------------------------------------------- series


def series(entries: Sequence[dict[str, Any]], metric_id: str, limit: int | None = None) -> list[float]:
    values = [
        _safe(e["values"].get(metric_id))
        for e in sorted(entries, key=lambda x: x["day"])
        if e["values"].get(metric_id) is not None
    ]
    return values[-limit:] if limit else values


def score_series(scores: dict[str, DayScore], key: str, limit: int | None = None) -> list[float]:
    """key is 'total' or a category id."""
    out: list[float] = []
    for day in sorted(scores):
        value = scores[day].total if key == "total" else scores[day].categories.get(key)
        if value is not None:
            out.append(round(float(value), 4))
    return out[-limit:] if limit else out


# -------------------------------------------------------------------- focus


FOCUS_LINES: dict[str, str] = {
    "sleep_hours": "Sleep was {v} h — the 7 h floor is where the ring starts closing.",
    "steps": "{v} steps. A short walk covers the gap to 9,000.",
    "gym": "{v} session{s} in the last seven days — two closes the ring.",
    "screen_hours": "{v} h of screen time against a 3 h target.",
    "pickups": "{v} pickups. Every extra hundred is a small leak.",
    "deep_blocks": "{v} deep blocks — three fills the ring.",
    "outdoor": "{v} min outside. Twenty is the bar.",
    "greens": "No greens or fruit logged today.",
    "alcohol": "Alcohol nudged the body ring down this week.",
    "avoid_habit": "Room to grow on the habit you're avoiding.",
    "read": "Ten minutes of reading is still on the table.",
    "learned": "Nothing learned logged today.",
}


def _fmt(value: Any) -> str:
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def focus_line(day: DayScore) -> dict[str, Any] | None:
    """The one sentence that says where to look first."""
    available = {c: v for c, v in day.categories.items() if v is not None}
    if not available:
        return None
    category = min(available, key=lambda c: available[c])
    weakest = None
    for detail in day.details:
        if detail.category != category or detail.score is None or detail.weight <= 0:
            continue
        if weakest is None or detail.score < weakest.score:
            weakest = detail
    if weakest is None:
        return None
    template = FOCUS_LINES.get(weakest.id)
    value = weakest.value
    # {s} is the plural the sentence needs: "0 sessions", "1 session".
    one = isinstance(value, (int, float)) and not isinstance(value, bool) and abs(value) == 1
    line = template.format(v=_fmt(value), s="" if one else "s") if template else None
    if line is None:
        line = f"{weakest.label} is the lightest part of today."
    return {
        "category": category,
        "category_label": CATEGORY_INDEX[category].label,
        "accent": CATEGORY_INDEX[category].accent,
        "metric": weakest.id,
        "metric_label": weakest.label,
        "score": available[category],
        "line": line,
    }


# ---------------------------------------------------------- weekly progress

WEEKLY_CARDS: dict[str, dict[str, Any]] = {
    "gym": {"label": "Gym this week", "target": 2.5, "target_label": "2–3 sessions", "unit": ""},
    "alcohol": {"label": "Alcohol-free days", "target": 7, "target_label": "7 of 7", "unit": "of 7 days", "inverse_days": True},
    "avoid_habit": {"label": "Days clean in 30", "target": 30, "target_label": "30 of 30", "unit": "days"},
}


def weekly_progress(
    entries: Sequence[dict[str, Any]], day_str: str, settings: dict[str, Any] | None = None
) -> list[dict[str, Any]]:
    """Weekly fields read as progress toward a target, never as a daily zero."""
    day = to_date(day_str)
    settings = settings or {}
    values_by_day = {e["day"]: e["values"] for e in entries}
    cards: list[dict[str, Any]] = []
    for metric_id, config in WEEKLY_CARDS.items():
        if metric_id == "avoid_habit":
            length = 30
            count = sum(
                1 for d in window(day, length) if values_by_day.get(d.isoformat(), {}).get(metric_id)
            )
        elif config.get("inverse_days"):
            # Alcohol-free is the default, so unlogged days count as clean.
            length = 7
            count = sum(
                1 for d in window(day, 7) if not _safe(values_by_day.get(d.isoformat(), {}).get(metric_id))
            )
        else:
            length = 7
            count = sum(
                _safe(values_by_day.get(d.isoformat(), {}).get(metric_id)) for d in window(day, 7)
            )
        # A weekly field nobody has logged in the window is not a zero — it is
        # simply not being tracked yet, and its tile says so.
        tracked = any(d.isoformat() in values_by_day for d in window(day, length))
        target = float(settings.get("gym_target") or config["target"]) if metric_id == "gym" else config["target"]
        target_label = (
            f"{int(target)}–{int(target) + 1} sessions" if metric_id == "gym" else config["target_label"]
        )
        cards.append(
            {
                "id": metric_id,
                "label": config["label"],
                "target_label": target_label,
                "target": target,
                "count": round(count, 1),
                "unit": config.get("unit", ""),
                "progress": round(min(count / max(target, 0.0001), 1.0), 3),
                "tracked": tracked,
                "caption": weekly_caption(metric_id, count) if tracked else "Nothing logged yet",
            }
        )
    return cards


def weekly_caption(metric_id: str, count: float) -> str:
    if metric_id == "gym":
        return "Two sessions closes the ring." if count < 2 else "Ring closed for the week."
    if metric_id == "alcohol":
        return (
            "A clean week." if count >= 7 else f"{int(count)} of the last seven days alcohol-free."
        )
    if metric_id == "avoid_habit":
        return f"{int(count)} of the last 30 days clean."
    return ""


# ------------------------------------------------------------------- trends


@dataclass
class Trend:
    key: str
    label: str
    category: str
    current: float
    previous: float
    delta_pct: float
    direction: str  # "up" | "down" | "flat"
    polarity: str  # "good" when the movement is welcome
    sentence: str
    series: list[float]


TREND_UNITS: dict[str, str] = {
    "sleep_hours": " h",
    "steps": "",
    "screen_hours": " h",
    "pickups": "",
    "outdoor": " min",
    "deep_blocks": "",
    "mood": "/5",
    "energy": "/5",
    "gym": " sessions a week",
}

TREND_DIGITS: dict[str, int] = {
    "steps": 0,
    "pickups": 0,
    "outdoor": 0,
    "sleep_hours": 1,
    "screen_hours": 1,
    "deep_blocks": 1,
    "mood": 1,
    "energy": 1,
}


def _number(value: float, digits: int, grouped: bool = False) -> str:
    text = f"{value:,.{digits}f}" if grouped else f"{value:.{digits}f}"
    return text


def _sentence(
    label: str,
    current: float,
    previous: float,
    direction: str,
    good: bool,
    days: int,
    unit: str,
    digits: int,
    grouped: bool = False,
) -> str:
    if direction == "flat":
        return f"{label} is holding steady at {_number(current, digits, grouped)}{unit}."
    arrow = "up" if direction == "up" else "down"
    change = abs(current - previous) / previous * 100 if previous else 0
    tone = "That's working." if good else "That one is worth watching."
    return (
        f"{label} {arrow} {change:.0f}% against the previous {days} days — "
        f"{_number(current, digits, grouped)} vs {_number(previous, digits, grouped)}{unit}. {tone}"
    )


def trends(
    entries: Sequence[dict[str, Any]],
    scores: dict[str, DayScore],
    days: int = 30,
) -> list[Trend]:
    ordered = sorted(entries, key=lambda e: e["day"])
    if not ordered:
        return []
    end = to_date(ordered[-1]["day"])
    recent_start = (end - timedelta(days=days - 1)).isoformat()
    prior_start = (end - timedelta(days=2 * days - 1)).isoformat()
    prior_end = (end - timedelta(days=days)).isoformat()

    def split(values: list[tuple[str, float]]) -> tuple[list[float], list[float]]:
        recent = [v for d, v in values if d >= recent_start]
        prior = [v for d, v in values if prior_start <= d <= prior_end]
        return recent, prior

    candidates: list[Trend] = []

    # Category rings + overall, expressed on the same 0-100 scale as the rings.
    for key, label, category in [
        ("total", "Overall score", "overall"),
        *[(c.id, c.label, c.id) for c in M.CATEGORIES],
    ]:
        values = [
            (d, scores[d].total if key == "total" else scores[d].categories.get(key))
            for d in sorted(scores)
        ]
        pairs = [(d, float(v) * 100) for d, v in values if v is not None]
        recent, prior = split(pairs)
        if len(recent) >= 3 and len(prior) >= 3:
            candidates.append(
                _trend_from(
                    key, label, category, s.mean(recent) or 0, s.mean(prior) or 0,
                    [round(x, 1) for x in recent[-14:]], "good", "", 0, days,
                )
            )

    # Individual fields worth a sentence.
    watched = ["sleep_hours", "steps", "screen_hours", "pickups", "outdoor", "deep_blocks", "mood", "energy"]
    for metric_id in watched:
        metric = M.METRIC_INDEX[metric_id]
        pairs = [
            (e["day"], _safe(e["values"].get(metric_id)))
            for e in ordered
            if e["values"].get(metric_id) is not None
        ]
        recent, prior = split(pairs)
        if len(recent) >= 5 and len(prior) >= 5:
            candidates.append(
                _trend_from(
                    metric_id,
                    metric.label,
                    metric.category,
                    s.mean(recent) or 0,
                    s.mean(prior) or 0,
                    [round(x, 2) for x in recent[-14:]],
                    "bad" if metric_id in LOWER_IS_BETTER else "good",
                    TREND_UNITS.get(metric_id, ""),
                    TREND_DIGITS.get(metric_id, 1),
                    days,
                    grouped=metric_id in {"steps", "pickups"},
                )
            )
    return candidates


def _trend_from(
    key: str,
    label: str,
    category: str,
    current: float,
    previous: float,
    spark: list[float],
    good_when: str,
    unit: str = "",
    digits: int = 1,
    days: int = 30,
    grouped: bool = False,
) -> Trend:
    delta = current - previous
    threshold = max(abs(previous) * 0.03, 0.01)
    if abs(delta) < threshold:
        direction = "flat"
    else:
        direction = "up" if delta > 0 else "down"
    polarity = "good"
    if direction != "flat":
        polarity = "good" if (direction == "up") == (good_when == "good") else "watch"
    return Trend(
        key=key,
        label=label,
        category=category,
        current=round(current, 3),
        previous=round(previous, 3),
        delta_pct=round((delta / previous * 100) if previous else 0.0, 1),
        direction=direction,
        polarity=polarity,
        sentence=_sentence(label, current, previous, direction, polarity == "good", days, unit, digits, grouped),
        series=spark,
    )
