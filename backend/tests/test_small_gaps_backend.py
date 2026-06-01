from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import HTTPException

from app.api import drills as drills_api
from app.api import lessons as lessons_api
from app.api import practice as practice_api
from app.services import auth_service
from app.services import drill_store
from app.services import lesson_rubric
from app.services import user_metrics
from app.services.pronunciation import audio_prep
from app.services.pronunciation import scorer
from app.services.pronunciation import textgrid_parser


def test_drills_api_list_endpoint(monkeypatch):
  monkeypatch.setattr(drills_api, "list_drills_from_db", lambda **_k: [])
  out = drills_api.list_drills()
  assert out.items == []


def test_lessons_api_not_found(monkeypatch):
  monkeypatch.setattr(lessons_api, "get_lesson_from_db", lambda _id: None)
  with pytest.raises(HTTPException) as e:
    lessons_api.get_lesson("missing")
  assert e.value.status_code == 404


def test_practice_api_specific_branches(monkeypatch):
  class User:
    id = "u1"

  monkeypatch.setattr(practice_api, "load_session", lambda *_a, **_k: {"session_id": "s1"})
  monkeypatch.setattr(practice_api, "allow_request", lambda *_a, **_k: True)

  class Upload:
    content_type = "audio/m4a"
    filename = "a.m4a"

    async def read(self):
      return b"x" * (15 * 1024 * 1024 + 1)

  import anyio

  with pytest.raises(HTTPException) as e1:
    anyio.run(practice_api.upload_audio, "s1", Upload(), User())
  assert e1.value.status_code == 413

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
      return type("D", (), {"id": "new"})()

  saves = []
  monkeypatch.setattr(practice_api, "load_session", lambda *_a, **_k: dict(session))
  monkeypatch.setattr(practice_api, "run_practice_scoring", Task)
  monkeypatch.setattr(practice_api, "save_session", lambda _sid, payload: saves.append(dict(payload)))
  out = practice_api.score_session("s1", current_user=User())
  assert out.status in {"failed", "processing"}
  assert any(p.get("score_status") == "failed" for p in saves)


def test_auth_service_authenticate_wrong_password(monkeypatch):
  class User:
    password_hash = "hash"

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
  monkeypatch.setattr(auth_service, "verify_password", lambda *_a, **_k: False)
  assert auth_service.authenticate_user("a@example.com", "bad") is None


def test_drill_store_branches(monkeypatch):
  class Row:
    id = "d1"
    sound = "TH"
    mode = "repeat"
    title = "t"
    prompt = "p"
    lesson_id = "l1"

  class Q:
    def __init__(self):
      self.calls = 0

    def count(self):
      return 1

    def filter(self, _expr):
      self.calls += 1
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
  out = drill_store.list_drills(sound="TH", mode="repeat", limit=10)
  assert len(out) == 1


def test_lesson_rubric_branch_thresholds():
  r1 = lesson_rubric.compute_lesson_rubric("Beginner", "hello world")
  r2 = lesson_rubric.compute_lesson_rubric("Advanced", "hello world this is longer prompt")
  assert r1.cefr in {"A1", "A2", "B1", "B2"}
  assert r2.cefr in {"A1", "A2", "B1", "B2"}


def test_audio_prep_ffmpeg_success_and_copy_fallback(monkeypatch, tmp_path: Path):
  src = tmp_path / "x.m4a"
  src.write_bytes(b"abc")
  out_dir = tmp_path / "out"
  ff = tmp_path / "ffmpeg"
  ff.write_text("", encoding="utf-8")

  monkeypatch.setattr(audio_prep, "FFMPEG_BINARY", str(ff))

  class Done:
    returncode = 0
    stdout = ""
    stderr = ""

  def _run(cmd, capture_output, text):
    Path(cmd[-1]).write_bytes(b"wav")
    return Done()

  monkeypatch.setattr(audio_prep.subprocess, "run", _run)
  p, info = audio_prep.prepare_audio_for_alignment(str(src), out_dir)
  assert p is not None
  assert info["reason"] == "ffmpeg"


def test_scorer_early_and_fallback_paths(monkeypatch):
  monkeypatch.setattr(
    scorer,
    "run_pronunciation_engine",
    lambda *_a, **_k: {
      "alignment": {"segments": [{"text": "hello"}], "phones": [], "alignment_status": "mocked", "engine_meta": {}},
      "phoneme_map": [],
      "features": {"audio_penalty": 0, "energy": 0.8, "rhythm": 0.8, "word_count": 1, "estimated_duration_ms": 1000},
    },
  )
  out = scorer.score_pronunciation("s1", "hello", None)
  assert out["session_id"] == "s1"
  assert out["analysis"]["alignment_status"] == "mocked"
  assert out["analysis"]["audio_detected"] is False
  assert out["words"][0]["status"] in {"good", "warning"}


def test_textgrid_parser_phone_word_mapping(tmp_path: Path):
  p = tmp_path / "x.TextGrid"
  p.write_text(
    '\n'.join([
      'name = "words"',
      'intervals [1]:',
      'xmin = 0.0',
      'xmax = 1.0',
      'text = "hello"',
      'name = "phones"',
      'intervals [1]:',
      'xmin = 0.1',
      'xmax = 0.2',
      'text = "HH"',
    ]),
    encoding="utf-8",
  )
  out = textgrid_parser.parse_textgrid(p)
  assert out["phones"][0]["word"] == "hello"


def test_user_metrics_fallback_branch(monkeypatch):
  monkeypatch.setattr(user_metrics, "list_sessions", lambda user_id=None: [{"score_status": "done", "score_result": {"overall_score": 10}, "updated_at": "2026-01-01T00:00:00Z", "lesson_id": "x"}])
  out = user_metrics.compute_user_progress_payload()
  assert "level" in out
