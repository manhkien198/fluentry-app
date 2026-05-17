from fastapi import APIRouter

from app.schemas.auth import AuthRequest, AuthResponse, UserProfile

router = APIRouter()


@router.post("/login", response_model=AuthResponse)
def login(payload: AuthRequest) -> AuthResponse:
    return AuthResponse(
        access_token="demo-token",
        user=UserProfile(id="user-1", email=payload.email, display_name="Demo Learner"),
    )


@router.post("/register", response_model=AuthResponse)
def register(payload: AuthRequest) -> AuthResponse:
    return AuthResponse(
        access_token="demo-token",
        user=UserProfile(id="user-1", email=payload.email, display_name="Demo Learner"),
    )
