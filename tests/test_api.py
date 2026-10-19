def test_schema_exposes_categories_and_fields(client):
    data = client.get("/api/schema").json()
    assert [c["id"] for c in data["categories"]] == ["body", "mind", "attention", "people"]
    assert any(m["id"] == "sleep_hours" for m in data["metrics"])


def test_write_and_read_a_day(client):
    payload = {"values": {"sleep_hours": 7.5, "deep_blocks": 3, "screen_hours": 3.25}}
    written = client.put("/api/day/2026-05-10", json=payload).json()
    assert written["logged"] is True
    assert written["score"]["total"] > 0
    read = client.get("/api/day/2026-05-10").json()
    assert read["values"]["deep_blocks"] == 3
    assert read["legend"][0]["id"] == "body"
    assert len(read["weekly"]) == 3


def test_partial_writes_merge(client):
    client.put("/api/day/2026-05-10", json={"values": {"sleep_hours": 7.5}})
    client.put("/api/day/2026-05-10", json={"values": {"read": True}})
    values = client.get("/api/day/2026-05-10").json()["values"]
    assert values["sleep_hours"] == 7.5
    assert values["read"] is True


def test_clear_a_field(client):
    client.put("/api/day/2026-05-10", json={"values": {"steps": 9000}})
    client.put("/api/day/2026-05-10", json={"values": {"steps": None}})
    assert "steps" not in client.get("/api/day/2026-05-10").json()["values"]


def test_range_and_import(client):
    imported = client.post(
        "/api/import",
        json={
            "days": [
                {"day": "2026-05-09", "values": {"steps": 8000, "sleep_hours": 7.25}},
                {"day": "2026-05-10", "values": {"steps": 10000, "sleep_hours": 8}},
            ]
        },
    ).json()
    assert imported["imported"] == 2
    data = client.get("/api/range", params={"start": "2026-05-01", "end": "2026-05-31"}).json()
    assert len(data["days"]) == 2
    assert data["days"][0]["total"] is not None


def test_today_works_without_any_data(client):
    data = client.get("/api/today").json()
    assert data["logged"] is False
    assert data["score"]["total"] is None
    assert len(data["legend"]) == 4


def test_settings_roundtrip(client):
    updated = client.patch("/api/settings", json={"avoid_habit_name": "No scrolling in bed"}).json()
    assert updated["avoid_habit_name"] == "No scrolling in bed"
    assert client.get("/api/settings").json()["avoid_habit_name"] == "No scrolling in bed"


def test_demo_endpoints(client):
    summary = client.get("/api/demo/summary").json()
    assert summary["demo"] is True
    assert summary["score"]["total"] > 0.5
    assert summary["insight"] is not None
    rng = client.get("/api/demo/range", params={"days": 90}).json()
    assert len(rng["days"]) == 90
    trends = client.get("/api/demo/trends").json()["trends"]
    assert any(t["key"] == "sleep_hours" for t in trends)
    assert client.get("/api/demo/insights").json()["ready"] is True


def test_insights_need_enough_data(client):
    client.put("/api/day/2026-05-10", json={"values": {"sleep_hours": 7.5, "mood": 4}})
    data = client.get("/api/insights").json()
    assert data["ready"] is False
    assert data["insights"] == []
