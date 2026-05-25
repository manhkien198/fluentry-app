from __future__ import annotations

import traceback
from pathlib import Path

from app.services.pronunciation.feedback import generate_tips
from app.services.pronunciation.scorer import score_pronunciation
from app.services.session_store import load_session, save_session
from app.services.storage import materialize_audio_path
from app.worker import celery_app


@celery_app.task(bind=True, name="practice.run_scoring", autoretry_for=(), retry_backoff=False)
def run_practice_scoring(self, session_id: str) -> dict:
    session = load_session(session_id)
    if session is None:
        return {"status": "failed", "error": "Session not found"}

    session["score_status"] = "processing"
    save_session(session_id, session)
    audio_path: str | None = None

    try:
        audio_path = materialize_audio_path(session.get("audio_path"))
        result = score_pronunciation(
            session_id=session_id,
            expected_text=session["expected_text"],
            audio_path=audio_path,
        )
        payload = {**result, "tips": generate_tips(result)}
        session["score_status"] = "done"
        session["score_result"] = payload
        session.pop("score_error", None)
        save_session(session_id, session)
        return {"status": "done"}
    except Exception as exc:
        try:
            self.retry(exc=exc, countdown=5, max_retries=3)
        except Exception:
            pass
        session["score_status"] = "failed"
        session["score_error"] = f"{exc}\n{traceback.format_exc()}"
        save_session(session_id, session)
        return {"status": "failed", "error": str(exc)}
    finally:
        if audio_path and audio_path.startswith("/tmp"):
            try:
                Path(audio_path).unlink(missing_ok=True)
            except Exception:
                pass
