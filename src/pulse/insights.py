"""Insights: what moves mood and energy.

Everything here is correlational and phrased that way on purpose. We only speak
up when a pattern is worth a sentence and there is enough data behind it.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Callable, Sequence

from . import scoring as s

MIN_DAYS_PER_SIDE = 7
MIN_EFFECT = 0.35
MIN_DAYS_TOTAL = 24

OUTCOMES = (("mood", "mood"), ("energy", "energy"))


@dataclass
class Condition:
    key: str
    label: str
    test: Callable[[dict[str, Any]], bool]
    kind: str = "positive"  # positive | negative (a negative insight is a warning)


def _gt(field: str, limit: float) -> Callable[[dict[str, Any]], bool]:
    return lambda values: _num(values.get(field)) is not None and _num(values[field]) >= limit


def _lt(field: str, limit: float) -> Callable[[dict[str, Any]], bool]:
    return lambda values: _num(values.get(field)) is not None and _num(values[field]) < limit


def _num(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


CONDITIONS: tuple[Condition, ...] = (
    Condition("sleep_7", "7 h or more of sleep", _gt("sleep_hours", 7)),
    Condition("sleep_short", "less than 6.5 h of sleep", _lt("sleep_hours", 6.5), "negative"),
    Condition("deep_2", "two or more deep blocks", _gt("deep_blocks", 1.99)),
    Condition("screen_low", "under 4 h of screen time", _lt("screen_hours", 4)),
    Condition("screen_high", "6 h or more of screen time", _gt("screen_hours", 5.99), "negative"),
    Condition("steps_8k", "8,000+ steps", _gt("steps", 7999)),
    Condition("outdoor_20", "20+ min outside", _gt("outdoor", 19)),
    Condition("no_alcohol", "an alcohol-free day", lambda v: not v.get("alcohol")),
    Condition("gym_day", "a gym session", lambda v: bool(v.get("gym"))),
    Condition("read", "10+ min of reading", lambda v: bool(v.get("read"))),
    Condition("learned", "learning something", lambda v: bool(v.get("learned"))),
)


@dataclass
class Insight:
    outcome: str
    outcome_label: str
    condition: str
    condition_label: str
    with_mean: float
    without_mean: float
    delta: float
    days_with: int
    days_without: int
    strength: float
    kind: str
    sentence: str


def _sentence(outcome_label: str, condition: Condition, with_mean: float, without_mean: float, days_with: int) -> str:
    verb = "higher" if with_mean > without_mean else "lower"
    return (
        f"On days with {condition.label} your {outcome_label} averages "
        f"{with_mean:.1f} vs {without_mean:.1f} otherwise ({days_with} such days)."
    )


def insights(
    entries: Sequence[dict[str, Any]],
    window_days: int | None = 90,
) -> list[Insight]:
    ordered = sorted(entries, key=lambda e: e["day"])
    if window_days and ordered:
        cutoff = (date.fromisoformat(ordered[-1]["day"]) - timedelta(days=window_days - 1)).isoformat()
        ordered = [e for e in ordered if e["day"] >= cutoff]
    if len(ordered) < MIN_DAYS_TOTAL:
        return []

    found: list[Insight] = []
    for outcome, outcome_label in OUTCOMES:
        paired = [(e["values"], _num(e["values"].get(outcome))) for e in ordered]
        paired = [(values, value) for values, value in paired if value is not None]
        if len(paired) < MIN_DAYS_TOTAL:
            continue
        for condition in CONDITIONS:
            with_values = [value for values, value in paired if condition.test(values)]
            without_values = [value for values, value in paired if not condition.test(values)]
            if len(with_values) < MIN_DAYS_PER_SIDE or len(without_values) < MIN_DAYS_PER_SIDE:
                continue
            with_mean = s.mean(with_values) or 0.0
            without_mean = s.mean(without_values) or 0.0
            delta = with_mean - without_mean
            if abs(delta) < MIN_EFFECT:
                continue
            found.append(
                Insight(
                    outcome=outcome,
                    outcome_label=outcome_label,
                    condition=condition.key,
                    condition_label=condition.label,
                    with_mean=round(with_mean, 2),
                    without_mean=round(without_mean, 2),
                    delta=round(delta, 2),
                    days_with=len(with_values),
                    days_without=len(without_values),
                    strength=round(abs(delta), 2),
                    kind="positive" if delta > 0 else "negative",
                    sentence=_sentence(outcome_label, condition, with_mean, without_mean, len(with_values)),
                )
            )
    found.sort(key=lambda i: i.strength, reverse=True)
    # Keep the story short: best two and at most one warning per outcome.
    picked: list[Insight] = []
    for outcome, _ in OUTCOMES:
        positives = [i for i in found if i.outcome == outcome and i.delta > 0][:2]
        negatives = [i for i in found if i.outcome == outcome and i.delta < 0][:1]
        picked.extend(positives + negatives)
    return picked
