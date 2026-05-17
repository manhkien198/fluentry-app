from fastapi import APIRouter

from app.schemas.user import UserHistoryResponse, UserProgressResponse
from app.services.user_metrics import compute_user_history_payload, compute_user_progress_payload

router = APIRouter()


@router.get("/me/progress", response_model=UserProgressResponse)
def get_progress() -> UserProgressResponse:
    return UserProgressResponse(**compute_user_progress_payload())


@router.get("/me/history", response_model=UserHistoryResponse)
def get_history() -> UserHistoryResponse:
    return UserHistoryResponse(**compute_user_history_payload())


@router.get("/me/trends")
def get_trends():
    progress = compute_user_progress_payload()
    return {
        "trend": progress.get("trend", {}),
        "consistency": progress.get("consistency", []),
        "achievements": progress.get("achievements", []),
        "today_minutes": progress.get("today_minutes", 0),
        "daily_target_minutes": progress.get("daily_target_minutes", 15),
    }
