from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.services.session_store import list_sessions
from app.services.lesson_store import list_lessons

LESSONS = list_lessons()
LESSON_TITLE_BY_ID = {lesson.id: lesson.title for lesson in LESSONS}
LESSON_PROMPT_BY_ID = {lesson.id: lesson.prompt for lesson in LESSONS}
LESSON_XP_BY_ID = {lesson.id: lesson.xp for lesson in LESSONS}
LESSON_DURATION_BY_ID = {lesson.id: lesson.duration_minutes for lesson in LESSONS}
LESSON_LEVEL_BY_ID = {lesson.id: lesson.level for lesson in LESSONS}


def _normalize_weak_sound_token(value: str) -> str:
    token = value.strip().lower()
    token = token.strip(".,!?;:\"'()[]{}")
    return token


def _symbol_to_sound_bucket(symbol: str) -> str | None:
    s = symbol.strip().upper()
    # MFA/ARPAbet-ish and generic buckets.
    if s in {"TH", "DH", "θ", "ð"}:
        return "TH"
    if s in {"R", "ER", "AR", "OR", "ɹ"}:
        return "R"
    if s in {"L", "EL", "ɫ", "l"}:
        return "L"
    return None


def _extract_weak_sounds_from_result(result: dict[str, Any]) -> list[str]:
    # Prefer engine-provided weak sounds if present (future-proof).
    analysis = result.get("analysis") or {}
    engine_weak = analysis.get("weak_sounds")
    if isinstance(engine_weak, list) and engine_weak:
        normalized = [_normalize_weak_sound_token(str(x)) for x in engine_weak]
        return [x for x in normalized if x]

    # If phoneme-level issues exist, bucket them into sounds.
    buckets: list[str] = []
    for p in result.get("phonemes") or []:
        status = (p.get("status") or "").lower()
        issue = p.get("issue")
        if status in {"warning", "danger"} or issue:
            b = _symbol_to_sound_bucket(str(p.get("symbol") or ""))
            if b:
                buckets.append(b)

    if buckets:
        return buckets

    # Fallback: use warning/danger words as weak tokens (least accurate).
    tokens: list[str] = []
    for w in result.get("words") or []:
        status = (w.get("status") or "").lower()
        if status in {"warning", "danger"}:
            t = _normalize_weak_sound_token(str(w.get("text") or ""))
            if t:
                tokens.append(t)

    return tokens


def _safe_str(value: Any, default: str = "") -> str:
    try:
        return str(value)
    except Exception:
        return default

def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _infer_practice_minutes(session: dict[str, Any]) -> int:
    lesson_id = _safe_str(session.get("lesson_id"))
    duration = LESSON_DURATION_BY_ID.get(lesson_id)
    if duration is not None:
        return int(duration)

    result = session.get("score_result") or {}
    analysis = result.get("analysis") or {}
    estimated_ms = analysis.get("estimated_duration_ms")
    if isinstance(estimated_ms, (int, float)) and estimated_ms > 0:
        return max(1, round(float(estimated_ms) / 60000))

    return 1


def _compute_streak_simple(sessions: list[dict[str, Any]]) -> int:
    # v1: no auth/user dates, so just cap by count.
    return min(30, len(sessions))


def compute_trend_series(sessions: list[dict[str, Any]], max_points: int = 12) -> dict[str, list[int]]:
    series = {
        "overall": [],
        "pronunciation": [],
        "fluency": [],
    }

    tail = sessions[-max_points:]
    for s in tail:
        result = s.get("score_result") or {}
        series["overall"].append(_safe_int(result.get("overall_score"), 0))
        series["pronunciation"].append(_safe_int(result.get("pronunciation_score"), 0))
        series["fluency"].append(_safe_int(result.get("fluency_score"), 0))

    return series


def compute_consistency_series(sessions: list[dict[str, Any]], max_points: int = 12) -> list[int]:
    tail = sessions[-max_points:]
    return [min(100, 20 + _infer_practice_minutes(s) * 6) for s in tail]


def compute_achievements(progress: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        {"id": "streak", "title": "Streak", "value": f"{progress.get('streak', 0)} days"},
        {"id": "xp", "title": "XP", "value": f"{progress.get('xp', 0)}"},
        {"id": "focus", "title": "Focus", "value": f"{len(progress.get('weak_sounds') or [])} sounds"},
    ]


def compute_daily_minutes(progress: dict[str, Any]) -> dict[str, Any]:
    # v1: without per-day aggregation, treat all done sessions as 'today'.
    return {
        "today_minutes": progress.get("today_minutes", 0),
        "target_minutes": progress.get("daily_target_minutes", 15),
    }


def compute_user_history_items(done_sessions: list[dict[str, Any]], limit: int = 20) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for s in done_sessions[:limit]:
        result = s.get("score_result") or {}
        lesson_id = _safe_str(s.get("lesson_id"))
        items.append(
            {
                "session_id": s.get("session_id"),
                "overall_score": _safe_int(result.get("overall_score"), 0),
                "lesson_id": lesson_id,
                "lesson_title": LESSON_TITLE_BY_ID.get(lesson_id, _safe_str(result.get("lesson_title"), "")),
            }
        )

    return items


def compute_user_progress_payload(user_id: str | None = None) -> dict[str, Any]:
    sessions = list_sessions(user_id=user_id)
    done_sessions = [s for s in sessions if s.get("score_status") == "done" and s.get("score_result")]
    done_sessions.sort(key=lambda s: s.get("updated_at") or s.get("created_at") or "")

    xp_total = 0
    pronunciation_scores: list[int] = []
    fluency_scores: list[int] = []

    weak_sound_counter: dict[str, int] = {}
    minutes_today = 0

    for s in done_sessions:
        result = s.get("score_result") or {}
        lesson_id = _safe_str(s.get("lesson_id"))
        xp_total += int(LESSON_XP_BY_ID.get(lesson_id, 30))

        pronunciation_scores.append(_safe_int(result.get("pronunciation_score"), 0))
        fluency_scores.append(_safe_int(result.get("fluency_score"), 0))

        for token in _extract_weak_sounds_from_result(result):
            weak_sound_counter[token] = weak_sound_counter.get(token, 0) + 1

        minutes_today += _infer_practice_minutes(s)

    pronunciation_avg = round(sum(pronunciation_scores) / len(pronunciation_scores)) if pronunciation_scores else 0
    fluency_avg = round(sum(fluency_scores) / len(fluency_scores)) if fluency_scores else 0

    confidence_score = round((pronunciation_avg + fluency_avg) / 2) if (pronunciation_scores or fluency_scores) else 0

    weak_sounds_sorted = sorted(weak_sound_counter.items(), key=lambda x: x[1], reverse=True)
    weak_sounds = [k for (k, _v) in weak_sounds_sorted[:6]]

    streak = _compute_streak_simple(done_sessions)

    level = "A1"
    if pronunciation_avg >= 85 and fluency_avg >= 85:
        level = "B2"
    elif pronunciation_avg >= 75 and fluency_avg >= 75:
        level = "B1"
    elif pronunciation_avg >= 60 and fluency_avg >= 60:
        level = "A2"

    payload = {
        "streak": streak,
        "xp": xp_total,
        "level": level,
        "pronunciation_score": pronunciation_avg,
        "fluency_score": fluency_avg,
        "confidence_score": confidence_score,
        "weak_sounds": weak_sounds,
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "session_count": len(done_sessions),
        "today_minutes": minutes_today,
        "daily_target_minutes": 15,
        "trend": compute_trend_series(done_sessions),
        "consistency": compute_consistency_series(done_sessions),
        "achievements": compute_achievements({"streak": streak, "xp": xp_total, "weak_sounds": weak_sounds}),
    }

    return payload


def compute_user_history_payload(limit: int = 20, user_id: str | None = None) -> dict[str, Any]:
    sessions = list_sessions(user_id=user_id)
    done_sessions = [s for s in sessions if s.get("score_status") == "done" and s.get("score_result")]
    done_sessions.sort(key=lambda s: s.get("updated_at") or s.get("created_at") or "", reverse=True)

    return {"items": compute_user_history_items(done_sessions, limit=limit)}


# Backwards-compatible wrappers (older call sites)

def compute_user_progress() -> dict[str, Any]:
    return compute_user_progress_payload()


def compute_user_history(limit: int = 20) -> list[dict[str, Any]]:
    return compute_user_history_payload(limit=limit)["items"]

# NOTE: Old duplicate implementations removed; use compute_user_progress_payload/compute_user_history_payload wrappers above.
