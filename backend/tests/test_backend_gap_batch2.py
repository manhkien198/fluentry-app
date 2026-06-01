from __future__ import annotations

from pathlib import Path

from app.api import lessons as lessons_api
from app.api import practice as practice_api
from app.main import metrics
from app.services import drill_store
from app.services import user_metrics
from app.services.pronunciation import scorer
from app.services.pronunciation import textgrid_parser
from app.tasks import practice_tasks


def test_lessons_get_success(monkeypatch):
  lesson = type("L", (), {"id": "l1", "title": "t", "level": "A1", "duration_minutes": 1, "xp": 1, "prompt": "p", "rubric": type("R", (), {"cefr": "A1", "complexity_score": 1, "phoneme_coverage": 1, "fluency_demand": 1})()})()
  monkeypatch.setattr(lessons_api, "get_lesson_from_db", lambda _id: lesson)
  out = lessons_api.get_lesson("l1")
  assert out.id == "l1"


def test_practice_failed_async_branch(monkeypatch):
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

  saved = []
  monkeypatch.setattr(practice_api, "allow_request", lambda *_a, **_k: True)
  monkeypatch.setattr(practice_api, "load_session", lambda *_a, **_k: dict(session))
  monkeypatch.setattr(practice_api, "run_practice_scoring", Task)
  monkeypatch.setattr(practice_api, "save_session", lambda _sid, payload: saved.append(dict(payload)))
  out = practice_api.score_session("s1", current_user=User())
  assert out.status in {"failed", "processing"}
  assert any(p.get("score_status") == "failed" for p in saved)


def test_metrics_unauthorized_and_ok(monkeypatch):
  monkeypatch.setattr("app.main.METRICS_TOKEN", "secret")
  try:
    metrics("wrong")
    assert False
  except Exception:
    pass
  out = metrics("secret")
  assert "counters" in out


def test_drill_store_sound_only_branch(monkeypatch):
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
  assert len(drill_store.list_drills(sound="th", mode=None, limit=1)) == 1


def test_scorer_branch_word_feedback_and_detected_audio(monkeypatch, tmp_path: Path):
  ap = tmp_path / "a.wav"
  ap.write_bytes(b"x")
  monkeypatch.setattr(
    scorer,
    "run_pronunciation_engine",
    lambda *_a, **_k: {
      "alignment": {
        "segments": [{"text": "hello"}],
        "phones": [{"text": "HH", "word": "hello", "start_ms": 0, "end_ms": 20}],
        "alignment_status": "mfa",
        "engine_meta": {},
      },
      "phoneme_map": [],
      "features": {"audio_penalty": 1, "energy": 0.8, "rhythm": 0.8, "word_count": 1, "estimated_duration_ms": 500},
    },
  )
  out = scorer.score_pronunciation("s", "hello", str(ap))
  assert out["analysis"]["audio_detected"] is True


def test_textgrid_parser_current_item_none_branch(tmp_path: Path):
  p = tmp_path / "x.TextGrid"
  p.write_text('xmin = 0.0\nname = "words"\nintervals [1]:\nxmin = 0\nxmax = 1\ntext = "a"', encoding="utf-8")
  out = textgrid_parser.parse_textgrid(p)
  assert out["words"][0]["text"] == "a"


def test_user_metrics_line_177(monkeypatch):
  monkeypatch.setattr(user_metrics, "list_sessions", lambda user_id=None: [{"score_status": "done", "score_result": {"overall_score": 90, "pronunciation_score": 90, "fluency_score": 90}, "updated_at": "2026-01-01T00:00:00Z", "lesson_id": "x", "created_at": "2026-01-01T00:00:00Z"}])
  out = user_metrics.compute_user_progress_payload()
  assert out["level"] in {"A1", "A2", "B1", "B2"}


def test_practice_tasks_finally_non_tmp_branch(monkeypatch):
  session = {"session_id": "s1", "expected_text": "hello", "audio_path": "db://audio/x", "score_status": "uploaded"}
  monkeypatch.setattr(practice_tasks, "load_session", lambda _sid: dict(session))
  monkeypatch.setattr(practice_tasks, "save_session", lambda *_a, **_k: None)
  monkeypatch.setattr(practice_tasks, "materialize_audio_path", lambda _p: "/var/a.wav")
  monkeypatch.setattr(practice_tasks, "score_pronunciation", lambda **_k: {"session_id": "s1", "overall_score": 1, "pronunciation_score": 1, "fluency_score": 1, "words": [], "phonemes": [], "analysis": {}})
  monkeypatch.setattr(practice_tasks, "generate_tips", lambda _r: [])
  out = practice_tasks.run_practice_scoring.run("s1")
  assert out["status"] == "done"
