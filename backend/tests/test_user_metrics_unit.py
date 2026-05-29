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

