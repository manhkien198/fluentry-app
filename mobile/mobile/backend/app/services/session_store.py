from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.core.config import SESSION_DIR
from app.services.db import PracticeSessionRecord, SessionLocal, init_db, utc_now

init_db()


def _from_record(record: PracticeSessionRecord) -> dict[str, Any]:
    return {
        "session_id": record.session_id,
        "user_id": record.user_id,
        "lesson_id": record.lesson_id,
        "expected_text": record.expected_text,
        "status": record.status,
        "audio_path": record.audio_path,
        "score_status": record.score_status,
        "score_task_id": record.score_task_id,
        "score_result": record.score_result,
        "score_error": record.score_error,
        "created_at": record.created_at.isoformat() if record.created_at else None,
        "updated_at": record.updated_at.isoformat() if record.updated_at else None,
    }


def save_session(session_id: str, data: dict[str, Any]) -> None:
    now = utc_now()
    with SessionLocal() as db:
        record = db.get(PracticeSessionRecord, session_id)
        if record is None:
            record = PracticeSessionRecord(
                session_id=session_id,
                user_id=data.get("user_id", "user-legacy"),
                lesson_id=data["lesson_id"],
                expected_text=data["expected_text"],
                status=data.get("status", "created"),
                audio_path=data.get("audio_path"),
                score_status=data.get("score_status"),
                score_task_id=data.get("score_task_id"),
                score_result=data.get("score_result"),
                score_error=data.get("score_error"),
                created_at=now,
                updated_at=now,
            )
            db.add(record)
        else:
            record.lesson_id = data.get("lesson_id", record.lesson_id)
            record.user_id = data.get("user_id", record.user_id)
            record.expected_text = data.get("expected_text", record.expected_text)
            record.status = data.get("status", record.status)
            record.audio_path = data.get("audio_path", record.audio_path)
            record.score_status = data.get("score_status", record.score_status)
            record.score_task_id = data.get("score_task_id", record.score_task_id)
            record.score_result = data.get("score_result", record.score_result)
            record.score_error = data.get("score_error", record.score_error)
            record.updated_at = now
        db.commit()


def load_session(session_id: str, user_id: str | None = None) -> dict[str, Any] | None:
    with SessionLocal() as db:
        record = db.get(PracticeSessionRecord, session_id)
        if record and (user_id is None or record.user_id == user_id):
            return _from_record(record)
    return _load_session_legacy_file(session_id)


def list_sessions(user_id: str | None = None) -> list[dict[str, Any]]:
    with SessionLocal() as db:
        query = db.query(PracticeSessionRecord)
        if user_id:
            query = query.filter(PracticeSessionRecord.user_id == user_id)
        rows = query.all()
        return [_from_record(row) for row in rows]


def _load_session_legacy_file(session_id: str) -> dict[str, Any] | None:
    path = SESSION_DIR / f"{session_id}.json"
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        save_session(session_id, data)
        return data
    except Exception:
        return None


def migrate_legacy_sessions() -> int:
    SESSION_DIR.mkdir(parents=True, exist_ok=True)
    migrated = 0
    for path in Path(SESSION_DIR).glob("session-*.json"):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            session_id = data.get("session_id")
            if not session_id:
                continue
            save_session(session_id, data)
            migrated += 1
        except Exception:
            continue
    return migrated
