from __future__ import annotations

import argparse

from app.services.content_loader import load_content_manifest, load_seed_content
from app.services.db import DrillRecord, LessonRecord, SessionLocal, init_db


def upsert_content(dry_run: bool = False) -> dict[str, int]:
    manifest = load_content_manifest()
    lessons, drills = load_seed_content()
    init_db()
    created_lessons = 0
    updated_lessons = 0
    created_drills = 0
    updated_drills = 0

    with SessionLocal() as db:
        for lesson in lessons:
            row = db.get(LessonRecord, lesson.id)
            if row is None:
                created_lessons += 1
                if not dry_run:
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
            else:
                updated_lessons += 1
                if not dry_run:
                    row.title = lesson.title
                    row.level = lesson.level
                    row.duration_minutes = lesson.duration_minutes
                    row.xp = lesson.xp
                    row.prompt = lesson.prompt

        for drill in drills:
            row = db.get(DrillRecord, drill.id)
            if row is None:
                created_drills += 1
                if not dry_run:
                    db.add(DrillRecord(**drill.model_dump()))
            else:
                updated_drills += 1
                if not dry_run:
                    row.sound = drill.sound
                    row.mode = drill.mode
                    row.title = drill.title
                    row.prompt = drill.prompt
                    row.lesson_id = drill.lesson_id

        if not dry_run:
            db.commit()

    summary = {
        "lessons_created": created_lessons,
        "lessons_updated": updated_lessons,
        "drills_created": created_drills,
        "drills_updated": updated_drills,
        "dry_run": int(dry_run),
    }
    print(
        {
            "content_version": manifest["content_version"],
            "content_checksum": manifest["content_checksum"],
            **summary,
        }
    )
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed lessons and drills content into DB.")
    parser.add_argument("--dry-run", action="store_true", help="Validate and show changes without writing DB.")
    args = parser.parse_args()
    upsert_content(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
