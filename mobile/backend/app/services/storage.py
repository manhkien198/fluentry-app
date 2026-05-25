from __future__ import annotations

from pathlib import Path
from tempfile import NamedTemporaryFile
from uuid import uuid4

from app.services.db import AudioAssetRecord, SessionLocal, init_db

init_db()


def save_upload(session_id: str, filename: str, content: bytes) -> str:
    asset_id = f"asset-{uuid4()}"
    content_type = "audio/m4a" if filename.endswith(".m4a") else "application/octet-stream"
    with SessionLocal() as db:
        db.add(
            AudioAssetRecord(
                id=asset_id,
                session_id=session_id,
                filename=filename,
                content_type=content_type,
                payload=content,
            )
        )
        db.commit()
    return f"db://audio/{asset_id}"


def materialize_audio_path(audio_path: str | None) -> str | None:
    if not audio_path or not audio_path.startswith("db://audio/"):
        return audio_path
    asset_id = audio_path.split("/")[-1]
    with SessionLocal() as db:
        row = db.get(AudioAssetRecord, asset_id)
        if row is None:
            return None
        suffix = Path(row.filename).suffix or ".bin"
        with NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(row.payload)
            return tmp.name

