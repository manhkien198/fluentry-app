from fastapi import APIRouter, HTTPException

from app.schemas.lesson import Lesson, LessonListResponse
from app.services.lesson_store import get_lesson as get_lesson_from_db, list_lessons as list_lessons_from_db

router = APIRouter()


@router.get("", response_model=LessonListResponse)
def list_lessons() -> LessonListResponse:
    return LessonListResponse(items=list_lessons_from_db())


@router.get("/{lesson_id}", response_model=Lesson)
def get_lesson(lesson_id: str) -> Lesson:
    lesson = get_lesson_from_db(lesson_id)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return lesson
