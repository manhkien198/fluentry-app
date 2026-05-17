from fastapi import APIRouter, HTTPException

from app.schemas.lesson import Lesson, LessonListResponse

router = APIRouter()

LESSONS = [
    Lesson(
        id="lesson-1",
        title="Confident Introductions",
        level="Beginner",
        duration_minutes=8,
        xp=30,
        prompt="Hello, my name is Anna and I love learning English every day.",
    ),
    Lesson(
        id="lesson-2",
        title="Travel Essentials",
        level="Intermediate",
        duration_minutes=10,
        xp=45,
        prompt="Could you tell me where the nearest train station is?",
    ),
    Lesson(
        id="lesson-3",
        title="Work Presentation",
        level="Advanced",
        duration_minutes=12,
        xp=60,
        prompt="Our quarterly results exceeded expectations because the team executed consistently.",
    ),
]


@router.get("", response_model=LessonListResponse)
def list_lessons() -> LessonListResponse:
    return LessonListResponse(items=LESSONS)


@router.get("/{lesson_id}", response_model=Lesson)
def get_lesson(lesson_id: str) -> Lesson:
    lesson = next((item for item in LESSONS if item.id == lesson_id), None)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return lesson
