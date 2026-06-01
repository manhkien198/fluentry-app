from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.schemas.user import UserHistoryResponse, UserProgressResponse, UserTrendsResponse
from app.services.user_metrics import compute_user_history_payload, compute_user_progress_payload

router = APIRouter()


@router.get("/me/progress", response_model=UserProgressResponse)
def get_progress(current_user=Depends(get_current_user)) -> UserProgressResponse:
    return UserProgressResponse(**compute_user_progress_payload(user_id=current_user.id))


@router.get("/me/history", response_model=UserHistoryResponse)
def get_history(current_user=Depends(get_current_user)) -> UserHistoryResponse:
    return UserHistoryResponse(**compute_user_history_payload(user_id=current_user.id))


@router.get("/me/trends", response_model=UserTrendsResponse)
def get_trends(current_user=Depends(get_current_user)) -> UserTrendsResponse:
    progress = compute_user_progress_payload(user_id=current_user.id)
    trend = progress.get("trend") or {}
    return UserTrendsResponse(
        trend={
            "overall": list(trend.get("overall") or []),
            "pronunciation": list(trend.get("pronunciation") or []),
            "fluency": list(trend.get("fluency") or []),
        },
        consistency=list(progress.get("consistency") or []),
        achievements=list(progress.get("achievements") or []),
        today_minutes=int(progress.get("today_minutes") or 0),
        daily_target_minutes=int(progress.get("daily_target_minutes") or 15),
    )
