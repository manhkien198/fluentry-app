from __future__ import annotations

from app.services import user_metrics
from app.services.pronunciation import scorer
from app.services.pronunciation import textgrid_parser


def test_user_metrics_warning_to_token_branch_precise():
  result = {"phonemes": [], "words": [{"text": "", "status": "warning"}, {"text": "abc", "status": "warning"}]}
  weak = user_metrics._extract_weak_sounds_from_result(result)
  assert weak == ["abc"]


def test_scorer_vowel_and_last_phone_branches(monkeypatch):
  monkeypatch.setattr(
    scorer,
    "run_pronunciation_engine",
    lambda *_a, **_k: {
      "alignment": {
        "segments": [{"text": "apple"}],
        "phones": [
          {"text": "AA", "word": "apple", "start_ms": 0, "end_ms": 10},
          {"text": "P", "word": "apple", "start_ms": 11, "end_ms": 12},
        ],
        "alignment_status": "mfa",
        "engine_meta": {},
      },
      "phoneme_map": [],
      "features": {"audio_penalty": 0, "energy": 0.3, "rhythm": 0.3, "word_count": 1, "estimated_duration_ms": 12},
    },
  )
  out = scorer.score_pronunciation("s", "apple", None)
  assert out["word_feedback"]


def test_textgrid_parser_interval_without_tier(tmp_path):
  p = tmp_path / "orphan.TextGrid"
  p.write_text("intervals [1]:\ntext = \"X\"\nname = \"words\"\nintervals [1]:\nxmin = 0\nxmax = 1\ntext = \"w\"", encoding="utf-8")
  out = textgrid_parser.parse_textgrid(p)
  assert out["words"][0]["text"] == "w"
