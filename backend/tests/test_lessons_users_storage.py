from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.services.auth_service import create_email_verification_token
from app.services.storage import materialize_audio_path
from app.services.session_store import load_session


def _auth_headers(client: TestClient, email: str) -> dict[str, str]:
    from app.api import auth as auth_api

    auth_api.send_verification_email = lambda *_args, **_kwargs: None
    client.post("/auth/register", json={"email": email, "password": "secret123"})
    verify_token = create_email_verification_token(email)
    if verify_token:
        client.post("/auth/verify-email", json={"token": verify_token})
    login = client.post("/auth/login", json={"email": email, "password": "secret123"})
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_lessons_list_and_get_not_found():
    client = TestClient(app)
    listed = client.get("/lessons")
    assert listed.status_code == 200
    assert "items" in listed.json()

    missing = client.get("/lessons/nope")
    assert missing.status_code == 404


def test_users_history_and_trends():
    client = TestClient(app)
    headers = _auth_headers(client, "trend@example.com")

    history = client.get("/users/me/history", headers=headers)
    assert history.status_code == 200

    trends = client.get("/users/me/trends", headers=headers)
    assert trends.status_code == 200
    payload = trends.json()
    assert set(payload.keys()) == {
        "trend",
        "consistency",
        "achievements",
        "today_minutes",
        "daily_target_minutes",
    }
    assert set(payload["trend"].keys()) == {"overall", "pronunciation", "fluency"}
    assert isinstance(payload["consistency"], list)
    assert isinstance(payload["achievements"], list)
    assert isinstance(payload["today_minutes"], int)
    assert isinstance(payload["daily_target_minutes"], int)


def test_materialize_audio_returns_none_for_missing_asset():
    assert materialize_audio_path("db://audio/asset-missing") is None


def test_load_session_legacy_file_migration(monkeypatch, tmp_path: Path):
    session_id = "session-legacy-test"
    path = tmp_path / f"{session_id}.json"
    data = {
        "session_id": session_id,
        "user_id": "u1",
        "lesson_id": "lesson-1",
        "expected_text": "hello",
        "status": "created",
    }
    path.write_text(json.dumps(data), encoding="utf-8")

    monkeypatch.setattr("app.services.session_store.SESSION_DIR", tmp_path)

    loaded = load_session(session_id)
    assert loaded is not None
    assert loaded["session_id"] == session_id
