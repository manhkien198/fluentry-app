from pydantic import BaseModel


class Lesson(BaseModel):
    id: str
    title: str
    level: str
    duration_minutes: int
    xp: int
    prompt: str


class LessonListResponse(BaseModel):
    items: list[Lesson]
