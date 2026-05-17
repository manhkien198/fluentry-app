from __future__ import annotations

from pathlib import Path

from app.core.config import UPLOAD_DIR

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def save_upload(session_id: str, filename: str, content: bytes) -> Path:
    suffix = Path(filename).suffix or ".bin"
    path = UPLOAD_DIR / f"{session_id}{suffix}"
    path.write_bytes(content)
    return path
