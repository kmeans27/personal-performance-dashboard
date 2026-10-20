"""The board: every field on one screen, sized by importance, drawn by chart."""

from datetime import date, timedelta

FULL_DAY = {
    "sleep_hours": 7.75,
    "steps": 11200,
    "gym": 1,
    "greens": True,
    "alcohol": 1,
    "outdoor": 30,
    "weight_kg": 87,
    "creatine": True,
    "bed_time": "22:45",
    "deep_blocks": 3,
    "learned": True,
    "learned_what": "A one-line note",
    "read": True,
    "mood": 5,
    "energy": 4,
    "screen_hours": 2.5,
    "pickups": 44,
    "avoid_habit": True,
}

CHARTS = {"range", "bar", "segments", "blocks", "switch", "scale", "bedtime"}


def tiles(client, day=None):
    day = day or date.today().isoformat()
    return client.get(f"/api/day/{day}").json()["board"]


def test_every_field_has_a_home_on_the_board(client):
    schema = client.get("/api/schema").json()
    board = schema["board"]
    covered = {field for tile in board for field in tile["fields"]}

    assert [tile["id"] for tile in board] == [tile["id"] for tile in board], "ids stay stable"
    assert len({tile["id"] for tile in board}) == len(board)
    for metric in schema["metrics"]:
        assert metric["id"] in covered, f"{metric['id']} is not on the board"
    for tile in board:
        assert tile["chart"] in CHARTS
        assert 1 <= tile["w"] <= 2
        assert tile["fields"], f"{tile['id']} draws from no field"


def test_every_band_packs_into_full_rows(client):
    """Two cards per row, and no column ends on a half-empty row: the board
    spends its space on fields, never on gaps."""
    board = client.get("/api/schema").json()["board"]

    for category in ("body", "mind", "attention"):
        width = 0
        for tile in board:
            if tile["category"] != category:
                continue
            width += tile["w"]
            if width == 2:
                width = 0
            assert width <= 2, f"{category} overflows a row at {tile['id']}"
        assert width == 0, f"{category} leaves a half-empty row"


def test_the_day_carries_the_week_around_it(client):
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    client.put(f"/api/day/{today.isoformat()}", json={"values": FULL_DAY})
    payload = client.get("/api/today").json()

    week = payload["week"]
    assert [entry["day"] for entry in week] == [
        (monday + timedelta(days=offset)).isoformat() for offset in range(7)
    ]
    this_week = week[today.weekday()]
    assert this_week["logged"] is True
    assert this_week["total"] == payload["score"]["total"]
    assert this_week["categories"] == payload["score"]["categories"]
    # The rest of the week is honestly empty, not a zero.
    assert all(
        entry["total"] is None for index, entry in enumerate(week) if index != today.weekday()
    )


def test_board_is_empty_until_something_is_logged(client):
    board = tiles(client)

    assert board["daily_logged"] == 0
    assert board["daily_total"] > 0
    assert board["complete"] is False
    assert all(tile["state"] == "empty" for tile in board["tiles"])
    assert all(tile["display"] is None for tile in board["tiles"])


def test_a_fully_logged_day_completes_the_board(client):
    day = date.today().isoformat()
    payload = client.put(f"/api/day/{day}", json={"values": FULL_DAY}).json()
    board = payload["board"]

    assert board["complete"] is True
    assert board["daily_logged"] == board["daily_total"]
    settled = [t for t in board["tiles"] if not t["weekly"] and not t["optional"]]
    assert all(tile["settled"] for tile in settled)
    assert payload["closing"]

    sleep = next(tile for tile in board["tiles"] if tile["id"] == "sleep")
    assert sleep["state"] == "done"
    assert sleep["display"] == "7.75"
    assert sleep["unit"] == "h"
    assert sleep["progress"] == 1.0

    rhythm = next(tile for tile in board["tiles"] if tile["id"] == "rhythm")
    assert rhythm["display"] == "22:45"
    assert rhythm["wake"] == 6 * 60 + 30

    learned = next(tile for tile in board["tiles"] if tile["id"] == "learned")
    assert learned["sub"] == "A one-line note"


def test_weekly_fields_never_show_a_daily_zero(client):
    board = tiles(client)
    gym = next(tile for tile in board["tiles"] if tile["id"] == "gym")
    alcohol = next(tile for tile in board["tiles"] if tile["id"] == "alcohol")

    # Nothing logged anywhere yet: not a zero, simply not being tracked.
    assert gym["weekly"] is True and alcohol["weekly"] is True
    assert gym["state"] == "empty" and gym["caption"] == "Not logged yet"
    assert alcohol["state"] == "empty"

    # A weekly tile never counts toward "logged today".
    weekly = {tile["id"] for tile in board["tiles"] if tile["weekly"]}
    assert weekly.isdisjoint(
        {tile["id"] for tile in board["tiles"] if not tile["weekly"] and not tile["optional"]}
    )

    # Once the week is being tracked, progress appears instead of a zero.
    day = date.today().isoformat()
    client.put(f"/api/day/{day}", json={"values": {"gym": 1}})
    board = tiles(client)
    gym = next(tile for tile in board["tiles"] if tile["id"] == "gym")
    assert gym["state"] == "open"
    assert gym["display"] == "1"
    assert gym["progress"] == 0.4  # one of two and a half sessions
    assert gym["filled"] == 1


def test_weight_is_optional_and_never_blocks_a_full_day(client):
    day = date.today().isoformat()
    values = {k: v for k, v in FULL_DAY.items() if k != "weight_kg"}
    board = client.put(f"/api/day/{day}", json={"values": values}).json()["board"]

    weight = next(tile for tile in board["tiles"] if tile["id"] == "weight")
    assert weight["optional"] is True
    assert weight["state"] == "empty"
    assert board["complete"] is True


def test_weight_goal_shows_when_settings_have_one(client):
    day = date.today().isoformat()
    client.patch("/api/settings", json={"weight_goal": 82})
    board = client.put(f"/api/day/{day}", json={"values": {"weight_kg": 87.4}}).json()["board"]

    weight = next(tile for tile in board["tiles"] if tile["id"] == "weight")
    assert weight["display"] == "87.4"
    assert weight["sub"] == "5.4 kg above goal"
    assert weight["goal"] == 82.0


def test_range_tiles_carry_their_axis_and_zone(client):
    board = tiles(client)
    sleep = next(tile for tile in board["tiles"] if tile["id"] == "sleep")
    screen = next(tile for tile in board["tiles"] if tile["id"] == "screen_hours")

    assert sleep["chart"] == "range"
    assert sleep["track"] == [0, 12]
    assert sleep["zone"] == [7, 9]
    assert screen["zone"] == [0, 3]


def test_tiles_carry_the_raw_values_they_draw_from(client):
    day = date.today().isoformat()
    client.put(f"/api/day/{day}", json={"values": {"bed_time": "22:45"}})
    board = tiles(client)

    rhythm = next(tile for tile in board["tiles"] if tile["id"] == "rhythm")
    assert rhythm["values"] == {"bed_time": "22:45"}


def test_every_card_prices_itself_against_the_ring(client):
    """A card knows what it is worth: its score out of ten, its weight in the
    category, and what is still on the table."""
    day = date.today().isoformat()
    board = client.put(f"/api/day/{day}", json={"values": {"sleep_hours": 7.5}}).json()["board"]

    sleep = next(tile for tile in board["tiles"] if tile["id"] == "sleep")
    assert sleep["weight"] == 0.26
    assert sleep["score"] == 1.0
    assert sleep["points"] == 10
    assert sleep["stake"] == 0.0

    steps = next(tile for tile in board["tiles"] if tile["id"] == "steps")
    assert steps["weight"] == 0.18
    assert steps["score"] is None
    assert steps["points"] is None
    assert steps["stake"] == round(0.18 * 100 / 3, 2)

    # The body weights add up to the third of the score the category is worth.
    body = [tile for tile in board["tiles"] if tile["category"] == "body" and tile["weight"]]
    assert round(sum(tile["weight"] for tile in body), 4) == 1.0


def test_unscored_cards_say_so(client):
    board = tiles(client)
    for tile_id in ("mood", "energy", "creatine", "weight"):
        tile = next(entry for entry in board["tiles"] if entry["id"] == tile_id)
        assert tile["weight"] is None
        assert tile["points"] is None
        assert tile["stake"] is None


def test_the_next_move_is_the_open_card_worth_the_most(client):
    day = date.today().isoformat()
    empty = tiles(client)
    # Nothing logged: the card worth most of the score is the one to open.
    assert empty["next_move"]["id"] == "deep_blocks"
    assert empty["next_move"]["points"] == 17
    assert empty["next_move"]["label"] == "Deep blocks"
    assert empty["next_move"]["line"]

    # Log three deep blocks and it is no longer a move, but the one after is.
    board = client.put(f"/api/day/{day}", json={"values": {"deep_blocks": 3}}).json()["board"]
    assert board["next_move"]["id"] != "deep_blocks"
    assert board["next_move"]["points"] <= 17


def test_gap_lines_say_where_today_sits(client):
    day = date.today().isoformat()
    board = client.put(
        f"/api/day/{day}",
        json={"values": {"sleep_hours": 6, "steps": 6000, "screen_hours": 4.5, "pickups": 71}},
    ).json()["board"]
    gap = {tile["id"]: tile["gap"] for tile in board["tiles"]}

    assert gap["sleep"] == "1h short of target"
    assert gap["steps"] == "3,000 to go"
    assert gap["screen_hours"] == "1.5h over your limit"
    assert gap["pickups"] == "11 over your limit"
    # An unlogged card states its target instead of inventing a gap.
    assert gap["outdoor"] == "20 min outside"


def test_a_card_carries_yesterday_and_the_usual(client):
    today = date.today()
    for offset in (1, 2, 3):
        client.put(
            f"/api/day/{(today - timedelta(days=offset)).isoformat()}",
            json={"values": {"sleep_hours": 6.0 + offset / 2, "mood": 3}},
        )
    board = client.put(
        f"/api/day/{today.isoformat()}", json={"values": {"sleep_hours": 7.5}}
    ).json()["board"]

    sleep = next(tile for tile in board["tiles"] if tile["id"] == "sleep")
    assert sleep["yesterday"] == 6.5
    mood = next(tile for tile in board["tiles"] if tile["id"] == "mood")
    assert mood["usual"] == 3.0
    assert sleep["usual"] == 7.0


def test_the_week_carries_yesterday_against_the_usual(client):
    today = date.today()
    for offset in range(1, 6):
        client.put(
            f"/api/day/{(today - timedelta(days=offset)).isoformat()}",
            json={"values": FULL_DAY},
        )
    payload = client.put(f"/api/day/{today.isoformat()}", json={"values": FULL_DAY}).json()

    compare = payload["compare"]
    assert compare["yesterday"] == payload["score"]["total"]
    assert compare["usual_days"] == 5
    # Five similar days: the usual is near today, never exactly it.
    assert abs(compare["usual"] - payload["score"]["total"]) < 0.02


def test_the_clean_day_card_carries_its_thirty_dashes(client):
    today = date.today()
    client.put(f"/api/day/{(today - timedelta(days=1)).isoformat()}", json={"values": {"avoid_habit": True}})
    board = client.put(f"/api/day/{today.isoformat()}", json={"values": {"avoid_habit": True}}).json()["board"]

    habit = next(tile for tile in board["tiles"] if tile["id"] == "avoid_habit")
    assert habit["chart"] == "bar"
    assert len(habit["days"]) == 30
    assert habit["days"][-1] == {"day": today.isoformat(), "clean": True}
    assert habit["days"][-2]["clean"] is True
    assert habit["days"][-3]["clean"] is False
    assert habit["gap"] == "2 of 30 days"


def test_habit_name_from_settings_reaches_the_tile(client):
    client.patch("/api/settings", json={"avoid_habit_name": "No scrolling in bed"})
    board = tiles(client)

    habit = next(tile for tile in board["tiles"] if tile["id"] == "avoid_habit")
    assert habit["label"] == "No scrolling in bed"


def test_weekly_progress_rides_along_with_the_tile(client):
    today = date.today()
    # Three sessions this week, and one drink on one of those days: the week is
    # full, and the alcohol tile reads the week, not today.
    client.put(f"/api/day/{(today - timedelta(days=1)).isoformat()}", json={"values": {"gym": 1, "alcohol": 1}})
    client.put(f"/api/day/{(today - timedelta(days=2)).isoformat()}", json={"values": {"gym": 1, "alcohol": 0}})
    client.put(f"/api/day/{(today - timedelta(days=3)).isoformat()}", json={"values": {"gym": 1}})
    day = today.isoformat()
    board = client.put(f"/api/day/{day}", json={"values": {"gym": 1}}).json()["board"]

    gym = next(tile for tile in board["tiles"] if tile["id"] == "gym")
    assert gym["filled"] == 3
    assert gym["progress"] == 1.0
    assert gym["state"] == "done"
    assert gym["caption"] == "Ring closed for the week."

    alcohol = next(tile for tile in board["tiles"] if tile["id"] == "alcohol")
    assert alcohol["cells"] == 7
    assert alcohol["display"] == "6"  # one drink in the last seven days
    assert alcohol["filled"] == 6
    assert alcohol["caption"] == "6 of the last seven days alcohol-free."


def test_day_payload_carries_the_board(client):
    for path in ("/api/day/2026-05-10", "/api/today"):
        payload = client.get(path).json()
        assert "board" in payload
        assert len(payload["board"]["tiles"]) == len(client.get("/api/schema").json()["board"])


def test_demo_board_is_complete(client):
    board = client.get("/api/demo/summary").json()["board"]

    assert board["complete"] is True
    assert board["daily_logged"] == board["daily_total"]
    assert all(tile["display"] is not None for tile in board["tiles"])


def test_the_bed_card_takes_one_entry_and_derives_the_wake_time(client):
    """You enter when you went to bed. The hour you got up is bed + slept: not a
    second thing to remember, and never stored."""
    day = date.today().isoformat()
    client.put(f"/api/day/{day}", json={"values": {"bed_time": "22:45", "sleep_hours": 7.5}})

    rhythm = next(tile for tile in tiles(client)["tiles"] if tile["id"] == "rhythm")
    assert rhythm["fields"] == ["bed_time"]
    assert rhythm["display"] == "22:45"
    assert rhythm["bed"] == 22 * 60 + 45
    assert rhythm["wake"] == 6 * 60 + 15
    assert rhythm["gap"] == "Up 06:15 · 7h 30m asleep"

    # Change the sleep, and the wake time moves with it.
    client.put(f"/api/day/{day}", json={"values": {"sleep_hours": 8}})
    rhythm = next(tile for tile in tiles(client)["tiles"] if tile["id"] == "rhythm")
    assert rhythm["wake"] == 6 * 60 + 45

    schema = client.get("/api/schema").json()
    assert "wake_time" not in {metric["id"] for metric in schema["metrics"]}


def test_the_bed_card_asks_for_sleep_before_it_promises_a_wake_time(client):
    day = date.today().isoformat()
    client.put(f"/api/day/{day}", json={"values": {"bed_time": "23:10"}})

    rhythm = next(tile for tile in tiles(client)["tiles"] if tile["id"] == "rhythm")
    assert rhythm["wake"] is None
    assert rhythm["gap"] == "Add slept hours for wake time"
    assert rhythm["settled"] is True


def test_the_bed_card_finds_your_usual_hour_around_midnight(client):
    """A mean of 23:30, 23:45, 00:15 and 23:00 is 23:37 — the short way round
    midnight, not 17:37."""
    anchor = date.today()
    for offset, bed in ((1, "23:30"), (2, "23:45"), (3, "00:15"), (4, "23:00")):
        day = (anchor - timedelta(days=offset)).isoformat()
        client.put(f"/api/day/{day}", json={"values": {"bed_time": bed}})

    rhythm = next(tile for tile in tiles(client)["tiles"] if tile["id"] == "rhythm")
    assert rhythm["usual_bed"] is not None
    assert 23 * 60 + 25 <= rhythm["usual_bed"] <= 23 * 60 + 50
    assert rhythm["yesterday_bed"] == 23 * 60 + 30


def test_every_card_hands_the_detail_editor_what_it_needs(client):
    """A card opens into a bigger control, so the payload carries the prompt,
    the help line, the step and the presets the editor draws."""
    board = tiles(client)
    sleep = next(tile for tile in board["tiles"] if tile["id"] == "sleep")
    assert sleep["input"] == "number"
    assert sleep["prompt"] == "How long did you sleep?"
    assert sleep["help"]
    assert sleep["presets"] == [6, 7, 7.5, 8, 9]
    assert sleep["min"] == 0
    assert sleep["max"] == 12
    assert sleep["step"] == 0.25


def test_the_weekly_editor_sees_the_same_seven_days_the_score_counts(client):
    """Gym and alcohol are scored over the trailing week, so their detail
    editor is handed that exact week — oldest first, today last."""
    anchor = date.today()
    for offset, drinks in ((0, 0), (1, 2), (3, 1)):
        day = (anchor - timedelta(days=offset)).isoformat()
        client.put(f"/api/day/{day}", json={"values": {"alcohol": drinks}})

    alcohol = next(tile for tile in tiles(client)["tiles"] if tile["id"] == "alcohol")
    week = alcohol["week_days"]
    assert len(week) == 7
    assert week[-1]["day"] == anchor.isoformat()
    assert week[-1]["today"] is True
    assert week[0]["day"] == (anchor - timedelta(days=6)).isoformat()
    assert [entry["future"] for entry in week] == [False] * 7
    values = {entry["day"]: entry["value"] for entry in week}
    assert values[(anchor - timedelta(days=1)).isoformat()] == 2
    assert values[(anchor - timedelta(days=3)).isoformat()] == 1
    assert values[anchor.isoformat()] == 0


def test_only_the_weekly_cards_carry_their_days(client):
    board = tiles(client)["tiles"]
    weekly = {tile["id"] for tile in board if tile["week_days"] is not None}
    assert weekly == {"gym", "alcohol"}
