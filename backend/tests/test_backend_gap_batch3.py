from __future__ import annotations

import importlib
import sys
from pathlib import Path

import pytest

from app.api import practice as practice_api
from app.services import auth_service
from app.services import drill_store
from app.services import session_store
from app.services import user_metrics
from app.services.pronunciation import scorer
from app.services.pronunciation import textgrid_parser
from app.tasks import practice_tasks


def test_practice_failed_result_branch(monkeypatch):
  class User:
    id = "u1"

  session = {"session_id": "s1", "audio_path": "a", "score_status": "queued", "score_task_id": "t1", "score_result": None}

  class Failed:
    def successful(self):
      return False

    def failed(self):
      return True

  class Task:
    @staticmethod
    def AsyncResult(_tid):
      return Failed()

    @staticmethod
    def delay(_sid):
      return type("D", (), {"id": "x"})()

  monkeypatch.setattr(practice_api, "allow_request", lambda *_a, **_k: True)
  monkeypatch.setattr(practice_api, "load_session", lambda *_a, **_k: session)
  monkeypatch.setattr(practice_api, "run_practice_scoring", Task)
  monkeypatch.setattr(practice_api, "save_session", lambda *_a, **_k: None)
  out = practice_api.score_session("s1", current_user=User())
  assert out.status in {"processing", "failed"}


def test_config_missing_sso_audiences(monkeypatch):
  name = "app.core.config"
  old = sys.modules.pop(name, None)
  try:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("CORS_ALLOW_ORIGINS", "https://ok.com")
    monkeypatch.setenv("JWT_SECRET", "x" * 40)
    monkeypatch.setenv("METRICS_TOKEN", "m")
    monkeypatch.setenv("SSO_VERIFY_SIGNATURE", "true")
    monkeypatch.setenv("SSO_GOOGLE_AUDIENCE", "")
    monkeypatch.setenv("SSO_APPLE_AUDIENCE", "")
    with pytest.raises(RuntimeError):
      importlib.import_module(name)
  finally:
    sys.modules.pop(name, None)
    if old is not None:
      sys.modules[name] = old


def test_auth_service_line_80(monkeypatch):
  class User:
    password_hash = "h"

  class Q:
    def filter(self, *_a, **_k):
      return self

    def first(self):
      return User()

  class DB:
    def query(self, _m):
      return Q()

    def __enter__(self):
      return self

    def __exit__(self, *args):
      return False

  monkeypatch.setattr(auth_service, "SessionLocal", lambda: DB())
  monkeypatch.setattr(auth_service, "verify_password", lambda *_a, **_k: True)
  out = auth_service.authenticate_user("a@example.com", "ok")
  assert out is not None


def test_drill_store_mode_only_branch(monkeypatch):
  class Row:
    id = "d1"
    sound = "TH"
    mode = "repeat"
    title = "t"
    prompt = "p"
    lesson_id = "l1"

  class Q:
    def filter(self, _expr):
      return self

    def limit(self, _n):
      return self

    def all(self):
      return [Row()]

  class DB:
    def query(self, _m):
      return Q()

    def __enter__(self):
      return self

    def __exit__(self, *args):
      return False

  monkeypatch.setattr(drill_store, "ensure_default_drills", lambda: None)
  monkeypatch.setattr(drill_store, "SessionLocal", lambda: DB())
  assert len(drill_store.list_drills(sound=None, mode="repeat", limit=1)) == 1


def test_session_store_user_filter_branch(monkeypatch):
  class Row:
    session_id = "s"
    user_id = "u"
    lesson_id = "l"
    expected_text = "e"
    status = "done"
    audio_path = None
    score_status = None
    score_task_id = None
    score_result = None
    score_error = None
    created_at = None
    updated_at = None

  class Q:
    def filter(self, _expr):
      return self

    def all(self):
      return [Row()]

  class DB:
    def query(self, _m):
      return Q()

    def __enter__(self):
      return self

    def __exit__(self, *args):
      return False

  monkeypatch.setattr(session_store, "SessionLocal", lambda: DB())
  out = session_store.list_sessions(user_id="u")
  assert len(out) == 1


def test_scorer_branch_lines_and_textgrid_branch(tmp_path: Path):
  # scorer 26/34/branches
  monkeypatch_data = {
    "alignment": {"segments": [{"text": "?"}], "phones": [{"text": "AA", "word": "x", "start_ms": 0, "end_ms": 10}], "alignment_status": "mfa", "engine_meta": {}},
    "phoneme_map": ["AA"],
    "features": {"audio_penalty": 10, "energy": 0.2, "rhythm": 0.2, "word_count": 1, "estimated_duration_ms": 10},
  }
  scorer.run_pronunciation_engine = lambda *_a, **_k: monkeypatch_data
  out = scorer.score_pronunciation("s", "x", None)
  assert out["overall_score"] >= 0

  # textgrid branch 47->22 / 32->34
  p = tmp_path / "a.TextGrid"
  p.write_text('name = "phones"\nintervals [1]:\ntext = "HH"\nname = "words"\nintervals [1]:\nxmin = 0\nxmax = 1\ntext = "h"', encoding="utf-8")
  parsed = textgrid_parser.parse_textgrid(p)
  assert isinstance(parsed["phones"], list)


def test_user_metrics_fallback_and_counter(monkeypatch):
  sessions = [
    {"score_status": "done", "score_result": {"overall_score": 1, "pronunciation_score": 1, "fluency_score": 1, "phonemes": [{"symbol": "TH", "status": "warning", "issue": "x"}]}, "lesson_id": "x", "updated_at": "2026-01-01T00:00:00Z", "created_at": "2026-01-01T00:00:00Z"},
  ]
  monkeypatch.setattr(user_metrics, "list_sessions", lambda user_id=None: sessions)
  out = user_metrics.compute_user_progress_payload()
  assert "TH" in out["weak_sounds"]


def test_practice_tasks_except_lines(monkeypatch):
  session = {"session_id": "s1", "expected_text": "x", "audio_path": "db://a", "score_status": "u"}
  monkeypatch.setattr(practice_tasks, "load_session", lambda _sid: dict(session))
  monkeypatch.setattr(practice_tasks, "save_session", lambda *_a, **_k: None)
  monkeypatch.setattr(practice_tasks, "materialize_audio_path", lambda _p: None)

  def _boom(**_k):
    raise RuntimeError("x")

  monkeypatch.setattr(practice_tasks, "score_pronunciation", _boom)
  out = practice_tasks.run_practice_scoring.run("s1")
  assert out["status"] == "failed"
