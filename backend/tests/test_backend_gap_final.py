from __future__ import annotations

from app.api import practice as practice_api
from app.services import user_metrics
from app.services.pronunciation import scorer
from app.services.pronunciation import textgrid_parser


def test_practice_line_109_direct(monkeypatch):
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
  session = {"session_id": "s1", "lesson_id": "l1", "expected_text": "x", "audio_path": "a", "score_status": "done", "score_task_id": "t1", "score_result": done_result}

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
  monkeypatch.setattr(practice_api, "run_practice_scoring", T)
  monkeypatch.setattr(practice_api, "save_session", lambda *_a, **_k: None)

  shared = dict(session)
  shared["score_status"] = "queued"

  class S:
    def successful(self):
      shared["score_status"] = "done"
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

  monkeypatch.setattr(practice_api, "run_practice_scoring", T)
  monkeypatch.setattr(practice_api, "load_session", lambda *_a, **_k: shared)

  out = practice_api.score_session("s1", current_user=User())
  assert out.status == "done"
  assert out.session_id == "s1"
  assert shared["score_status"] == "done"


def test_user_metrics_status_warning_branch():
  weak = user_metrics._extract_weak_sounds_from_result({"phonemes": [{"symbol": "ZZ", "status": "ok", "issue": None}], "words": [{"text": "abc", "status": "warning"}]})
  assert weak == ["abc"]


def test_scorer_wordless_phone_branch(monkeypatch):
  monkeypatch.setattr(
    scorer,
    "run_pronunciation_engine",
    lambda *_a, **_k: {
      "alignment": {
        "segments": [{"text": "x"}],
        "phones": [{"text": "AA", "word": "", "start_ms": 0, "end_ms": 1}],
        "alignment_status": "mfa",
        "engine_meta": {},
      },
      "phoneme_map": [],
      "features": {"audio_penalty": 0, "energy": 0.2, "rhythm": 0.2, "word_count": 1, "estimated_duration_ms": 1},
    },
  )
  out = scorer.score_pronunciation("s", "x", None)
  assert out["phonemes"]


def test_textgrid_parser_text_before_tier(tmp_path):
  p = tmp_path / "x.TextGrid"
  p.write_text('intervals [1]:\ntext = "HH"\nname = "words"\nintervals [1]:\nxmin = 0\nxmax = 1\ntext = "w"\nname = "phones"\nintervals [1]:\nxmin = 2\nxmax = 3\ntext = "P"', encoding="utf-8")
  out = textgrid_parser.parse_textgrid(p)
  assert out["phones"][0].get("word") is None


def test_lesson_rubric_r_only_branch():
  from app.services.lesson_rubric import compute_lesson_rubric

  out = compute_lesson_rubric("Beginner", "r r r")
  assert out.phoneme_coverage >= 33
