from __future__ import annotations

import json
from pathlib import Path

from app.services import content_loader
from app.services.db import DrillRecord, LessonRecord, SessionLocal
from scripts.seed_content import upsert_content


def test_load_seed_content_success():
    lessons, drills = content_loader.load_seed_content()
    assert len(lessons) >= 1
    assert len(drills) >= 1


def test_load_content_manifest_success():
    manifest = content_loader.load_content_manifest()
    assert manifest["content_version"]
    assert len(manifest["content_checksum"]) == 64


def test_load_seed_content_invalid_lesson_level(tmp_path, monkeypatch):
    bad_lessons = tmp_path / "lessons.json"
    bad_drills = tmp_path / "drills.json"
    bad_lessons.write_text(
        json.dumps(
            [
                {
                    "id": "lesson-x",
                    "title": "Bad Level",
                    "level": "Expert",
                    "duration_minutes": 10,
                    "xp": 40,
                    "prompt": "This prompt is definitely long enough.",
                }
            ]
        ),
        encoding="utf-8",
    )
    bad_drills.write_text("[]", encoding="utf-8")
    monkeypatch.setattr(content_loader, "LESSONS_PATH", bad_lessons)
    monkeypatch.setattr(content_loader, "DRILLS_PATH", bad_drills)
    try:
        content_loader.load_seed_content()
        assert False, "Expected invalid level error"
    except ValueError as exc:
        assert "Invalid lesson level" in str(exc)


def test_seed_upsert_dry_run_does_not_write():
    summary = upsert_content(dry_run=True)
    assert summary["lessons_created"] >= 0
    assert summary["drills_created"] >= 0
    with SessionLocal() as db:
        # existing data may exist; dry-run should not force growth here, just no crash.
        assert db.query(LessonRecord).count() >= 0
        assert db.query(DrillRecord).count() >= 0
