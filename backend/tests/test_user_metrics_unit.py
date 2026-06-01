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


def test_symbol_bucket_and_extract_word_fallback():
  assert user_metrics._symbol_to_sound_bucket("TH") == "TH"
  assert user_metrics._symbol_to_sound_bucket("ER") == "R"
  assert user_metrics._symbol_to_sound_bucket("L") == "L"
  assert user_metrics._symbol_to_sound_bucket("ZZ") is None

  result = {
    "phonemes": [{"symbol": "ZZ", "status": "ok", "issue": None}],
    "words": [{"text": " hello! ", "status": "warning"}],
  }
  weak = user_metrics._extract_weak_sounds_from_result(result)
  assert weak == ["hello"]


def test_infer_practice_minutes_branches(monkeypatch):
  monkeypatch.setattr(user_metrics, "LESSON_DURATION_BY_ID", {"l1": 9})
  assert user_metrics._infer_practice_minutes({"lesson_id": "l1"}) == 9

  monkeypatch.setattr(user_metrics, "LESSON_DURATION_BY_ID", {})
  s = {"lesson_id": "missing", "score_result": {"analysis": {"estimated_duration_ms": 180000}}}
  assert user_metrics._infer_practice_minutes(s) == 3

  s2 = {"lesson_id": "missing", "score_result": {"analysis": {"estimated_duration_ms": 0}}}
  assert user_metrics._infer_practice_minutes(s2) == 1


def test_compute_user_progress_payload_levels_and_wrappers(monkeypatch):
  def _sessions(level_case: str):
    base = {
      "lesson_id": "x",
      "score_status": "done",
      "score_result": {},
      "updated_at": "2026-01-01T00:00:00Z",
      "created_at": "2026-01-01T00:00:00Z",
    }
    if level_case == "b2":
      base["score_result"] = {"pronunciation_score": 90, "fluency_score": 88, "overall_score": 89}
    elif level_case == "b1":
      base["score_result"] = {"pronunciation_score": 80, "fluency_score": 76, "overall_score": 78}
    elif level_case == "a2":
      base["score_result"] = {"pronunciation_score": 65, "fluency_score": 60, "overall_score": 62}
    else:
      base["score_result"] = {"pronunciation_score": 40, "fluency_score": 50, "overall_score": 45}
    return [base]

  monkeypatch.setattr(user_metrics, "LESSON_XP_BY_ID", {})

  monkeypatch.setattr(user_metrics, "list_sessions", lambda user_id=None: _sessions("b2"))
  assert user_metrics.compute_user_progress_payload()["level"] == "B2"

  monkeypatch.setattr(user_metrics, "list_sessions", lambda user_id=None: _sessions("b1"))
  assert user_metrics.compute_user_progress_payload()["level"] == "B1"

  monkeypatch.setattr(user_metrics, "list_sessions", lambda user_id=None: _sessions("a2"))
  assert user_metrics.compute_user_progress_payload()["level"] == "A2"

  monkeypatch.setattr(user_metrics, "list_sessions", lambda user_id=None: _sessions("a1"))
  assert user_metrics.compute_user_progress_payload()["level"] == "A1"

  hist = user_metrics.compute_user_history_payload(limit=1)
  assert "items" in hist
  assert isinstance(user_metrics.compute_user_history(), list)
  assert isinstance(user_metrics.compute_user_progress(), dict)


def test_compute_user_history_payload_filters_done_and_sorts(monkeypatch):
  sessions = [
    {"session_id": "old", "score_status": "done", "score_result": {"overall_score": 1}, "updated_at": "2026-01-01T00:00:00Z"},
    {"session_id": "new", "score_status": "done", "score_result": {"overall_score": 2}, "updated_at": "2026-01-02T00:00:00Z"},
    {"session_id": "skip", "score_status": "processing", "score_result": None, "updated_at": "2026-01-03T00:00:00Z"},
  ]
  monkeypatch.setattr(user_metrics, "list_sessions", lambda user_id=None: sessions)
  out = user_metrics.compute_user_history_payload(limit=5)
  assert out["items"][0]["session_id"] == "new"
  assert out["items"][1]["session_id"] == "old"


def test_streak_cap():
  assert user_metrics._compute_streak_simple([{}] * 40) == 30
  assert user_metrics._compute_streak_simple([{}] * 3) == 3
