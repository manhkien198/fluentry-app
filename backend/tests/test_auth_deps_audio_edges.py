from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import HTTPException

from app.api import auth as auth_api
from app.api import deps as deps_api
from app.services.pronunciation import audio_prep


def test_get_current_user_missing_and_bad_tokens(monkeypatch):
  with pytest.raises(HTTPException) as e1:
    deps_api.get_current_user(None)
  assert e1.value.status_code == 401

  with pytest.raises(HTTPException) as e2:
    deps_api.get_current_user("Basic x")
  assert e2.value.status_code == 401

  monkeypatch.setattr(deps_api, "decode_access_token", lambda _t: (_ for _ in ()).throw(ValueError("bad")))
  with pytest.raises(HTTPException) as e3:
    deps_api.get_current_user("Bearer x")
  assert e3.value.status_code == 401


def test_get_current_user_invalid_payload_and_missing_user(monkeypatch):
  monkeypatch.setattr(deps_api, "decode_access_token", lambda _t: {})
  with pytest.raises(HTTPException) as e1:
    deps_api.get_current_user("Bearer x")
  assert e1.value.status_code == 401

  monkeypatch.setattr(deps_api, "decode_access_token", lambda _t: {"sub": "u1"})
  monkeypatch.setattr(deps_api, "get_user_by_id", lambda _id: None)
  with pytest.raises(HTTPException) as e2:
    deps_api.get_current_user("Bearer x")
  assert e2.value.status_code == 401


def test_register_success_returns_auth_response(monkeypatch):
  class User:
    id = "u1"
    email = "a@example.com"
    display_name = "Learner"

  class Row(User):
    email_verified = "false"

  class DB:
    def get(self, _m, _id):
      return Row()

    def commit(self):
      pass

    def refresh(self, _row):
      pass

    def __enter__(self):
      return self

    def __exit__(self, *args):
      return False

  monkeypatch.setattr(auth_api, "allow_request", lambda *_a, **_k: True)
  monkeypatch.setattr(auth_api, "create_user", lambda *_a, **_k: User())
  monkeypatch.setattr(auth_api, "SessionLocal", lambda: DB())
  monkeypatch.setattr(auth_api, "create_access_token", lambda *_a, **_k: "at")
  monkeypatch.setattr(auth_api, "create_refresh_token", lambda *_a, **_k: "rt")

  out = auth_api.register(type("Req", (), {"email": "a@example.com", "password": "secret123"})())
  assert out.access_token == "at"
  assert out.refresh_token == "rt"
  assert out.user.email == "a@example.com"


def test_sso_login_dev_and_prod_exception_paths(monkeypatch):
  req = type("Req", (), {"provider": "google", "id_token": "x.y.z"})()
  monkeypatch.setattr(auth_api, "allow_request", lambda *_a, **_k: True)
  monkeypatch.setattr(auth_api, "decode_sso_claims", lambda **_k: (_ for _ in ()).throw(ValueError("bad token")))

  monkeypatch.setattr(auth_api, "APP_ENV", "development")
  with pytest.raises(HTTPException) as dev_err:
    auth_api.sso_login(req)
  assert dev_err.value.status_code == 401
  assert "bad token" in str(dev_err.value.detail)

  monkeypatch.setattr(auth_api, "APP_ENV", "production")
  with pytest.raises(HTTPException) as prod_err:
    auth_api.sso_login(req)
  assert prod_err.value.status_code == 401
  assert prod_err.value.detail == "Invalid SSO token"


def test_login_invalid_credentials_and_metrics(monkeypatch):
  monkeypatch.setattr(auth_api, "allow_request", lambda *_a, **_k: True)
  monkeypatch.setattr(auth_api, "authenticate_user", lambda *_a, **_k: None)
  with pytest.raises(HTTPException) as e:
    auth_api.login(type("Req", (), {"email": "u@example.com", "password": "x"})())
  assert e.value.status_code == 401


def test_login_allows_previously_unverified_user_and_register_rate_limited(monkeypatch):
  class User:
    id = "u1"
    email = "u@example.com"
    display_name = "U"
    email_verified = "false"

  monkeypatch.setattr(auth_api, "allow_request", lambda *_a, **_k: True)
  monkeypatch.setattr(auth_api, "authenticate_user", lambda *_a, **_k: User())
  monkeypatch.setattr(auth_api, "create_access_token", lambda *_a, **_k: "at")
  monkeypatch.setattr(auth_api, "create_refresh_token", lambda *_a, **_k: "rt")
  req = type("Req", (), {"email": "u@example.com", "password": "x"})()
  out = auth_api.login(req)
  assert out.access_token == "at"
  assert out.refresh_token == "rt"

  monkeypatch.setattr(auth_api, "allow_request", lambda *_a, **_k: False)
  with pytest.raises(HTTPException) as e2:
    auth_api.register(req)
  assert e2.value.status_code == 429


def test_register_create_user_value_error_and_resend_success(monkeypatch):
  req = type("Req", (), {"email": "u@example.com", "password": "x"})()
  monkeypatch.setattr(auth_api, "allow_request", lambda *_a, **_k: True)

  def _raise(*_a, **_k):
    raise ValueError("exists")

  monkeypatch.setattr(auth_api, "create_user", _raise)
  with pytest.raises(HTTPException) as e1:
    auth_api.register(req)
  assert e1.value.status_code == 400

  monkeypatch.setattr(auth_api, "create_user", lambda *_a, **_k: type("User", (), {"email": "u@example.com"})())
  monkeypatch.setattr(auth_api, "SessionLocal", lambda: type("DB", (), {"get": lambda *_a, **_k: None, "__enter__": lambda s: s, "__exit__": lambda s, *a: False})())
  monkeypatch.setattr(auth_api, "create_email_verification_token", lambda _e: "tok")
  sent = {"ok": False}
  monkeypatch.setattr(auth_api, "send_verification_email", lambda *_a, **_k: sent.__setitem__("ok", True))
  out = auth_api.resend_verification(type("Req", (), {"email": "u@example.com"})())
  assert out["status"] == "sent"
  assert sent["ok"] is True


def test_sso_login_rate_limited(monkeypatch):
  req = type("Req", (), {"provider": "google", "id_token": "x"})()
  monkeypatch.setattr(auth_api, "allow_request", lambda *_a, **_k: False)
  with pytest.raises(HTTPException) as e:
    auth_api.sso_login(req)
  assert e.value.status_code == 429


def test_refresh_success_and_logout(monkeypatch):
  user = {"id": "u1", "email": "u@example.com", "display_name": "U"}
  monkeypatch.setattr(auth_api, "rotate_refresh_token", lambda _t: user)
  monkeypatch.setattr(auth_api, "create_access_token", lambda _id, _email: "at")
  monkeypatch.setattr(auth_api, "create_refresh_token", lambda _id: "rt2")

  out = auth_api.refresh(type("Req", (), {"refresh_token": "rt"})())
  assert out.user.email == "u@example.com"

  called = {"ok": False}
  monkeypatch.setattr(auth_api, "revoke_refresh_token", lambda _t: called.__setitem__("ok", True))
  out2 = auth_api.logout(type("Req", (), {"refresh_token": "rt"})())
  assert out2["status"] == "ok"
  assert called["ok"] is True


def test_verify_email_success(monkeypatch):
  monkeypatch.setattr(auth_api, "verify_email_token", lambda _t: object())
  out = auth_api.verify_email(type("Req", (), {"token": "tok"})())
  assert out["status"] == "verified"


def test_sso_login_missing_email_and_success(monkeypatch):
  monkeypatch.setattr(auth_api, "allow_request", lambda *_a, **_k: True)

  req = type("Req", (), {"provider": "google", "id_token": "x"})()
  monkeypatch.setattr(auth_api, "decode_sso_claims", lambda **_k: {"name": "N"})
  with pytest.raises(HTTPException) as e1:
    auth_api.sso_login(req)
  assert e1.value.status_code == 401

  class User:
    id = "u1"
    email = "u@example.com"
    display_name = "D"

  monkeypatch.setattr(auth_api, "decode_sso_claims", lambda **_k: {"email": "u@example.com", "name": 1, "aud": "a", "iss": "i"})
  monkeypatch.setattr(auth_api, "get_or_create_sso_user", lambda **_k: User())
  monkeypatch.setattr(auth_api, "create_access_token", lambda *_a, **_k: "at")
  monkeypatch.setattr(auth_api, "create_refresh_token", lambda *_a, **_k: "rt")
  out = auth_api.sso_login(req)
  assert out.user.display_name == "D"


def test_practice_score_processing_done_failed_and_result_done(monkeypatch):
  from app.api import practice as practice_api

  class User:
    id = "u1"

  session = {
    "session_id": "s1",
    "audio_path": "db://audio/a",
    "score_status": "processing",
    "score_task_id": None,
    "score_result": None,
  }
  monkeypatch.setattr(practice_api, "allow_request", lambda *_a, **_k: True)
  monkeypatch.setattr(practice_api, "load_session", lambda _sid, user_id=None: dict(session))

  out = practice_api.score_session("s1", current_user=User())
  assert out.status == "processing"

  session_done = dict(session)
  session_done["score_status"] = "done"
  session_done["score_result"] = {
    "session_id": "s1",
    "overall_score": 90,
    "pronunciation_score": 90,
    "fluency_score": 90,
    "words": [],
    "phonemes": [],
    "tips": [],
    "analysis": {
      "alignment_status": "ok",
      "word_count": 1,
      "estimated_duration_ms": 1000,
      "phoneme_preview": [],
      "audio_path": "a",
      "audio_detected": True,
    },
  }
  monkeypatch.setattr(practice_api, "load_session", lambda _sid, user_id=None: dict(session_done))
  out2 = practice_api.score_session("s1", current_user=User())
  assert out2.status == "done"

  class Failed:
    def successful(self):
      return False

    def failed(self):
      return True

  class Task:
    id = "new"

    @staticmethod
    def AsyncResult(_id):
      return Failed()

    @staticmethod
    def delay(_sid):
      return Task()

  session_task = dict(session)
  session_task["score_task_id"] = "old"
  monkeypatch.setattr(practice_api, "load_session", lambda _sid, user_id=None: dict(session_task))
  monkeypatch.setattr(practice_api, "run_practice_scoring", Task)
  monkeypatch.setattr(practice_api, "save_session", lambda *_a, **_k: None)
  out3 = practice_api.score_session("s1", current_user=User())
  assert out3.status in {"failed", "processing"}

  monkeypatch.setattr(practice_api, "load_session", lambda _sid, user_id=None: dict(session_done))
  out4 = practice_api.get_result("s1", current_user=User())
  assert out4.status == "done"


def test_practice_upload_rate_limit_and_result_processing(monkeypatch):
  from app.api import practice as practice_api

  class User:
    id = "u1"

  monkeypatch.setattr(practice_api, "load_session", lambda *_a, **_k: {"session_id": "s1"})
  monkeypatch.setattr(practice_api, "allow_request", lambda *_a, **_k: False)

  class Upload:
    content_type = "audio/m4a"
    filename = "a.m4a"

    async def read(self):
      return b"a"

  with pytest.raises(HTTPException) as e1:
    import anyio

    anyio.run(practice_api.upload_audio, "s1", Upload(), User())
  assert e1.value.status_code == 429

  monkeypatch.setattr(practice_api, "load_session", lambda *_a, **_k: {"score_status": "queued"})
  out = practice_api.get_result("s1", current_user=User())
  assert out.status == "processing"


def test_practice_create_and_score_task_successful_branch(monkeypatch):
  from app.api import practice as practice_api

  class User:
    id = "u1"

  saved = []
  monkeypatch.setattr(practice_api, "uuid4", lambda: "x")
  monkeypatch.setattr(practice_api, "save_session", lambda sid, payload: saved.append((sid, payload)))
  out = practice_api.create_session(type("Req", (), {"lesson_id": "l1", "expected_text": "e"})(), current_user=User())
  assert out.session_id == "session-x"

  done_result = {
    "session_id": "s1",
    "overall_score": 80,
    "pronunciation_score": 81,
    "fluency_score": 82,
    "words": [],
    "phonemes": [],
    "tips": [],
    "analysis": {
      "alignment_status": "ok",
      "word_count": 1,
      "estimated_duration_ms": 1000,
      "phoneme_preview": [],
      "audio_path": "a",
      "audio_detected": True,
    },
  }
  session = {"session_id": "s1", "audio_path": "a", "score_status": "done", "score_task_id": "t1", "score_result": done_result}

  class Success:
    def successful(self):
      return True

    def failed(self):
      return False

  class Task:
    id = "new"

    @staticmethod
    def AsyncResult(_id):
      return Success()

    @staticmethod
    def delay(_sid):
      return Task()

  monkeypatch.setattr(practice_api, "allow_request", lambda *_a, **_k: True)
  monkeypatch.setattr(practice_api, "load_session", lambda *_a, **_k: dict(session))
  monkeypatch.setattr(practice_api, "run_practice_scoring", Task)
  out2 = practice_api.score_session("s1", current_user=User())
  assert out2.status == "done"


def test_prepare_audio_ffmpeg_path_exists_but_conversion_fails_falls_back_copy(monkeypatch, tmp_path: Path):
  src = tmp_path / "x.m4a"
  src.write_bytes(b"abc")
  out = tmp_path / "out"
  fake_ffmpeg = tmp_path / "ffmpeg"
  fake_ffmpeg.write_text("", encoding="utf-8")

  monkeypatch.setattr(audio_prep, "FFMPEG_BINARY", str(fake_ffmpeg))

  class Completed:
    returncode = 1
    stdout = ""
    stderr = "err"

  monkeypatch.setattr(audio_prep.subprocess, "run", lambda *_a, **_k: Completed())

  prepared, info = audio_prep.prepare_audio_for_alignment(str(src), out)
  assert prepared is not None
  assert Path(prepared).exists()
  assert info["reason"] == "copied_without_ffmpeg"
