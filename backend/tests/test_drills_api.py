from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_drills_list_supports_filters_and_limit():
    client = TestClient(app)

    all_items = client.get("/drills")
    assert all_items.status_code == 200
    payload = all_items.json()
    assert "items" in payload

    limited = client.get("/drills", params={"limit": 1})
    assert limited.status_code == 200
    assert len(limited.json()["items"]) <= 1

    by_sound = client.get("/drills", params={"sound": "th"})
    assert by_sound.status_code == 200
    for item in by_sound.json()["items"]:
        assert item["sound"] == "TH"

    by_mode = client.get("/drills", params={"mode": "repeat"})
    assert by_mode.status_code == 200
    for item in by_mode.json()["items"]:
        assert item["mode"] == "repeat"


def test_drills_list_returns_empty_for_unmatched_filters():
    client = TestClient(app)

    response = client.get("/drills", params={"sound": "ZZZ", "mode": "nonexistent"})
    assert response.status_code == 200
    assert response.json()["items"] == []
