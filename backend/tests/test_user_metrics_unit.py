from app.services import user_metrics


def test_normalize_weak_sound_token_strips_punct():
  assert user_metrics._normalize_weak_sound_token("  TH! ") == "th"


def test_compute_trend_series_and_consistency_shapes():
  sessions = [
    {
      "lesson_id": "missing",
      "score_result": {
        "overall_score": 70,
        "pronunciation_score": 60,
        "fluency_score": 80,
        "analysis": {"estimated_duration_ms": 120_000},
      },
    },
    {
      "lesson_id": "missing",
      "score_result": {
        "overall_score": 75,
        "pronunciation_score": 65,
        "fluency_score": 85,
        "analysis": {"estimated_duration_ms": 60_000},
      },
    },
  ]

  series = user_metrics.compute_trend_series(sessions, max_points=12)
  assert series["overall"] == [70, 75]
  assert series["pronunciation"] == [60, 65]
  assert series["fluency"] == [80, 85]

  consistency = user_metrics.compute_consistency_series(sessions, max_points=12)
  assert len(consistency) == 2
  assert all(isinstance(v, int) for v in consistency)


def test_extract_weak_sounds_prefers_engine_list():
  result = {"analysis": {"weak_sounds": [" TH ", "r"]}}
  weak = user_metrics._extract_weak_sounds_from_result(result)
  assert weak == ["th", "r"]


def test_extract_weak_sounds_from_phonemes_and_words():
  result = {
    "phonemes": [
      {"symbol": "TH", "status": "warning", "issue": "x"},
      {"symbol": "R", "status": "danger", "issue": None},
    ],
    "words": [{"text": "Hello", "status": "warning"}],
  }
  weak = user_metrics._extract_weak_sounds_from_result(result)
  assert "TH" in weak and "R" in weak


def test_compute_achievements_and_daily_minutes():
  payload = user_metrics.compute_achievements(
    {"streak": 3, "xp": 50, "weak_sounds": ["TH", "R"]}
  )
  assert payload[0]["id"] == "streak"
  assert payload[1]["id"] == "xp"
  assert payload[2]["id"] == "focus"

  dm = user_metrics.compute_daily_minutes({"today_minutes": 12, "daily_target_minutes": 15})
  assert dm["today_minutes"] == 12
  assert dm["target_minutes"] == 15


def test_compute_user_history_items_maps_lesson_fallbacks():
  sessions = [
    {
      "session_id": "s1",
      "lesson_id": "unknown",
      "updated_at": "2026-01-01T00:00:00Z",
      "score_result": {"overall_score": 88},
    }
  ]

  items = user_metrics.compute_user_history_items(sessions, limit=10)
  assert items[0]["session_id"] == "s1"
  assert "overall_score" in items[0]


def test_safe_helpers_handle_bad_objects():
  class Bad:
    def __str__(self):
      raise RuntimeError("no")

  assert user_metrics._safe_str(Bad(), default="x") == "x"
  assert user_metrics._safe_int("nope", default=7) == 7
