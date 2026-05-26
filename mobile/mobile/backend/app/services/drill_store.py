from __future__ import annotations

from app.schemas.drill import DrillItem
from app.services.content_loader import load_seed_content
from app.services.db import DrillRecord, SessionLocal, init_db

init_db()


def ensure_default_drills() -> None:
    _lessons, drills = load_seed_content()
    with SessionLocal() as db:
        if db.query(DrillRecord).count() > 0:
            return
        for drill in drills:
            db.add(DrillRecord(**drill.model_dump()))
        db.commit()


def list_drills(sound: str | None = None, mode: str | None = None, limit: int = 50) -> list[DrillItem]:
    ensure_default_drills()
    with SessionLocal() as db:
        query = db.query(DrillRecord)
        if sound:
            query = query.filter(DrillRecord.sound == sound.strip().upper())
        if mode:
            query = query.filter(DrillRecord.mode == mode.strip().lower())
        rows = query.limit(limit).all()
        return [DrillItem(id=r.id, sound=r.sound, mode=r.mode, title=r.title, prompt=r.prompt, lesson_id=r.lesson_id) for r in rows]
