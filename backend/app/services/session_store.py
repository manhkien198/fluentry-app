from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.core.config import SESSION_DIR

SESSION_DIR.mkdir(parents=True, exist_ok=True)


def _session_path(session_id: str) -> Path:
    return SESSION_DIR / f"{session_id}.json"


def save_session(session_id: str, data: dict[str, Any]) -> None:
    # Add simple timestamps for ordering/analytics.
    if "created_at" not in data:
        data["created_at"] = datetime.now(timezone.utc).isoformat()
    data["updated_at"] = datetime.now(timezone.utc).isoformat()

    _session_path(session_id).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def load_session(session_id: str) -> dict[str, Any] | None:
    path = _session_path(session_id)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def list_sessions() -> list[dict[str, Any]]:
    sessions: list[dict[str, Any]] = []
    for path in SESSION_DIR.glob("session-*.json"):
        try:
            sessions.append(json.loads(path.read_text(encoding="utf-8")))
        except Exception:
            continue
    return sessions
