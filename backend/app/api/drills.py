from __future__ import annotations

from fastapi import APIRouter, Query

from app.schemas.drill import DrillItem, DrillListResponse

router = APIRouter()


# Server-seeded drill content (API-backed for the mobile app).
# In later iterations, these can be generated per-user from scoring history.
DRILLS: list[DrillItem] = [
    DrillItem(
        id="drill-th-min-1",
        sound="TH",
        mode="minimal_pairs",
        title="thin / tin",
        prompt="thin",
        lesson_id="lesson-1",
    ),
    DrillItem(
        id="drill-th-min-2",
        sound="TH",
        mode="minimal_pairs",
        title="thank / tank",
        prompt="thank",
        lesson_id="lesson-1",
    ),
    DrillItem(
        id="drill-th-sent-1",
        sound="TH",
        mode="sentences",
        title="Airflow steady",
        prompt="I think this is the best one.",
        lesson_id="lesson-1",
    ),
    DrillItem(
        id="drill-r-min-1",
        sound="R",
        mode="minimal_pairs",
        title="right / light",
        prompt="right",
        lesson_id="lesson-1",
    ),
    DrillItem(
        id="drill-r-sent-1",
        sound="R",
        mode="sentences",
        title="Keep R consistent",
        prompt="I really like reading.",
        lesson_id="lesson-1",
    ),
    DrillItem(
        id="drill-l-words-1",
        sound="L",
        mode="words",
        title="Clear tongue contact",
        prompt="light",
        lesson_id="lesson-1",
    ),
    DrillItem(
        id="drill-l-sent-1",
        sound="L",
        mode="sentences",
        title="Crisp L",
        prompt="Let’s learn a little every day.",
        lesson_id="lesson-1",
    ),
]


@router.get("", response_model=DrillListResponse)
def list_drills(
    sound: str | None = Query(default=None),
    mode: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> DrillListResponse:
    items = DRILLS

    if sound:
        s = sound.strip().upper()
        items = [d for d in items if d.sound.upper() == s]

    if mode:
        m = mode.strip().lower()
        items = [d for d in items if d.mode.lower() == m]

    return DrillListResponse(items=items[:limit])
