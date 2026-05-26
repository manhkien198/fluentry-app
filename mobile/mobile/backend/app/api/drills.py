from __future__ import annotations

from fastapi import APIRouter, Query

from app.schemas.drill import DrillListResponse
from app.services.drill_store import list_drills as list_drills_from_db

router = APIRouter()


@router.get("", response_model=DrillListResponse)
def list_drills(
    sound: str | None = Query(default=None),
    mode: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> DrillListResponse:
    return DrillListResponse(items=list_drills_from_db(sound=sound, mode=mode, limit=limit))
