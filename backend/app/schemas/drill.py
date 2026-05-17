from pydantic import BaseModel


class DrillItem(BaseModel):
    id: str
    sound: str
    mode: str
    title: str
    prompt: str
    lesson_id: str


class DrillListResponse(BaseModel):
    items: list[DrillItem]
