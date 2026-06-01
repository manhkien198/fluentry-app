from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.services.auth_service import create_email_verification_token


def _register_verify_login(client: TestClient, email: str = "edge@example.com") -> dict[str, str]:
    from app.api import auth as auth_api

    auth_api.send_verification_email = lambda *_args, **_kwargs: None
    client.post("/auth/register", json={"email": email, "password": "secret123"})
    token = create_email_verification_token(email)
    if token:
        client.post("/auth/verify-email", json={"token": token})
    login = client.post("/auth/login", json={"email": email, "password": "secret123"})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_auth_register_duplicate_email_returns_400():
    client = TestClient(app)
    from app.api import auth as auth_api
    from uuid import uuid4

    auth_api.send_verification_email = lambda *_args, **_kwargs: None
    email = f"dup-{uuid4()}@example.com"
    r1 = client.post("/auth/register", json={"email": email, "password": "secret123"})
    assert r1.status_code == 200
    r2 = client.post("/auth/register", json={"email": email, "password": "secret123"})
    assert r2.status_code == 400


def test_auth_resend_verification_not_found_and_rate_limited(monkeypatch):
    client = TestClient(app)
    from app.api import auth as auth_api

    monkeypatch.setattr(auth_api, "allow_request", lambda *_args, **_kwargs: True)
    not_found = client.post("/auth/resend-verification", json={"email": "nope@example.com"})
    assert not_found.status_code == 404

    monkeypatch.setattr(auth_api, "allow_request", lambda *_args, **_kwargs: False)
    limited = client.post("/auth/resend-verification", json={"email": "x@example.com"})
    assert limited.status_code == 429


def test_auth_verify_email_invalid_token():
    client = TestClient(app)
    invalid = client.post("/auth/verify-email", json={"token": "invalid-token"})
    assert invalid.status_code == 400


def test_practice_upload_invalid_type_too_large_and_not_found(monkeypatch):
    client = TestClient(app)
    headers = _register_verify_login(client, "uploadedge@example.com")

    create = client.post(
        "/practice/sessions",
        json={"lesson_id": "lesson-1", "expected_text": "hello world"},
        headers=headers,
    )
    assert create.status_code == 200
    session_id = create.json()["session_id"]

    not_found = client.post(
        "/practice/sessions/session-does-not-exist/upload-audio",
        files={"file": ("a.m4a", b"x", "audio/m4a")},
        headers=headers,
    )
    assert not_found.status_code == 404

    invalid_type = client.post(
        f"/practice/sessions/{session_id}/upload-audio",
        files={"file": ("a.txt", b"x", "text/plain")},
        headers=headers,
    )
    assert invalid_type.status_code == 400

    monkeypatch.setattr("app.api.practice.allow_request", lambda *_args, **_kwargs: True)
    too_large = client.post(
        f"/practice/sessions/{session_id}/upload-audio",
        files={"file": ("a.m4a", b"x" * (15 * 1024 * 1024 + 1), "audio/m4a")},
        headers=headers,
    )
    assert too_large.status_code == 413


def test_practice_score_not_found_and_existing_failed_task(monkeypatch):
    client = TestClient(app)
    headers = _register_verify_login(client, "scoreedge@example.com")

    missing = client.post("/practice/sessions/nope/score", headers=headers)
    assert missing.status_code == 404

    create = client.post(
        "/practice/sessions",
        json={"lesson_id": "lesson-1", "expected_text": "hello world"},
        headers=headers,
    )
    session_id = create.json()["session_id"]

    upload = client.post(
        f"/practice/sessions/{session_id}/upload-audio",
        files={"file": ("a.m4a", b"audio", "audio/m4a")},
        headers=headers,
    )
    assert upload.status_code == 200

    from app.services.session_store import load_session, save_session

    s = load_session(session_id)
    s["score_task_id"] = "task-existing"
    s["score_status"] = "queued"
    save_session(session_id, s)

    class FailedResult:
        def successful(self):
            return False

        def failed(self):
            return True

    class DummyTask:
        id = "task-new"

        @staticmethod
        def AsyncResult(_task_id: str):
            return FailedResult()

        @staticmethod
        def delay(_session_id: str):
            return DummyTask()

    monkeypatch.setattr("app.api.practice.run_practice_scoring", DummyTask)

    response = client.post(f"/practice/sessions/{session_id}/score", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "failed"
