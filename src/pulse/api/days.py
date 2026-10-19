"""API: day entries, settings and the field catalogue."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from fastapi import APIRouter, HTTPException

from .. import analytics, config, metrics, repository
from ..schemas import DayEntryIn, ImportIn, SettingsIn
from .views import build_day_payload

router = APIRouter(tags=["days"])


@router.get("/health")
def health() -> dict:
    return {"ok": True, "app": config.APP_NAME, "version": config.APP_VERSION}


@router.get("/schema")
def schema() -> dict:
    return metrics.catalogue()


@router.get("/settings")
def read_settings() -> dict:
    return repository.get_settings()


@router.patch("/settings")
def write_settings(patch: SettingsIn) -> dict:
    values = {k: v for k, v in patch.model_dump().items() if v is not None}
    return repository.update_settings(values)


@router.get("/stats")
def stats() -> dict:
    return repository.stats()


@router.get("/prefill")
def prefill(day: str | None = None) -> dict:
    """Defaults for the logging flow: yesterday first, recent average as backup."""
    day = day or date.today().isoformat()
    _validate(day)
    start = (date.fromisoformat(day) - timedelta(days=30)).isoformat()
    entries = repository.get_days(start, day)
    prior = [e for e in entries if e["day"] < day]
    yesterday = prior[-1]["values"] if prior else {}
    today = next((e["values"] for e in entries if e["day"] == day), {})

    last_values: dict[str, Any] = {}
    for entry in prior:
        last_values.update(entry["values"])

    averages: dict[str, Any] = {}
    for metric in metrics.METRICS:
        if metric.input not in {"number", "counter", "scale"}:
            continue
        samples = [
            e["values"][metric.id]
            for e in prior[-14:]
            if e["values"].get(metric.id) is not None
        ]
        if not samples:
            continue
        if all(isinstance(v, bool) for v in samples):
            averages[metric.id] = sum(samples) * 2 > len(samples)
            continue
        numeric = [float(v) for v in samples if not isinstance(v, bool)]
        if not numeric:
            continue
        average = sum(numeric) / len(numeric)
        if metric.id == "steps":
            average = round(average / 100) * 100
        elif metric.input in {"scale", "counter"}:
            average = round(average)
        else:
            average = round(average, 2)
        averages[metric.id] = average
    return {
        "day": day,
        "yesterday_day": prior[-1]["day"] if prior else None,
        "yesterday": yesterday,
        "last": last_values,
        "averages": averages,
        "today": today,
        "has_today": bool(today),
    }


@router.get("/day/{day}")
def read_day(day: str, insight: bool = False) -> dict:
    _validate(day)
    entries, scores = _scored_window(day)
    return build_day_payload(entries, scores, day, include_insight=insight, settings=repository.get_settings())


@router.put("/day/{day}")
def write_day(day: str, payload: DayEntryIn) -> dict:
    _validate(day)
    repository.upsert_day(day, payload.values, source=payload.source)
    entries, scores = _scored_window(day)
    return build_day_payload(entries, scores, day, settings=repository.get_settings())


@router.delete("/day/{day}")
def remove_day(day: str) -> dict:
    _validate(day)
    return {"deleted": repository.delete_day(day)}


@router.post("/import")
def import_entries(payload: ImportIn) -> dict:
    """Bulk upsert for automated sources (Apple Health, Health Connect, Shortcuts)."""
    days = []
    for entry in payload.days:
        day = entry.get("day")
        if not day:
            raise HTTPException(status_code=422, detail="each entry needs a 'day'")
        _validate(day)
        days.append({"day": day, "values": entry.get("values", {}), "source": entry.get("source", "import")})
    return {"imported": repository.import_days(days)}


def _validate(day: str) -> None:
    try:
        date.fromisoformat(day)
    except ValueError as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=422, detail="day must be YYYY-MM-DD") from exc


def _scored_window(day: str):
    """Load the day plus enough history for weekly fields and rhythm scoring."""
    start = date.fromisoformat(day) - timedelta(days=analytics.WARMUP_DAYS)
    entries = repository.get_days(start.isoformat(), day)
    scores = analytics.build_day_scores(entries)
    return entries, scores
