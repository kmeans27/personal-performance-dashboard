"""Ninety days of believable demo data.

Real patterns, not random noise: a weekend dip, a three-week good streak, one
rough week, and a slow drift upward. Deterministic, so the demo page always
tells the same story.
"""

from __future__ import annotations

import random
from datetime import date, timedelta
from typing import Any

DEMO_SEED = 20240517
DEMO_DAYS = 90

LEARNED = (
    "How compound interest actually compounds",
    "Why my morning routine collapses on Fridays",
    "Rust's borrow checker, finally",
    "That my best ideas arrive during walks",
    "How DNS resolution order works",
    "The difference between urgency and importance",
    "How to write a shorter commit message",
    "Why I procrastinate on admin tasks",
    "What a good weekly review costs me in time",
    "How to hold a tune without looking at the sheet",
)

MAIN_TASKS = (
    "Ship the settings page",
    "Finish the Q3 draft",
    "Fix the import script",
    "Write the client proposal",
    "Clear the review queue",
    "Plan the next release",
    "Rewrite the onboarding copy",
    "Close the budget spreadsheet",
    "Prepare Thursday's demo",
    "Read the two pending RFCs",
)


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _clock(minutes: float) -> str:
    minutes = int(round(minutes)) % (24 * 60)
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def _samples(days: int) -> list[dict[str, Any]]:
    """Phase map: quiet start, a rough week, a long good streak, steady finish."""
    phases: list[str] = []
    for index in range(days):
        if 20 <= index <= 27:
            phases.append("rough")
        elif 45 <= index <= 67:
            phases.append("streak")
        elif index > 67:
            phases.append("good")
        else:
            phases.append("normal")
    return [{"phase": phase} for phase in phases]


def generate_days(days: int = DEMO_DAYS, end: date | None = None, seed: int = DEMO_SEED) -> list[dict[str, Any]]:
    rng = random.Random(seed)
    end = end or date.today()
    start = end - timedelta(days=days - 1)
    phases = _samples(days)
    entries: list[dict[str, Any]] = []
    weight = 84.5

    for index in range(days):
        day = start + timedelta(days=index)
        phase = phases[index]["phase"]
        weekend = day.weekday() >= 5
        progress = index / max(days - 1, 1)

        # ---- sleep
        sleep = 7.3 + progress * 0.4 + rng.gauss(0, 0.45)
        if weekend:
            sleep += 0.5
        if phase == "rough":
            sleep -= 1.3
        if phase == "streak":
            sleep = 7.7 + rng.gauss(0, 0.25)
        sleep = round(_clamp(sleep, 4.0, 10.5) * 4) / 4

        wake_target = 6.9 - (0.35 if weekend else 0) + (0.2 if phase == "streak" else 0)
        jitter = 0.12 if phase == "streak" else 0.6
        if phase == "rough":
            jitter = 0.9
        wake_hour = wake_target + rng.gauss(0, jitter)
        bed_hour = wake_hour - sleep
        if bed_hour < 0:
            bed_hour += 24

        # ---- movement
        gym_chance = (0.34 if weekend else 0.42)
        if phase == "streak":
            gym_chance = 0.52
        if phase == "rough":
            gym_chance = 0.05
        if weekend and phase == "normal":
            gym_chance = 0.18
        gym = 1 if rng.random() < gym_chance else 0

        steps = rng.gauss(8400 if not weekend else 6800, 1400) + gym * 1200
        if phase == "rough":
            steps -= 2200
        if phase == "streak":
            steps += 900
        steps = int(_clamp(steps, 1200, 21000) // 100 * 100)

        outdoor = int(_clamp(rng.gauss(24 if phase != "rough" else 10, 12), 0, 90) // 5 * 5)

        # ---- nutrition + substances
        greens_chance = 0.78 if phase != "rough" else 0.42
        if phase == "streak":
            greens_chance = 0.9
        greens = rng.random() < greens_chance

        drinks = 0
        drink_chance = 0.28 if weekend else 0.08
        if phase == "rough":
            drink_chance = 0.5
        if phase == "streak":
            drink_chance = 0.05
        if rng.random() < drink_chance:
            drinks = rng.choice([1, 1, 2, 2, 3])

        creatine = rng.random() < 0.82

        # ---- mind
        if weekend:
            blocks = rng.choice([0, 0, 1, 1, 2])
        else:
            blocks = rng.choice([1, 2, 2, 3, 3, 4])
        if phase == "streak":
            blocks = rng.choice([2, 3, 3, 4])
        if phase == "rough":
            blocks = rng.choice([0, 0, 1])
        if phase == "good":
            blocks = rng.choice([2, 3, 3, 3])

        learned = rng.random() < (0.55 if phase != "rough" else 0.3)
        read = rng.random() < (0.6 if not weekend else 0.7)

        # ---- attention
        screen = 4.4 - 0.35 * blocks + rng.gauss(0, 0.6)
        if weekend:
            screen += 0.7
        if phase == "rough":
            screen += 1.9
        if phase == "streak":
            screen -= 0.9
        screen = round(_clamp(screen, 1.0, 12.0) * 4) / 4
        pickups = int(_clamp(rng.gauss(58, 12) + (screen - 3) * 22, 15, 320) // 5 * 5)
        avoid = rng.random() < (0.92 if phase != "rough" else 0.55)

        task_chance = 0.42 + 0.12 * blocks
        if phase == "streak":
            task_chance += 0.18
        if phase == "rough":
            task_chance -= 0.2
        main_task = rng.random() < _clamp(task_chance, 0.2, 0.94)

        # ---- outcomes (mood/energy respond to the above, with noise)
        score_seed = (
            3.15
            + (sleep - 7.2) * 0.5
            + (blocks - 2) * 0.22
            - (screen - 4.2) * 0.18
            + (0.2 if outdoor >= 20 else -0.12)
            + rng.gauss(0, 0.35)
        )
        mood = int(round(_clamp(score_seed, 1, 5)))
        energy = int(round(_clamp(score_seed + (0.2 if greens else -0.1) + rng.gauss(0, 0.35), 1, 5)))

        weight += rng.gauss(-0.014, 0.12)
        if phase == "rough":
            weight += 0.35

        values: dict[str, Any] = {
            "sleep_hours": sleep,
            "bed_time": _clock(bed_hour * 60),
            "steps": steps,
            "gym": gym,
            "greens": greens,
            "alcohol": drinks,
            "outdoor": outdoor,
            "weight_kg": round(weight, 1),
            "creatine": creatine,
            "deep_blocks": blocks,
            "learned": learned,
            "read": read,
            "mood": mood,
            "energy": energy,
            "screen_hours": screen,
            "pickups": pickups,
            "main_task": main_task,
            "avoid_habit": avoid,
        }
        if learned:
            values["learned_what"] = LEARNED[index % len(LEARNED)]
        if main_task:
            values["main_task_what"] = MAIN_TASKS[index % len(MAIN_TASKS)]

        entries.append({"day": day.isoformat(), "values": values, "source": "demo"})

    # The most recent day is deliberately a strong one: the demo should feel
    # like a dashboard that just went well.
    entries[-1]["values"].update(
        {
            "sleep_hours": 7.75,
            "bed_time": "22:45",
            "steps": 11200,
            "gym": 1,
            "greens": True,
            "alcohol": 0,
            "outdoor": 30,
            "creatine": True,
            "deep_blocks": 3,
            "learned": True,
            "learned_what": "That the Friday dip is a planning problem, not a willpower problem",
            "read": True,
            "mood": 5,
            "energy": 4,
            "screen_hours": 2.5,
            "pickups": 44,
            "main_task": True,
            "main_task_what": "Finish the v2.2.4 desktop pass",
            "avoid_habit": True,
        }
    )

    return entries


def demo_today(entries: list[dict[str, Any]]) -> dict[str, Any]:
    return entries[-1]
