from datetime import date, timedelta

from pulse import analytics


def make_entry(day: str, **values):
    return {"day": day, "values": values, "source": "test"}


def day_str(offset: int, end: str = "2026-05-10") -> str:
    return (date.fromisoformat(end) - timedelta(days=offset)).isoformat()


def test_rings_cap_at_one():
    entry = make_entry(
        "2026-05-10",
        sleep_hours=8,
        steps=40000,
        gym=5,
        greens=True,
        alcohol=0,
        outdoor=120,
        deep_blocks=9,
        learned=True,
        read=True,
        screen_hours=0.5,
        pickups=8,
        avoid_habit=True,
    )
    history = [make_entry(day_str(i), avoid_habit=True, gym=1) for i in range(1, 15)]
    scores = analytics.build_day_scores(history + [entry])
    day = scores["2026-05-10"]
    for category, value in day.categories.items():
        assert value is not None
        assert 0.0 <= value <= 1.0
    assert 0.0 <= day.total <= 1.0
    assert day.total > 0.9


def test_skipped_fields_are_dropped_not_penalised():
    sparse = analytics.build_day_scores([make_entry("2026-05-10", sleep_hours=8)])
    scored = sparse["2026-05-10"]
    assert scored.categories["body"] == 1.0
    assert "steps" not in scored.metrics


def test_weekly_gym_uses_the_trailing_week():
    history = [make_entry(day_str(i), gym=1 if i < 2 else 0) for i in range(0, 7)]
    scores = analytics.build_day_scores(history)
    today = scores["2026-05-10"]
    # Two sessions in the trailing week: 2 / 2.5
    assert today.metrics["gym"] == 0.8


def test_alcohol_defaults_to_perfect_when_unlogged():
    scores = analytics.build_day_scores([make_entry("2026-05-10", sleep_hours=7.5)])
    assert scores["2026-05-10"].metrics["alcohol"] == 1.0


def test_alcohol_week_dents_the_body_ring():
    history = [make_entry(day_str(i), alcohol=3) for i in range(1, 7)]
    today = analytics.build_day_scores(history + [make_entry("2026-05-10", alcohol=3)])
    assert today["2026-05-10"].metrics["alcohol"] == 0.0


def test_avoid_habit_reads_the_fortnight():
    good = [make_entry(day_str(i), avoid_habit=True) for i in range(0, 14)]
    scores = analytics.build_day_scores(good)
    assert scores["2026-05-10"].metrics["avoid_habit"] == 1.0

    mixed = [make_entry(day_str(i), avoid_habit=i > 6) for i in range(0, 14)]
    scores = analytics.build_day_scores(mixed)
    assert scores["2026-05-10"].metrics["avoid_habit"] < 1.0


def test_focus_line_points_at_the_weakest_ring():
    scores = analytics.build_day_scores(
        [
            make_entry(
                "2026-05-10",
                sleep_hours=8,
                steps=10000,
                greens=True,
                outdoor=30,
                deep_blocks=3,
                learned=True,
                read=True,
                screen_hours=7.5,
                pickups=200,
            )
        ]
    )
    focus = analytics.focus_line(scores["2026-05-10"])
    assert focus is not None
    assert focus["category"] == "attention"
    assert "screen" in focus["line"].lower()


def test_weekly_progress_reads_toward_targets():
    history = [make_entry(day_str(i), gym=1 if i < 3 else 0, avoid_habit=i > 3) for i in range(0, 30)]
    cards = {c["id"]: c for c in analytics.weekly_progress(history, "2026-05-10")}
    assert cards["gym"]["count"] == 3
    assert cards["gym"]["progress"] == 1.0
    assert cards["avoid_habit"]["count"] == 26


def test_trends_compare_windows():
    entries = []
    for offset in range(0, 60):
        worse_now = offset < 30
        entries.append(
            make_entry(day_str(offset), sleep_hours=6.4 if worse_now else 8.4, mood=2 if worse_now else 5)
        )
    scores = analytics.build_day_scores(entries)
    rows = {t.key: t for t in analytics.trends(entries, scores, days=30)}
    sleep = rows["sleep_hours"]
    assert sleep.direction == "down"
    assert sleep.polarity == "watch"
    assert "against the previous 30 days" in sleep.sentence


def test_screen_time_trend_up_is_a_warning():
    entries = []
    for offset in range(0, 60):
        entries.append(make_entry(day_str(offset), screen_hours=6.5 if offset < 30 else 2.5))
    scores = analytics.build_day_scores(entries)
    rows = {t.key: t for t in analytics.trends(entries, scores, days=30)}
    assert rows["screen_hours"].direction == "up"
    assert rows["screen_hours"].polarity == "watch"
