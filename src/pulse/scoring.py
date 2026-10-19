"""Scoring primitives.

Every metric is normalised to 0..1 before it reaches a ring, so no single
category can out-shout another. These functions are pure and unit-tested.
"""

from __future__ import annotations

import math
from datetime import time
from typing import Iterable, Sequence

Number = float | int | None


def clamp01(x: float) -> float:
    return 0.0 if x < 0.0 else 1.0 if x > 1.0 else float(x)


def ramp(value: float, low: float, high: float) -> float:
    """0 at `low`, 1 at `high`, clamped. Works for high > low and low > high."""
    if low == high:
        return 1.0 if value >= high else 0.0
    return clamp01((value - low) / (high - low))


def higher_is_better(value: Number, target: float) -> float | None:
    if value is None:
        return None
    return ramp(float(value), 0.0, target)


def lower_is_better(value: Number, good: float, bad: float) -> float | None:
    if value is None:
        return None
    return ramp(float(value), bad, good)  # inverted ramp: good -> 1, bad -> 0


def plateau(value: Number, low: float, high: float, fade: float) -> float | None:
    """1.0 inside [low, high], linearly fading to 0 over `fade` on both sides."""
    if value is None:
        return None
    v = float(value)
    if low <= v <= high:
        return 1.0
    if v < low:
        return ramp(v, low - fade, low)
    return ramp(v, high + fade, high)


def boolean(value: Number) -> float | None:
    if value is None:
        return None
    return 1.0 if value else 0.0


def count_toward(value: Number, target: float, cap: float | None = None) -> float | None:
    if value is None:
        return None
    score = ramp(float(value), 0.0, target)
    if cap is not None:
        score = min(score, cap)
    return score


def _minutes_since_18h(t: time) -> float:
    """Bed times sit around midnight, so we measure from 18:00 to keep the
    timeline continuous (18:00 -> 0, 06:00 -> 720)."""
    total = t.hour * 60 + t.minute
    shifted = total - 18 * 60
    if shifted < 0:
        shifted += 24 * 60
    return float(shifted)


def _circular_std(values: Sequence[float], period: float) -> float:
    """Standard deviation on a circle (mean resultant length)."""
    if len(values) < 2:
        return 0.0
    angles = [2 * math.pi * v / period for v in values]
    mean_angle = math.atan2(
        sum(math.sin(a) for a in angles), sum(math.cos(a) for a in angles)
    )
    deviations = [(a - mean_angle + math.pi) % (2 * math.pi) - math.pi for a in angles]
    return math.sqrt(sum(d * d for d in deviations) / len(deviations)) * period / (2 * math.pi)


def sleep_regularity(times: Iterable[time], tolerance_hours: float = 2.0) -> float | None:
    """How consistent the bedtime is, 0..1. `tolerance_hours` of spread -> 0."""
    values = [_minutes_since_18h(t) for t in times]
    if len(values) < 4:
        return None
    std_minutes = _circular_std(values, 24 * 60)
    return clamp01(1.0 - (std_minutes / 60.0) / tolerance_hours)


def mean(values: Iterable[Number]) -> float | None:
    clean = [float(v) for v in values if v is not None]
    if not clean:
        return None
    return sum(clean) / len(clean)
