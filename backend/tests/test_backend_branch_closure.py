from __future__ import annotations

from app.services.lesson_rubric import compute_lesson_rubric
from app.services.pronunciation import scorer
from app.services.pronunciation import textgrid_parser
from app.services import user_metrics


def test_lesson_rubric_hit_r_without_l():
  out = compute_lesson_rubric("Beginner", "r only token")
  assert out.phoneme_coverage >= 33


def test_scorer_hit_remaining_word_feedback_branches(monkeypatch):
  monkeypatch.setattr(
    scorer,
    "run_pronunciation_engine",
    lambda *_a, **_k: {
      "alignment": {
        "segments": [{"text": "apple"}],
        "phones": [
          {"text": "AA", "word": "apple", "start_ms": 0, "end_ms": 5},
          {"text": "K", "word": "apple", "start_ms": 6, "end_ms": 7},
        ],
        "alignment_status": "mfa",
        "engine_meta": {},
      },
      "phoneme_map": [],
      "features": {"audio_penalty": 0, "energy": 0.7, "rhythm": 0.7, "word_count": 1, "estimated_duration_ms": 7},
    },
  )
  out = scorer.score_pronunciation("s", "apple", None)
  assert isinstance(out["word_feedback"], list)


def test_textgrid_phone_before_word_branch(tmp_path):
  p = tmp_path / "a.TextGrid"
  p.write_text("name = \"phones\"\nintervals [1]:\nxmin = 0\nxmax = 1\ntext = \"HH\"\nname = \"words\"\nintervals [1]:\nxmin = 2\nxmax = 3\ntext = \"w\"", encoding="utf-8")
  out = textgrid_parser.parse_textgrid(p)
  assert out["phones"][0]["word"] is None


def test_user_metrics_warning_empty_token_branch():
  result = {"phonemes": [{"symbol": "ZZ", "status": "ok", "issue": None}], "words": [{"text": "", "status": "warning"}]}
  assert user_metrics._extract_weak_sounds_from_result(result) == []
