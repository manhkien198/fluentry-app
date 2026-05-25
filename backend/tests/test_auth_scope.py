from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.services.auth_service import create_email_verification_token


def _register_and_login(client: TestClient, email: str) -> dict[str, str]:
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
    return {"Authorization": f"Bearer {token}"}


def test_auth_register_login_and_protected_endpoint():
    client = TestClient(app)
    headers = _register_and_login(client, "auth1@example.com")

    progress = client.get("/users/me/progress", headers=headers)
    assert progress.status_code == 200


def test_refresh_and_logout_flow():
    client = TestClient(app)
    client.post("/auth/register", json={"email": "refresh@example.com", "password": "secret123"})
    verify_token = create_email_verification_token("refresh@example.com")
    if verify_token:
        client.post("/auth/verify-email", json={"token": verify_token})
    else:
        resend = client.post("/auth/resend-verification", json={"email": "refresh@example.com"})
        if resend.status_code == 200:
            client.post("/auth/verify-email", json={"token": resend.json().get("token", "")})
    login = client.post("/auth/login", json={"email": "refresh@example.com", "password": "secret123"})
    assert login.status_code == 200
    refresh_token = login.json()["refresh_token"]

    refreshed = client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert refreshed.status_code == 200
    new_refresh = refreshed.json()["refresh_token"]
    assert new_refresh != refresh_token

    logout = client.post("/auth/logout", json={"refresh_token": new_refresh})
    assert logout.status_code == 200

    reuse = client.post("/auth/refresh", json={"refresh_token": new_refresh})
    assert reuse.status_code == 401
    reused_old = client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert reused_old.status_code == 401

def test_refresh_rejects_invalid_token():
    client = TestClient(app)
    invalid = client.post("/auth/refresh", json={"refresh_token": "not-a-valid-token"})
    assert invalid.status_code == 401

def test_login_rate_limited(monkeypatch):
    client = TestClient(app)
    monkeypatch.setattr("app.api.auth.allow_request", lambda *args, **kwargs: False)
    response = client.post("/auth/login", json={"email": "rate@example.com", "password": "secret123"})
    assert response.status_code == 429


def test_sso_login_success():
    client = TestClient(app)
    id_token = "eyJhbGciOiJub25lIn0.eyJlbWFpbCI6InNzb3VzZXJAZXhhbXBsZS5jb20iLCJuYW1lIjoiU1NPIFVzZXIifQ."
    response = client.post("/auth/sso", json={"provider": "google", "id_token": id_token})
    assert response.status_code == 200
    payload = response.json()
    assert payload["access_token"]
    assert payload["refresh_token"]
    assert payload["user"]["email"] == "ssouser@example.com"


def test_sso_login_rejects_missing_email():
    client = TestClient(app)
    id_token = "eyJhbGciOiJub25lIn0.eyJuYW1lIjoiTm8gRW1haWwifQ."
    response = client.post("/auth/sso", json={"provider": "google", "id_token": id_token})
    assert response.status_code == 401


def test_sso_login_unsupported_provider():
    client = TestClient(app)
    response = client.post("/auth/sso", json={"provider": "github", "id_token": "x.y.z"})
    assert response.status_code == 400


def test_protected_endpoint_requires_bearer_token():
    client = TestClient(app)

    progress = client.get("/users/me/progress")
    assert progress.status_code == 401


def test_cross_user_session_access_is_forbidden():
    client = TestClient(app)
    user1 = _register_and_login(client, "u1@example.com")
    user2 = _register_and_login(client, "u2@example.com")

    create = client.post(
        "/practice/sessions",
        headers=user1,
        json={"lesson_id": "lesson-1", "expected_text": "hello world"},
    )
    assert create.status_code == 200
    session_id = create.json()["session_id"]

    other_user_access = client.get(f"/practice/sessions/{session_id}/result", headers=user2)
    assert other_user_access.status_code == 404
