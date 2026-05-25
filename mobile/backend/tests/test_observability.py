from fastapi.testclient import TestClient

from app.main import app
from app import main as main_module
from app.services.runtime_metrics import reset


def setup_function():
    reset()


def test_health_and_ready_endpoints():
    client = TestClient(app)
    health = client.get("/health")
    ready = client.get("/ready")

    assert health.status_code == 200
    assert health.json() == {"status": "ok"}
    assert ready.status_code == 200
    assert ready.json() == {"status": "ready"}


def test_request_id_header_passthrough():
    client = TestClient(app)
    response = client.get("/health", headers={"X-Request-Id": "req-custom-123"})

    assert response.status_code == 200
    assert response.headers.get("X-Request-Id") == "req-custom-123"


def test_request_id_header_generated_when_missing():
    client = TestClient(app)
    response = client.get("/health")

    assert response.status_code == 200
    generated = response.headers.get("X-Request-Id")
    assert generated is not None
    assert generated.startswith("req-")


def test_security_headers_present():
    client = TestClient(app)
    response = client.get("/health")

    assert response.status_code == 200
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("Referrer-Policy") == "no-referrer"
    assert response.headers.get("Cache-Control") == "no-store"


def test_large_payload_rejected_for_auth_and_practice_paths():
    client = TestClient(app)
    headers = {"content-length": str(2 * 1024 * 1024)}

    login = client.post("/auth/login", headers=headers, json={"email": "a@example.com", "password": "secret123"})
    assert login.status_code == 413
    assert login.json() == {"detail": "Payload too large"}

    score = client.post("/practice/sessions/session-1/score", headers=headers)
    assert score.status_code == 413
    assert score.json() == {"detail": "Payload too large"}


def test_metrics_endpoint_reports_counters():
    client = TestClient(app)
    client.post("/auth/login", json={"email": "unknown@example.com", "password": "badpass"})
    metrics = client.get("/metrics")

    assert metrics.status_code == 200
    payload = metrics.json()
    assert "counters" in payload
    assert payload["counters"].get("auth.login.failed", 0) >= 1


def test_metrics_endpoint_requires_token_when_configured(monkeypatch):
    monkeypatch.setattr(main_module, "METRICS_TOKEN", "secret-metrics-token")
    client = TestClient(app)
    unauthorized = client.get("/metrics")
    assert unauthorized.status_code == 401

    authorized = client.get("/metrics", headers={"X-Metrics-Token": "secret-metrics-token"})
    assert authorized.status_code == 200


def test_content_version_endpoint():
    client = TestClient(app)
    response = client.get("/content/version")
    assert response.status_code == 200
    payload = response.json()
    assert "content_version" in payload
    assert "content_checksum" in payload
