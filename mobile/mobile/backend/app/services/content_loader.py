from __future__ import annotations

import json
import hashlib
from pathlib import Path
from typing import Any

from app.schemas.drill import DrillItem
from app.schemas.lesson import Lesson
from app.services.lesson_rubric import compute_lesson_rubric

BASE_DIR = Path(__file__).resolve().parent.parent.parent
CONTENT_DIR = BASE_DIR / "content"
LESSONS_PATH = CONTENT_DIR / "lessons.json"
DRILLS_PATH = CONTENT_DIR / "drills.json"
MANIFEST_PATH = CONTENT_DIR / "manifest.json"

ALLOWED_LEVELS = {"Beginner", "Intermediate", "Advanced"}
ALLOWED_MODES = {"minimal_pairs", "words", "sentences"}
ALLOWED_SOUNDS = {"TH", "R", "L"}


def _read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _validate_lessons_payload(rows: list[dict[str, Any]]) -> list[Lesson]:
    seen_ids: set[str] = set()
    lessons: list[Lesson] = []
    for row in rows:
        lesson = Lesson(**row)
        if lesson.id in seen_ids:
            raise ValueError(f"Duplicate lesson id: {lesson.id}")
        seen_ids.add(lesson.id)
        if lesson.level not in ALLOWED_LEVELS:
            raise ValueError(f"Invalid lesson level for {lesson.id}: {lesson.level}")
        if len(lesson.prompt.strip()) < 10:
            raise ValueError(f"Lesson prompt too short: {lesson.id}")
        rubric = compute_lesson_rubric(lesson.level, lesson.prompt)
        if lesson.level == "Beginner" and rubric.complexity_score > 75:
            raise ValueError(f"Beginner lesson too complex: {lesson.id}")
        if lesson.level == "Advanced" and rubric.complexity_score < 45:
            raise ValueError(f"Advanced lesson too simple: {lesson.id}")
        lessons.append(lesson)
    return lessons


def _validate_drills_payload(rows: list[dict[str, Any]], lesson_ids: set[str]) -> list[DrillItem]:
    seen_ids: set[str] = set()
    drills: list[DrillItem] = []
    for row in rows:
        drill = DrillItem(**row)
        if drill.id in seen_ids:
            raise ValueError(f"Duplicate drill id: {drill.id}")
        seen_ids.add(drill.id)
        if drill.mode not in ALLOWED_MODES:
            raise ValueError(f"Invalid drill mode for {drill.id}: {drill.mode}")
        if drill.sound not in ALLOWED_SOUNDS:
            raise ValueError(f"Invalid drill sound for {drill.id}: {drill.sound}")
        if drill.lesson_id not in lesson_ids:
            raise ValueError(f"Drill references missing lesson: {drill.id} -> {drill.lesson_id}")
        drills.append(drill)
    return drills


def load_seed_content() -> tuple[list[Lesson], list[DrillItem]]:
    lesson_rows = _read_json(LESSONS_PATH)
    drill_rows = _read_json(DRILLS_PATH)
    if not isinstance(lesson_rows, list) or not isinstance(drill_rows, list):
        raise ValueError("Content files must be JSON arrays.")

    lessons = _validate_lessons_payload(lesson_rows)
    lesson_ids = {lesson.id for lesson in lessons}
    drills = _validate_drills_payload(drill_rows, lesson_ids)
    return lessons, drills


def load_content_manifest() -> dict[str, str]:
    payload = _read_json(MANIFEST_PATH)
    if not isinstance(payload, dict):
        raise ValueError("manifest.json must be a JSON object.")
    version = payload.get("content_version")
    if not isinstance(version, str) or not version.strip():
        raise ValueError("manifest.json requires non-empty 'content_version'.")
    description = payload.get("description", "")
    if description is None:
        description = ""
    if not isinstance(description, str):
        raise ValueError("manifest.json field 'description' must be a string.")
    checksum = _compute_content_checksum()
    return {"content_version": version.strip(), "description": description.strip(), "content_checksum": checksum}


def _compute_content_checksum() -> str:
    hasher = hashlib.sha256()
    for path in (LESSONS_PATH, DRILLS_PATH):
        with path.open("rb") as f:
            hasher.update(f.read())
    return hasher.hexdigest()
