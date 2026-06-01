from __future__ import annotations

from app.services import user_metrics
from app.services.pronunciation import scorer
from app.services.pronunciation import textgrid_parser
from app.services.lesson_rubric import compute_lesson_rubric


def test_lesson_rubric_branch_19_to_21():
  out = compute_lesson_rubric("Beginner", "rrrr")
  assert out.phoneme_coverage >= 33


def test_scorer_branches_52_and_56(monkeypatch):
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
      "features": {"audio_penalty": 0, "energy": 0.6, "rhythm": 0.6, "word_count": 1, "estimated_duration_ms": 7},
    },
  )
  out = scorer.score_pronunciation("s", "apple", None)
  assert out["word_feedback"]


def test_textgrid_branch_47_to_22(tmp_path):
  p = tmp_path / "a.TextGrid"
  p.write_text('\n'.join([
    'name = "phones"',
    'intervals [1]:',
    'xmin = 0',
    'xmax = 1',
    'text = "HH"',
    'name = "words"',
    'intervals [1]:',
    'xmin = 2',
    'xmax = 3',
    'text = "W"',
  ]), encoding='utf-8')
  parsed = textgrid_parser.parse_textgrid(p)
  assert parsed["phones"][0]["word"] is None


def test_user_metrics_60_to_58_branch():
  result = {"phonemes": [{"symbol": "ZZ", "status": "ok", "issue": None}], "words": [{"text": "", "status": "warning"}]}
  weak = user_metrics._extract_weak_sounds_from_result(result)
  assert weak == []
