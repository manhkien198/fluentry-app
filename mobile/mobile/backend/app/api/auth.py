from fastapi import APIRouter, HTTPException
import logging
from app.core.config import APP_ENV

from app.schemas.auth import AuthRequest, AuthResponse, RefreshRequest, ResendVerificationRequest, SSORequest, UserProfile, VerifyEmailRequest
from app.services.auth_service import (
    authenticate_user,
    create_email_verification_token,
    create_access_token,
    create_refresh_token,
    create_user,
    get_or_create_sso_user,
    revoke_refresh_token,
    rotate_refresh_token,
    verify_email_token,
)
from app.services.rate_limit import allow_request
from app.services.runtime_metrics import inc
from app.services.sso_service import decode_sso_claims
from app.services.mailer import send_verification_email

router = APIRouter()
logger = logging.getLogger("fluentry.auth")


@router.post("/login", response_model=AuthResponse)
def login(payload: AuthRequest) -> AuthResponse:
    if not allow_request(f"auth-login:{payload.email}", limit=10, window_seconds=60):
        inc("auth.login.ratelimited")
        raise HTTPException(status_code=429, detail="Too many login attempts")
    user = authenticate_user(payload.email, payload.password)
    if user is None:
        inc("auth.login.failed")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if user.email_verified != "true":
        inc("auth.login.unverified")
        raise HTTPException(status_code=403, detail="Email not verified")
    inc("auth.login.success")
    token = create_access_token(user.id, user.email)
    refresh_token = create_refresh_token(user.id)
    return AuthResponse(
        access_token=token,
        refresh_token=refresh_token,
        user=UserProfile(id=user.id, email=user.email, display_name=user.display_name),
    )


@router.post("/register")
def register(payload: AuthRequest) -> dict[str, str]:
    if not allow_request(f"auth-register:{payload.email}", limit=5, window_seconds=60):
        inc("auth.register.ratelimited")
        raise HTTPException(status_code=429, detail="Too many register attempts")
    try:
        user = create_user(payload.email, payload.password, display_name="Learner")
    except ValueError as exc:
        inc("auth.register.failed")
        raise HTTPException(status_code=400, detail=str(exc))
    inc("auth.register.success")
    verify_token = create_email_verification_token(user.email)
    if not verify_token:
        raise HTTPException(status_code=500, detail="Unable to create verification token")
    send_verification_email(user.email, verify_token)
    return {"status": "verification_sent"}


@router.post("/refresh", response_model=AuthResponse)
def refresh(payload: RefreshRequest) -> AuthResponse:
    user = rotate_refresh_token(payload.refresh_token)
    if user is None:
        inc("auth.refresh.failed")
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    inc("auth.refresh.success")
    token = create_access_token(user["id"], user["email"])
    refresh_token = create_refresh_token(user["id"])
    return AuthResponse(
        access_token=token,
        refresh_token=refresh_token,
        user=UserProfile(id=user["id"], email=user["email"], display_name=user["display_name"]),
    )


@router.post("/logout")
def logout(payload: RefreshRequest) -> dict[str, str]:
    revoke_refresh_token(payload.refresh_token)
    inc("auth.logout.success")
    return {"status": "ok"}


@router.post("/verify-email")
def verify_email(payload: VerifyEmailRequest) -> dict[str, str]:
    user = verify_email_token(payload.token)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")
    inc("auth.verify_email.success")
    return {"status": "verified"}


@router.post("/resend-verification")
def resend_verification(payload: ResendVerificationRequest) -> dict[str, str]:
    if not allow_request(f"auth-resend:{payload.email}", limit=5, window_seconds=300):
        raise HTTPException(status_code=429, detail="Too many resend attempts")
    token = create_email_verification_token(payload.email)
    if not token:
        raise HTTPException(status_code=404, detail="Account not found")
    send_verification_email(payload.email, token)
    inc("auth.verify_email.resent")
    return {"status": "sent"}


@router.post("/sso", response_model=AuthResponse)
def sso_login(payload: SSORequest) -> AuthResponse:
    provider = payload.provider.strip().lower()
    if provider not in {"google", "apple"}:
        inc("auth.sso.failed")
        raise HTTPException(status_code=400, detail="Unsupported SSO provider")
    if not allow_request(f"auth-sso:{provider}", limit=20, window_seconds=60):
        inc("auth.sso.ratelimited")
        raise HTTPException(status_code=429, detail="Too many SSO attempts")
    try:
        claims = decode_sso_claims(provider=provider, id_token=payload.id_token)
    except Exception as exc:
        inc("auth.sso.failed")
        logger.exception("SSO decode failed provider=%s error=%s", provider, str(exc))
        if APP_ENV in {"development", "dev"}:
            raise HTTPException(status_code=401, detail=f"Invalid SSO token: {exc}")
        raise HTTPException(status_code=401, detail="Invalid SSO token")
    logger.info(
        "SSO claims provider=%s email=%s aud=%s iss=%s",
        provider,
        claims.get("email"),
        claims.get("aud"),
        claims.get("iss"),
    )
    email = claims.get("email")
    if not isinstance(email, str) or not email:
        inc("auth.sso.failed")
        raise HTTPException(status_code=401, detail="SSO token missing email")
    display_name = claims.get("name") if isinstance(claims.get("name"), str) else "Learner"
    user = get_or_create_sso_user(email=email, display_name=display_name)
    access_token = create_access_token(user.id, user.email)
    refresh_token = create_refresh_token(user.id)
    inc("auth.sso.success")
    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserProfile(id=user.id, email=user.email, display_name=user.display_name),
    )
