from __future__ import annotations

from app.schemas.lesson import Lesson
from app.services.content_loader import load_seed_content
from app.services.db import LessonRecord, SessionLocal, init_db
from app.services.lesson_rubric import compute_lesson_rubric

init_db()


def ensure_default_lessons() -> None:
    lessons, _ = load_seed_content()
    with SessionLocal() as db:
        if db.query(LessonRecord).count() > 0:
            return
        for lesson in lessons:
            db.add(
                LessonRecord(
                    id=lesson.id,
                    title=lesson.title,
                    level=lesson.level,
                    duration_minutes=lesson.duration_minutes,
                    xp=lesson.xp,
                    prompt=lesson.prompt,
                )
            )
        db.commit()


def list_lessons() -> list[Lesson]:
    ensure_default_lessons()
    with SessionLocal() as db:
        rows = db.query(LessonRecord).order_by(LessonRecord.id.asc()).all()
        return [
            Lesson(
                id=row.id,
                title=row.title,
                level=row.level,
                duration_minutes=row.duration_minutes,
                xp=row.xp,
                prompt=row.prompt,
                rubric=compute_lesson_rubric(row.level, row.prompt),
            )
            for row in rows
        ]


def get_lesson(lesson_id: str) -> Lesson | None:
    ensure_default_lessons()
    with SessionLocal() as db:
        row = db.get(LessonRecord, lesson_id)
        if row is None:
            return None
        return Lesson(
            id=row.id,
            title=row.title,
            level=row.level,
            duration_minutes=row.duration_minutes,
            xp=row.xp,
            prompt=row.prompt,
            rubric=compute_lesson_rubric(row.level, row.prompt),
        )
