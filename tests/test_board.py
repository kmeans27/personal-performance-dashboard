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
    "wake_time": "06:30",
    "deep_blocks": 3,
    "learned": True,
    "learned_what": "A one-line note",
    "read": True,
    "mood": 5,
    "energy": 4,
    "screen_hours": 2.5,
    "pickups": 44,
    "avoid_habit": True,
    "connect": 1,
}

CHARTS = {"gauge", "bar", "segments", "switch", "scale", "clock", "value"}


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
        assert 1 <= tile["size"] <= 3
        assert tile["fields"], f"{tile['id']} draws from no field"


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
    assert rhythm["display"] == "22:45 → 06:30"

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
    assert weight["sub"] == "Goal 82 kg"


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
