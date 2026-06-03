from __future__ import annotations

import importlib
import sys

import pytest
from fastapi import HTTPException

from app.api import practice as practice_api
from app.main import request_logging_middleware
from app.services import session_store
from app.services import user_metrics
from app.services.pronunciation import scorer
from app.tasks import practice_tasks


def test_practice_line_109_branch(monkeypatch):
  class User:
    id = "u1"

  done_result = {
    "session_id": "s1",
    "overall_score": 1,
    "pronunciation_score": 1,
    "fluency_score": 1,
    "words": [],
    "phonemes": [],
    "tips": [],
    "analysis": {"alignment_status": "ok", "word_count": 1, "estimated_duration_ms": 1, "phoneme_preview": [], "audio_path": "a", "audio_detected": True},
  }
  session = {"session_id": "s1", "audio_path": "a", "score_status": "done", "score_task_id": "t1", "score_result": done_result}

  class S:
    def successful(self):
      return True

    def failed(self):
      return False

  class T:
    @staticmethod
    def AsyncResult(_tid):
      return S()

    @staticmethod
    def delay(_sid):
      return type("D", (), {"id": "n"})()

  monkeypatch.setattr(practice_api, "allow_request", lambda *_a, **_k: True)
  monkeypatch.setattr(practice_api, "load_session", lambda *_a, **_k: dict(session))
  monkeypatch.setattr(practice_api, "run_practice_scoring", T)
  out = practice_api.score_session("s1", current_user=User())
  assert out.status == "done"


def test_config_line_63(monkeypatch):
  name = "app.core.config"
  old = sys.modules.pop(name, None)
  try:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("CORS_ALLOW_ORIGINS", "https://ok.com")
    monkeypatch.setenv("JWT_SECRET", "x" * 40)
    monkeypatch.setenv("METRICS_TOKEN", "m")
    monkeypatch.setenv("SSO_VERIFY_SIGNATURE", "true")
    monkeypatch.setenv("SSO_GOOGLE_AUDIENCE", "gaud")
    module = importlib.import_module(name)
    assert module.SSO_GOOGLE_AUDIENCE == "gaud"
  finally:
    sys.modules.pop(name, None)
    if old is not None:
      sys.modules[name] = old


def test_main_valueerror_content_length_branch(monkeypatch):
  class Req:
    headers = {"content-length": "nan", "X-Request-Id": "r1"}
    method = "POST"
    url = type("U", (), {"path": "/auth/login"})()

  class Resp:
    status_code = 200
    headers = {}

  async def call_next(_req):
    return Resp()

  import anyio

  resp = anyio.run(request_logging_middleware, Req(), call_next)
  assert resp.headers["X-Request-Id"] == "r1"


def test_lesson_rubric_r_branch_and_default_level():
  from app.services import lesson_rubric

  out = lesson_rubric.compute_lesson_rubric("Unknown", "random words with r sound")
  assert out.cefr == "B1"


def test_scorer_line_26_and_branches(monkeypatch):
  monkeypatch.setattr(
    scorer,
    "run_pronunciation_engine",
    lambda *_a, **_k: {
      "alignment": {
        "segments": [{"text": "x"}],
        "phones": [
          {"text": "AA", "word": "x", "start_ms": 0, "end_ms": 20},
          {"text": "HH", "word": "x", "start_ms": 21, "end_ms": 25},
        ],
        "alignment_status": "mfa",
        "engine_meta": {},
      },
      "phoneme_map": ["AA"],
      "features": {"audio_penalty": 0, "energy": 0.9, "rhythm": 0.9, "word_count": 1, "estimated_duration_ms": 100},
    },
  )
  out = scorer.score_pronunciation("s", "x", None)
  assert out["phonemes"]


def test_session_store_filter_false_branch(monkeypatch):
  class Row:
    session_id = "s"
    user_id = "u1"
    lesson_id = "l"
    expected_text = "e"
    status = "ok"
    audio_path = None
    score_status = None
    score_task_id = None
    score_result = None
    score_error = None
    created_at = None
    updated_at = None

  class DB:
    def get(self, _m, _id):
      return Row()

    def __enter__(self):
      return self

    def __exit__(self, *args):
      return False

  monkeypatch.setattr(session_store, "SessionLocal", lambda: DB())
  monkeypatch.setattr(session_store, "_load_session_legacy_file", lambda _sid: {"session_id": _sid, "legacy": True})
  out = session_store.load_session("s", user_id="u2")
  assert out["legacy"] is True


def test_user_metrics_word_fallback_branches(monkeypatch):
  result = {"phonemes": [{"symbol": "ZZ", "status": "warning", "issue": "x"}], "words": [{"text": " hello ", "status": "danger"}]}
  weak = user_metrics._extract_weak_sounds_from_result(result)
  assert weak == ["hello"]


def test_practice_tasks_unlink_exception_branch(monkeypatch):
  session = {"session_id": "s1", "expected_text": "x", "audio_path": "db://a", "score_status": "uploaded"}
  monkeypatch.setattr(practice_tasks, "load_session", lambda _sid: dict(session))
  monkeypatch.setattr(practice_tasks, "save_session", lambda *_a, **_k: None)
  monkeypatch.setattr(practice_tasks, "materialize_audio_path", lambda _p: "/tmp/file.wav")
  monkeypatch.setattr(practice_tasks, "score_pronunciation", lambda **_k: {"session_id": "s1", "overall_score": 1, "pronunciation_score": 1, "fluency_score": 1, "words": [], "phonemes": [], "analysis": {}})
  monkeypatch.setattr(practice_tasks, "generate_tips", lambda _r: [])

  class P:
    def __init__(self, _p):
      pass

    def unlink(self, missing_ok=True):
      raise RuntimeError("x")

  monkeypatch.setattr(practice_tasks, "Path", P)
  out = practice_tasks.run_practice_scoring.run("s1")
  assert out["status"] == "done"
