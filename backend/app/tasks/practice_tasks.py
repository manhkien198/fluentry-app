from __future__ import annotations

import traceback

from app.services.pronunciation.feedback import generate_tips
from app.services.pronunciation.scorer import score_pronunciation
from app.services.session_store import load_session, save_session
from app.worker import celery_app


@celery_app.task(name="practice.run_scoring")
def run_practice_scoring(session_id: str) -> dict:
    session = load_session(session_id)
    if session is None:
        return {"status": "failed", "error": "Session not found"}

    session["score_status"] = "processing"
    save_session(session_id, session)

    try:
        result = score_pronunciation(
            session_id=session_id,
            expected_text=session["expected_text"],
            audio_path=session.get("audio_path"),
        )
        payload = {**result, "tips": generate_tips(result)}
        session["score_status"] = "done"
        session["score_result"] = payload
        session.pop("score_error", None)
        save_session(session_id, session)
        return {"status": "done"}
    except Exception as exc:
        session["score_status"] = "failed"
        session["score_error"] = f"{exc}\n{traceback.format_exc()}"
        save_session(session_id, session)
        return {"status": "failed", "error": str(exc)}
