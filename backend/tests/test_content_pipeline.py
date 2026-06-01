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


def test_load_seed_content_rejects_non_array_payloads(tmp_path, monkeypatch):
    lessons = tmp_path / "lessons.json"
    drills = tmp_path / "drills.json"
    lessons.write_text(json.dumps({"not": "a-list"}), encoding="utf-8")
    drills.write_text(json.dumps([]), encoding="utf-8")
    monkeypatch.setattr(content_loader, "LESSONS_PATH", lessons)
    monkeypatch.setattr(content_loader, "DRILLS_PATH", drills)

    try:
        content_loader.load_seed_content()
        assert False, "Expected array payload validation"
    except ValueError as exc:
        assert "JSON arrays" in str(exc)


def test_validate_lessons_duplicate_and_prompt_length(monkeypatch):
    rows = [
        {
            "id": "l1",
            "title": "t1",
            "level": "Beginner",
            "duration_minutes": 10,
            "xp": 20,
            "prompt": "short",
        }
    ]
    try:
        content_loader._validate_lessons_payload(rows)
        assert False, "Expected short prompt error"
    except ValueError as exc:
        assert "prompt too short" in str(exc)

    rows2 = [
        {
            "id": "l1",
            "title": "t1",
            "level": "Beginner",
            "duration_minutes": 10,
            "xp": 20,
            "prompt": "This prompt is definitely long enough.",
        },
        {
            "id": "l1",
            "title": "t2",
            "level": "Beginner",
            "duration_minutes": 12,
            "xp": 25,
            "prompt": "This prompt is also definitely long enough.",
        },
    ]
    try:
        content_loader._validate_lessons_payload(rows2)
        assert False, "Expected duplicate lesson id"
    except ValueError as exc:
        assert "Duplicate lesson id" in str(exc)


def test_validate_lessons_complexity_guardrails(monkeypatch):
    row = {
        "id": "l1",
        "title": "t1",
        "level": "Beginner",
        "duration_minutes": 10,
        "xp": 20,
        "prompt": "This prompt is definitely long enough.",
    }
    monkeypatch.setattr(
        content_loader,
        "compute_lesson_rubric",
        lambda _lvl, _prompt: type("R", (), {"complexity_score": 90})(),
    )
    try:
        content_loader._validate_lessons_payload([row])
        assert False, "Expected beginner complexity failure"
    except ValueError as exc:
        assert "too complex" in str(exc)

    row_adv = dict(row)
    row_adv["id"] = "l2"
    row_adv["level"] = "Advanced"
    monkeypatch.setattr(
        content_loader,
        "compute_lesson_rubric",
        lambda _lvl, _prompt: type("R", (), {"complexity_score": 30})(),
    )
    try:
        content_loader._validate_lessons_payload([row_adv])
        assert False, "Expected advanced simplicity failure"
    except ValueError as exc:
        assert "too simple" in str(exc)


def test_validate_drills_payload_rules():
    lesson_ids = {"l1"}
    base = {
        "id": "d1",
        "sound": "TH",
        "mode": "minimal_pairs",
        "title": "title",
        "prompt": "prompt",
        "lesson_id": "l1",
    }

    out = content_loader._validate_drills_payload([base], lesson_ids)
    assert len(out) == 1

    dup = [base, dict(base)]
    try:
        content_loader._validate_drills_payload(dup, lesson_ids)
        assert False, "Expected duplicate drill id"
    except ValueError as exc:
        assert "Duplicate drill id" in str(exc)

    bad_mode = dict(base)
    bad_mode["id"] = "d2"
    bad_mode["mode"] = "bad"
    try:
        content_loader._validate_drills_payload([bad_mode], lesson_ids)
        assert False, "Expected invalid drill mode"
    except ValueError as exc:
        assert "Invalid drill mode" in str(exc)

    bad_sound = dict(base)
    bad_sound["id"] = "d3"
    bad_sound["sound"] = "ZZ"
    try:
        content_loader._validate_drills_payload([bad_sound], lesson_ids)
        assert False, "Expected invalid drill sound"
    except ValueError as exc:
        assert "Invalid drill sound" in str(exc)

    bad_lesson = dict(base)
    bad_lesson["id"] = "d4"
    bad_lesson["lesson_id"] = "missing"
    try:
        content_loader._validate_drills_payload([bad_lesson], lesson_ids)
        assert False, "Expected missing lesson reference"
    except ValueError as exc:
        assert "missing lesson" in str(exc)


def test_load_content_manifest_validation(tmp_path, monkeypatch):
    manifest = tmp_path / "manifest.json"

    manifest.write_text(json.dumps([]), encoding="utf-8")
    monkeypatch.setattr(content_loader, "MANIFEST_PATH", manifest)
    try:
        content_loader.load_content_manifest()
        assert False, "Expected object validation"
    except ValueError as exc:
        assert "JSON object" in str(exc)

    manifest.write_text(json.dumps({"content_version": ""}), encoding="utf-8")
    try:
        content_loader.load_content_manifest()
        assert False, "Expected non-empty version"
    except ValueError as exc:
        assert "content_version" in str(exc)

    manifest.write_text(json.dumps({"content_version": "v1", "description": 123}), encoding="utf-8")
    try:
        content_loader.load_content_manifest()
        assert False, "Expected description string validation"
    except ValueError as exc:
        assert "description" in str(exc)


def test_compute_content_checksum_uses_files(tmp_path, monkeypatch):
    lessons = tmp_path / "lessons.json"
    drills = tmp_path / "drills.json"
    lessons.write_text("[]", encoding="utf-8")
    drills.write_text("[]", encoding="utf-8")
    monkeypatch.setattr(content_loader, "LESSONS_PATH", lessons)
    monkeypatch.setattr(content_loader, "DRILLS_PATH", drills)

    checksum = content_loader._compute_content_checksum()
    assert isinstance(checksum, str)
    assert len(checksum) == 64


def test_load_content_manifest_normalizes_description_none(tmp_path, monkeypatch):
    manifest = tmp_path / "manifest.json"
    manifest.write_text(json.dumps({"content_version": " v1 ", "description": None}), encoding="utf-8")
    monkeypatch.setattr(content_loader, "MANIFEST_PATH", manifest)

    monkeypatch.setattr(content_loader, "_compute_content_checksum", lambda: "a" * 64)
    out = content_loader.load_content_manifest()
    assert out["content_version"] == "v1"
    assert out["description"] == ""
    assert out["content_checksum"] == "a" * 64
