from pydantic import BaseModel


class AchievementItem(BaseModel):
    id: str
    title: str
    value: str


class TrendSeries(BaseModel):
    overall: list[int]
    pronunciation: list[int]
    fluency: list[int]


class UserProgressResponse(BaseModel):
    streak: int
    xp: int
    level: str
    pronunciation_score: int
    fluency_score: int
    confidence_score: int
    weak_sounds: list[str]

    computed_at: str
    session_count: int
    today_minutes: int
    daily_target_minutes: int
    trend: TrendSeries
    consistency: list[int]
    achievements: list[AchievementItem]


class HistoryItem(BaseModel):
    session_id: str
    overall_score: int
    lesson_title: str


class UserHistoryResponse(BaseModel):
    items: list[HistoryItem]
