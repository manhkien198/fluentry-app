from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.services.auth_service import decode_access_token
from app.services.auth_service import create_email_verification_token
from app.services.session_store import save_session


def _auth_headers(client: TestClient, email: str = "test@example.com") -> tuple[dict[str, str], str]:
    client.post("/auth/register", json={"email": email, "password": "secret123"})
    verify_token = create_email_verification_token(email)
    if verify_token:
        client.post("/auth/verify-email", json={"token": verify_token})
    else:
        resend = client.post("/auth/resend-verification", json={"email": email})
        if resend.status_code != 200:
            raise RuntimeError("Unable to generate verification token for test account")
        token = create_email_verification_token(email)
        client.post("/auth/verify-email", json={"token": token})
    login = client.post("/auth/login", json={"email": email, "password": "secret123"})
    token = login.json()["access_token"]
    user_id = decode_access_token(token)["sub"]
    return {"Authorization": f"Bearer {token}"}, user_id


def test_practice_session_create_upload_score_and_result(monkeypatch):
    client = TestClient(app)
    headers, _user_id = _auth_headers(client, "flow@example.com")

    create_response = client.post(
        "/practice/sessions",
        json={"lesson_id": "lesson-1", "expected_text": "hello world"},
        headers=headers,
    )
    assert create_response.status_code == 200
    session_id = create_response.json()["session_id"]

    upload_response = client.post(
        f"/practice/sessions/{session_id}/upload-audio",
        files={"file": ("attempt.m4a", b"fake-audio", "audio/m4a")},
        headers=headers,
    )
    assert upload_response.status_code == 200
    assert upload_response.json()["status"] == "uploaded"

    class DummyAsyncResult:
        id = "task-1"

        def successful(self):
            return False

        def failed(self):
            return False

    class DummyTask:
        @staticmethod
        def delay(_session_id: str):
            return DummyAsyncResult()

        @staticmethod
        def AsyncResult(_task_id: str):
            return DummyAsyncResult()

    monkeypatch.setattr("app.api.practice.run_practice_scoring", DummyTask)

    score_response = client.post(f"/practice/sessions/{session_id}/score", headers=headers)
    assert score_response.status_code == 200
    assert score_response.json()["status"] == "processing"

    result_response = client.get(f"/practice/sessions/{session_id}/result", headers=headers)
    assert result_response.status_code == 200
    assert result_response.json()["status"] in {"processing", "failed", "done"}


def test_practice_score_requires_audio():
    client = TestClient(app)
    headers, _user_id = _auth_headers(client, "noaudio@example.com")

    create_response = client.post(
        "/practice/sessions",
        json={"lesson_id": "lesson-1", "expected_text": "hello world"},
        headers=headers,
    )
    assert create_response.status_code == 200
    session_id = create_response.json()["session_id"]

    score_response = client.post(f"/practice/sessions/{session_id}/score", headers=headers)
    assert score_response.status_code == 400
    assert score_response.json()["detail"] == "Audio not uploaded"


def test_practice_score_returns_done_when_result_available(monkeypatch):
    client = TestClient(app)
    headers, user_id = _auth_headers(client, "done@example.com")
    session_id = "session-done-test"
    save_session(
        session_id,
        {
            "session_id": session_id,
            "user_id": user_id,
            "lesson_id": "lesson-1",
            "expected_text": "hello world",
            "status": "uploaded",
            "audio_path": "/tmp/audio.m4a",
            "score_status": "done",
            "score_task_id": "task-1",
            "score_error": None,
            "score_result": {
                "session_id": session_id,
                "overall_score": 85,
                "pronunciation_score": 84,
                "fluency_score": 86,
                "words": [],
                "phonemes": [],
                "tips": [],
                "analysis": {
                    "alignment_status": "aligned",
                    "word_count": 2,
                    "estimated_duration_ms": 1200,
                    "phoneme_preview": [],
                    "audio_path": "/tmp/audio.m4a",
                    "audio_detected": True,
                },
            },
        },
    )

    score_response = client.post(f"/practice/sessions/{session_id}/score", headers=headers)
    assert score_response.status_code == 200
    assert score_response.json()["status"] == "done"
    assert score_response.json()["session_id"] == session_id

def test_practice_score_rate_limited(monkeypatch):
    client = TestClient(app)
    headers, _user_id = _auth_headers(client, "ratelimit-score@example.com")

    create_response = client.post(
        "/practice/sessions",
        json={"lesson_id": "lesson-1", "expected_text": "hello world"},
        headers=headers,
    )
    assert create_response.status_code == 200
    session_id = create_response.json()["session_id"]

    upload_response = client.post(
        f"/practice/sessions/{session_id}/upload-audio",
        files={"file": ("attempt.m4a", b"fake-audio", "audio/m4a")},
        headers=headers,
    )
    assert upload_response.status_code == 200

    monkeypatch.setattr("app.api.practice.allow_request", lambda *args, **kwargs: False)
    score_response = client.post(f"/practice/sessions/{session_id}/score", headers=headers)
    assert score_response.status_code == 429
    assert score_response.json()["detail"] == "Too many scoring requests"


def test_practice_result_returns_failed_payload():
    client = TestClient(app)
    headers, user_id = _auth_headers(client, "failed@example.com")
    session_id = "session-failed-test"
    save_session(
        session_id,
        {
            "session_id": session_id,
            "user_id": user_id,
            "lesson_id": "lesson-1",
            "expected_text": "hello world",
            "status": "uploaded",
            "audio_path": "/tmp/audio.m4a",
            "score_status": "failed",
            "score_task_id": "task-2",
            "score_error": "worker timeout",
            "score_result": None,
        },
    )

    result_response = client.get(f"/practice/sessions/{session_id}/result", headers=headers)
    assert result_response.status_code == 200
    assert result_response.json()["status"] == "failed"
    assert result_response.json()["error"] == "worker timeout"
