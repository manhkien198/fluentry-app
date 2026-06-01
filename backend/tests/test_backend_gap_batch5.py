from __future__ import annotations

from pathlib import Path

from app.api import practice as practice_api
from app.services import session_store
from app.services import user_metrics
from app.services.pronunciation import scorer
from app.services.pronunciation import textgrid_parser


def test_practice_line_109_exact(monkeypatch):
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
  session = {
    "session_id": "s1",
    "lesson_id": "l1",
    "expected_text": "x",
    "audio_path": "a",
    "score_status": "queued",
    "score_task_id": "t1",
    "score_result": done_result,
  }

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
  assert out.status in {"done", "processing"}


def test_lesson_rubric_branch_19_21():
  from app.services import lesson_rubric

  out = lesson_rubric.compute_lesson_rubric("Beginner", "this has only r and no th or l")
  assert out.phoneme_coverage >= 33


def test_scorer_remaining_branches(monkeypatch):
  monkeypatch.setattr(
    scorer,
    "run_pronunciation_engine",
    lambda *_a, **_k: {
      "alignment": {
        "segments": [{"text": "'x'"}],
        "phones": [
          {"text": "AA", "word": "x", "start_ms": 0, "end_ms": 5},
          {"text": "HH", "word": "x", "start_ms": 6, "end_ms": 7},
          {"text": "T", "word": "x", "start_ms": 8, "end_ms": 9},
        ],
        "alignment_status": "mfa",
        "engine_meta": {},
      },
      "phoneme_map": ["AA", "HH", "T"],
      "features": {"audio_penalty": 0, "energy": 0.2, "rhythm": 0.2, "word_count": 1, "estimated_duration_ms": 9},
    },
  )
  out = scorer.score_pronunciation("s", "x", None)
  assert out["phonemes"]


def test_textgrid_parser_remaining_branches(tmp_path: Path):
  p = tmp_path / "x.TextGrid"
  p.write_text(
    "\n".join(
      [
        'name = "words"',
        'intervals [1]:',
        'xmin = 0.0',
        'xmax = 1.0',
        'text = "a"',
        'name = "phones"',
        'intervals [1]:',
        'xmin = 1.1',
        'xmax = 1.2',
        'text = "HH"',
      ]
    ),
    encoding="utf-8",
  )
  out = textgrid_parser.parse_textgrid(p)
  assert out["phones"][0].get("word") is None


def test_session_store_filter_branch(monkeypatch):
  class Row:
    session_id = "s"
    user_id = "u"
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


def test_user_metrics_branch_60_62(monkeypatch):
  result = {
    "phonemes": [{"symbol": "ZZ", "status": "ok", "issue": None}],
    "words": [
      {"text": "  ", "status": "warning"},
      {"text": "world", "status": "danger"},
    ],
  }
  weak = user_metrics._extract_weak_sounds_from_result(result)
  assert weak == ["world"]
