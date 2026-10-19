"""Request/response models."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class DayEntryIn(BaseModel):
    values: dict[str, Any] = Field(default_factory=dict)
    source: str = "manual"


class ImportIn(BaseModel):
    days: list[dict[str, Any]] = Field(default_factory=list)


class SettingsIn(BaseModel):
    model_config = {"extra": "allow"}

    display_name: str | None = None
    avoid_habit_name: str | None = None
    weight_goal: float | None = None
