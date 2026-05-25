from pydantic import BaseModel


class LessonRubric(BaseModel):
    cefr: str
    complexity_score: int
    phoneme_coverage: int
    fluency_demand: int


class Lesson(BaseModel):
    id: str
    title: str
    level: str
    duration_minutes: int
    xp: int
    prompt: str
    rubric: LessonRubric | None = None


class LessonListResponse(BaseModel):
    items: list[Lesson]
