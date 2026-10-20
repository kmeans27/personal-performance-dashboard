"""The field catalogue.

Every field the dashboard knows about is described once, here. The front-end
renders the logging flow and the day sheet straight from this catalogue
(exposed as JSON via `/api/schema`), so adding a field means editing one file.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Callable

from . import scoring as s

# ---------------------------------------------------------------- categories


@dataclass(frozen=True)
class Category:
    id: str
    label: str
    accent: str
    blurb: str


CATEGORIES: tuple[Category, ...] = (
    Category("body", "Body", "#43D6A0", "The machine you live in."),
    Category("mind", "Mind", "#9B8AFB", "Deliberate thinking and learning."),
    Category("attention", "Attention", "#5AA9F0", "Where your hours actually go."),
)

INNER_ORDER = ("body", "mind", "attention")  # outer -> inner ring


# ------------------------------------------------------------------- metrics


@dataclass(frozen=True)
class Metric:
    id: str
    label: str
    category: str
    scorer: str
    weight: float = 0.0
    # how the logging flow should ask for it
    input: str = "number"  # number | counter | toggle | scale | time | text
    unit: str = ""
    min: float | None = None
    max: float | None = None
    step: float = 1
    presets: tuple[float, ...] = ()
    labels: tuple[str, ...] = ()
    prompt: str = ""
    help: str = ""
    auto: bool = False
    weekly: bool = False
    scored: bool = True
    archived: bool = False
    value_field: str = ""  # for companion inputs (e.g. learned -> learned_what)


def _m(**kwargs: Any) -> Metric:
    return Metric(**kwargs)


METRICS: tuple[Metric, ...] = (
    # ----------------------------------------------------------- body
    _m(
        id="sleep_hours",
        label="Sleep",
        category="body",
        scorer="sleep_duration",
        weight=0.26,
        input="number",
        unit="h",
        min=0,
        max=12,
        step=0.25,
        presets=(6, 7, 7.5, 8, 9),
        prompt="How long did you sleep?",
        help="The body ring rewards the 7–9 h band, not raw hours.",
    ),
    _m(
        id="bed_time",
        label="Bed time",
        category="body",
        scorer="none",
        input="time",
        prompt="When did you get to bed?",
        help="Your wake time comes from your sleep. The ring scores how regular this is.",
    ),
    _m(
        id="steps",
        label="Steps",
        category="body",
        scorer="steps",
        weight=0.18,
        input="number",
        unit="steps",
        min=0,
        max=30000,
        step=100,
        presets=(4000, 6000, 8000, 10000),
        auto=True,
        prompt="Steps today",
        help="Import from Apple Health / Health Connect, or type it in.",
    ),
    _m(
        id="gym",
        label="Gym",
        category="body",
        scorer="gym",
        weight=0.18,
        input="counter",
        unit="session",
        min=0,
        max=3,
        presets=(1,),
        weekly=True,
        prompt="Sessions today",
        help="Weekly field — the ring shows progress toward 2–3 sessions a week.",
    ),
    _m(
        id="greens",
        label="Greens & fruit",
        category="body",
        scorer="boolean",
        weight=0.08,
        input="toggle",
        prompt="Greens or fruit today?",
    ),
    _m(
        id="alcohol",
        label="Alcohol",
        category="body",
        scorer="alcohol",
        weight=0.08,
        input="counter",
        unit="drinks",
        min=0,
        max=10,
        weekly=True,
        prompt="Any alcohol today?",
        help="Defaults to none — you only log the days you drink.",
    ),
    _m(
        id="outdoor",
        label="Outdoor light",
        category="body",
        scorer="outdoor",
        weight=0.08,
        input="number",
        unit="min",
        min=0,
        max=120,
        step=5,
        presets=(10, 20, 30),
        prompt="Time outside",
        help="20 min is the bar — morning light counts double in spirit.",
    ),
    _m(
        id="weight_kg",
        label="Weight",
        category="body",
        scorer="none",
        input="number",
        unit="kg",
        min=30,
        max=200,
        step=0.1,
        prompt="Weight (optional)",
        help="Tracked as a 7-day average against your goal. Never scored.",
        scored=False,
    ),
    _m(
        id="creatine",
        label="Creatine",
        category="body",
        scorer="boolean",
        input="toggle",
        prompt="Creatine taken?",
        help="A daily reminder. It does not move any ring.",
        scored=False,
    ),
    # ----------------------------------------------------------- mind
    _m(
        id="deep_blocks",
        label="Deep blocks",
        category="mind",
        scorer="deep_blocks",
        weight=0.5,
        input="counter",
        unit="",
        min=0,
        max=8,
        presets=(1,),
        prompt="Deep 45-minute blocks",
        help="Three fills the ring — a fourth does not add.",
    ),
    _m(
        id="learned",
        label="Learned something",
        category="mind",
        scorer="boolean",
        weight=0.25,
        input="toggle",
        prompt="Did you learn something today?",
        value_field="learned_what",
    ),
    _m(id="learned_what", label="What did you learn?", category="mind", scorer="none",
       input="text", prompt="Write down the one thing.", scored=False),
    _m(
        id="read",
        label="Read 10+ min",
        category="mind",
        scorer="boolean",
        weight=0.25,
        input="toggle",
        prompt="Ten minutes of reading?",
    ),
    _m(
        id="mood",
        label="Mood",
        category="mind",
        scorer="none",
        input="scale",
        min=1,
        max=5,
        labels=("rough", "low", "ok", "good", "great"),
        prompt="How was today overall?",
        help="Not in the score. This is the outcome the insights watch.",
        scored=False,
    ),
    _m(
        id="energy",
        label="Energy",
        category="mind",
        scorer="none",
        input="scale",
        min=1,
        max=5,
        labels=("empty", "low", "steady", "good", "full"),
        prompt="How much energy do you have?",
        scored=False,
    ),
    # ------------------------------------------------------ attention
    _m(
        id="screen_hours",
        label="Screen time",
        category="attention",
        scorer="screen_time",
        weight=0.35,
        input="number",
        unit="h",
        min=0,
        max=16,
        step=0.25,
        presets=(2, 3, 4, 6),
        auto=True,
        prompt="Screen time",
        help="Phone and social merged into one number. Lower is better.",
    ),
    _m(
        id="pickups",
        label="Phone pickups",
        category="attention",
        scorer="pickups",
        weight=0.15,
        input="number",
        unit="",
        min=0,
        max=400,
        step=5,
        presets=(40, 60, 90, 130),
        auto=True,
        prompt="Phone pickups",
    ),
    _m(
        id="main_task",
        label="Main task",
        category="attention",
        scorer="boolean",
        weight=0.30,
        input="toggle",
        prompt="Did you finish the one thing that mattered most today?",
        help="One thing, chosen in the morning. The note is part of the answer.",
        value_field="main_task_what",
    ),
    _m(id="main_task_what", label="What was it?", category="attention", scorer="none",
       input="text", prompt="Write down the one thing.", scored=False),
    _m(
        id="avoid_habit",
        label="Clean day",
        category="attention",
        scorer="avoid",
        weight=0.20,
        input="toggle",
        prompt="Did you stay clean today?",
        help="Scored over the last fortnight, shown as days clean in 30.",
    ),
)

METRIC_INDEX = {m.id: m for m in METRICS}


# -------------------------------------------------------------------- board
# How each field is best shown on the one-screen board. It belongs next to the
# field itself: "what this is" and "how it reads at a glance" are one decision.
#
# A chart is chosen by the *shape* of the field, not by taste:
#
#   range     a value against a good zone on a track — a band you want to land
#             in (sleep) or a ceiling you want to stay under (screen, pickups)
#   bar       progress toward a target you are chasing (steps, outdoor, clean)
#   segments  a small count you tick off (gym, alcohol-free)
#   blocks    a big count you stack up (deep blocks)
#   switch    a yes/no that must look unmistakably answered (greens, creatine)
#   scale     a felt 1–5 (mood, energy)
#   night     a window across the day (bed time -> wake time)
#
#   w    how many of the category column's two card slots the field takes.
#        A switch is one slot; anything with a track or a timeline is two.
#        Each category's widths must add up to whole rows of two.
#   track   the axis a range chart draws on: (from, to)
#   zone    the part of that axis that counts as good
#   weekly  weekly fields wait for the week; they never show a daily zero


@dataclass(frozen=True)
class Tile:
    id: str
    category: str
    chart: str
    fields: tuple[str, ...]
    w: int = 1  # card slots in its category column (1 or 2)
    label: str = ""  # falls back to the field's own label
    target: str = ""
    unit: str = ""  # falls back to the field's own unit
    cells: int = 0  # segments only
    weekly: bool = False
    optional: bool = False
    cap: float | None = None  # the value that means "full", when nothing else scores it
    track: tuple[float, float] | None = None  # range charts only
    zone: tuple[float, float] | None = None  # the good part of the track


# Each category is one column, two cards wide, and every row below is full:
# Body 6 rows, Mind 4, Attention 3. A yes/no takes one slot, side by side with
# its neighbour; anything with a scale, a timeline or thirty days takes two.
# Nothing here is sized by "importance" — it is sized by what it has to draw.

TILES: tuple[Tile, ...] = (
    # --------------------------------------------------------------- body
    Tile(
        "sleep", "body", "range", ("sleep_hours",), w=2,
        label="Slept", target="Target 7–9 h", track=(0, 12), zone=(7, 9),
    ),
    Tile("steps", "body", "bar", ("steps",), target="Target 9,000 steps"),
    Tile(
        "gym", "body", "segments", ("gym",), cells=3, weekly=True,
        label="Gym", target="2–3 sessions a week", unit="sessions",
    ),
    Tile(
        "alcohol", "body", "segments", ("alcohol",), cells=7,
        weekly=True, label="Alcohol-free", target="Seven clean days", unit="days",
    ),
    Tile("outdoor", "body", "bar", ("outdoor",), target="20 min outside"),
    Tile("greens", "body", "switch", ("greens",), label="Greens", target="Fruit or veg today"),
    Tile("creatine", "body", "switch", ("creatine",), label="Creatine", target="5 g, once a day"),
    Tile(
        "weight", "body", "range", ("weight_kg",), w=2, optional=True,
        label="Weight", target="Against your goal", track=(60, 110),
    ),
    Tile(
        "rhythm", "body", "bedtime", ("bed_time",), w=2,
        label="In bed", target="When you got to bed",
    ),
    # --------------------------------------------------------------- mind
    Tile(
        "deep_blocks", "mind", "blocks", ("deep_blocks",), w=2, cells=3,
        label="Deep blocks", target="A full day",
    ),
    Tile("read", "mind", "switch", ("read",), label="Read", target="Ten minutes"),
    Tile(
        "learned", "mind", "switch", ("learned", "learned_what"), label="Learned",
        target="What you learned",
    ),
    Tile("mood", "mind", "scale", ("mood",), w=2, label="Mood", target="How was today overall?"),
    Tile("energy", "mind", "scale", ("energy",), w=2, label="Energy", target="What was in the tank"),
    # ---------------------------------------------------------- attention
    Tile(
        "screen_hours", "attention", "range", ("screen_hours",), w=2,
        label="Screen time", target="Under 3 h", track=(0, 8), zone=(0, 3),
    ),
    Tile(
        "pickups", "attention", "range", ("pickups",), w=2,
        label="Pickups", target="Under 60", track=(0, 150), zone=(0, 60),
    ),
    Tile(
        "main_task", "attention", "switch", ("main_task", "main_task_what"), w=2,
        label="Main task", target="The one thing that mattered most",
    ),
    Tile(
        "avoid_habit", "attention", "bar", ("avoid_habit",), w=2,
        weekly=True, label="Clean day", target="Days clean in the last 30",
    ),
)

TILE_INDEX = {t.id: t for t in TILES}


def board_fields() -> set[str]:
    return {field for tile in TILES for field in tile.fields}


def metrics_for(category: str) -> tuple[Metric, ...]:
    return tuple(m for m in METRICS if m.category == category)


def scored_metrics() -> tuple[Metric, ...]:
    return tuple(m for m in METRICS if m.scored and m.weight > 0)


# ------------------------------------------------------------------ scorers
# Each scorer maps a normalised 0..1 score, or None when the field was not
# answered (skipped fields are dropped from the ring instead of counting as 0).


@dataclass
class DayContext:
    """Aggregates a scorer may need. Built once per day by the analytics layer."""

    weekly: dict[str, float] = field(default_factory=dict)
    clean_days_30: dict[str, int] = field(default_factory=dict)
    clean_days_14: dict[str, int] = field(default_factory=dict)
    regularity: float | None = None

    def week(self, metric_id: str) -> float:
        return float(self.weekly.get(metric_id, 0.0))

    def clean(self, metric_id: str, days: int = 14) -> int:
        source = self.clean_days_14 if days <= 14 else self.clean_days_30
        return int(source.get(metric_id, 0))


def _scorer_sleep(value: Any, ctx: DayContext) -> float | None:
    return s.plateau(value, 7.0, 9.0, fade=2.0)


def _scorer_steps(value: Any, ctx: DayContext) -> float | None:
    return s.higher_is_better(value, 9000)


def _scorer_gym(value: Any, ctx: DayContext) -> float | None:
    if value is None and not ctx.week("gym"):
        return None
    return s.count_toward(ctx.week("gym"), 2.5, cap=1.0)


def _scorer_boolean(value: Any, ctx: DayContext) -> float | None:
    return s.boolean(value)


def _scorer_alcohol(value: Any, ctx: DayContext) -> float | None:
    return 1.0 - s.clamp01(ctx.week("alcohol") / 4.0)


def _scorer_outdoor(value: Any, ctx: DayContext) -> float | None:
    return s.higher_is_better(value, 20)


def _scorer_deep_blocks(value: Any, ctx: DayContext) -> float | None:
    return s.count_toward(value, 3.0, cap=1.0)


def _scorer_screen_time(value: Any, ctx: DayContext) -> float | None:
    return s.lower_is_better(value, good=3.0, bad=7.0)


def _scorer_pickups(value: Any, ctx: DayContext) -> float | None:
    return s.lower_is_better(value, good=60, bad=150)


def _scorer_avoid(value: Any, ctx: DayContext) -> float | None:
    clean = ctx.clean("avoid_habit", days=14)
    if value is None and clean == 0:
        return None
    return s.ramp(clean, 10, 14)


SCORERS: dict[str, Callable[[Any, DayContext], float | None]] = {
    "none": lambda value, ctx: None,
    "sleep_duration": _scorer_sleep,
    "steps": _scorer_steps,
    "gym": _scorer_gym,
    "boolean": _scorer_boolean,
    "alcohol": _scorer_alcohol,
    "outdoor": _scorer_outdoor,
    "deep_blocks": _scorer_deep_blocks,
    "screen_time": _scorer_screen_time,
    "pickups": _scorer_pickups,
    "avoid": _scorer_avoid,
}


def score_metric(metric: Metric, value: Any, ctx: DayContext) -> float | None:
    return SCORERS[metric.scorer](value, ctx)


# --------------------------------------------------------------- serialisation


def catalogue() -> dict[str, Any]:
    """Everything the front-end needs to render fields, rings and colours."""
    metrics = [asdict(m) for m in METRICS if not m.archived]
    return {
        "categories": [asdict(c) for c in CATEGORIES],
        "ring_order": list(INNER_ORDER),
        "metrics": metrics,
        "weekly": [m.id for m in METRICS if m.weekly],
        "board": [asdict(t) for t in TILES],
    }
