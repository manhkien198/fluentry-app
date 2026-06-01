from __future__ import annotations

from app.services.lesson_rubric import compute_lesson_rubric
from app.services.pronunciation import scorer
from app.services.pronunciation import textgrid_parser
from app.services import user_metrics


def test_lesson_rubric_without_r_hits_l_branch_not_r():
  out = compute_lesson_rubric("Beginner", "light lamp")
  assert out.phoneme_coverage == 33


def test_scorer_non_vowel_last_phone_branch(monkeypatch):
  monkeypatch.setattr(
    scorer,
    "run_pronunciation_engine",
    lambda *_a, **_k: {
      "alignment": {
        "segments": [{"text": "apple"}],
        "phones": [
          {"text": "AA", "word": "apple", "start_ms": 0, "end_ms": 5},
          {"text": "P", "word": "apple", "start_ms": 6, "end_ms": 7},
        ],
        "alignment_status": "mfa",
        "engine_meta": {},
      },
      "phoneme_map": [],
      "features": {"audio_penalty": 8, "energy": 0.4, "rhythm": 0.4, "word_count": 1, "estimated_duration_ms": 7},
    },
  )

  out = scorer.score_pronunciation("s", "apple", None)
  assert out["word_feedback"]


def test_textgrid_text_line_ignored_without_current_item(tmp_path):
  p = tmp_path / "orphan_text.TextGrid"
  p.write_text('\n'.join([
    'name = "phones"',
    'text = "HH"',
    'intervals [1]:',
    'xmin = 0',
    'xmax = 1',
    'text = "AH"',
    'name = "words"',
    'intervals [1]:',
    'xmin = 2',
    'xmax = 3',
    'text = "w"',
  ]), encoding='utf-8')
  parsed = textgrid_parser.parse_textgrid(p)
  assert parsed["phones"][0]["text"] == "AH"


def test_user_metrics_warning_with_empty_normalized_token_branch():
  result = {"phonemes": [], "words": [{"text": "...", "status": "warning"}]}
  assert user_metrics._extract_weak_sounds_from_result(result) == []


def test_user_metrics_non_warning_word_skips_token_append_branch():
  result = {"phonemes": [], "words": [{"text": "abc", "status": "good"}]}
  assert user_metrics._extract_weak_sounds_from_result(result) == []


def test_scorer_vowel_symbol_without_vowel_cluster_branch(monkeypatch):
  monkeypatch.setattr(
    scorer,
    "run_pronunciation_engine",
    lambda *_a, **_k: {
      "alignment": {
        "segments": [{"text": "brrr"}],
        "phones": [{"text": "AA", "word": "brrr", "start_ms": 0, "end_ms": 5}],
        "alignment_status": "mfa",
        "engine_meta": {},
      },
      "phoneme_map": [],
      "features": {"audio_penalty": 20, "energy": 0.3, "rhythm": 0.3, "word_count": 1, "estimated_duration_ms": 5},
    },
  )
  out = scorer.score_pronunciation("s", "brrr", None)
  assert out["word_feedback"]


def test_scorer_non_vowel_warning_not_last_phone_branch(monkeypatch):
  monkeypatch.setattr(
    scorer,
    "run_pronunciation_engine",
    lambda *_a, **_k: {
      "alignment": {
        "segments": [{"text": "apple"}],
        "phones": [
          {"text": "P", "word": "apple", "start_ms": 0, "end_ms": 1},
          {"text": "AA", "word": "apple", "start_ms": 2, "end_ms": 102},
        ],
        "alignment_status": "mfa",
        "engine_meta": {},
      },
      "phoneme_map": [],
      "features": {"audio_penalty": 0, "energy": 0.5, "rhythm": 0.5, "word_count": 1, "estimated_duration_ms": 102},
    },
  )
  out = scorer.score_pronunciation("s", "apple", None)
  assert out["word_feedback"]


def test_textgrid_interval_unknown_line_hits_no_text_match_branch(tmp_path):
  p = tmp_path / "unknown_line.TextGrid"
  p.write_text('\n'.join([
    'name = "phones"',
    'intervals [1]:',
    'foo = "bar"',
    'xmin = 0',
    'xmax = 1',
    'text = "HH"',
  ]), encoding='utf-8')
  parsed = textgrid_parser.parse_textgrid(p)
  assert parsed["phones"][0]["text"] == "HH"
