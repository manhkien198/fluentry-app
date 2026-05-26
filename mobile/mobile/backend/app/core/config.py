from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", DATA_DIR / "uploads"))
SESSION_DIR = Path(os.getenv("SESSION_DIR", DATA_DIR / "sessions"))
MFA_WORK_DIR = Path(os.getenv("MFA_WORK_DIR", DATA_DIR / "mfa"))
MFA_ENABLED = os.getenv("MFA_ENABLED", "false").lower() == "true"
MFA_MODEL_PATH = os.getenv("MFA_MODEL_PATH", "")
MFA_DICTIONARY_PATH = os.getenv("MFA_DICTIONARY_PATH", "")
MFA_BINARY = os.getenv("MFA_BINARY", "mfa")
FFMPEG_BINARY = os.getenv("FFMPEG_BINARY", "ffmpeg")
APP_ENV = os.getenv("APP_ENV", "development").lower()
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{(DATA_DIR / 'fluentry.db').as_posix()}")
JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production-at-least-32-chars")
JWT_ALG = os.getenv("JWT_ALG", "HS256")
JWT_EXPIRES_MINUTES = int(os.getenv("JWT_EXPIRES_MINUTES", "1440"))
METRICS_TOKEN = os.getenv("METRICS_TOKEN", "")
SSO_VERIFY_SIGNATURE = os.getenv("SSO_VERIFY_SIGNATURE", "false").lower() == "true"
SSO_GOOGLE_ISSUER = os.getenv("SSO_GOOGLE_ISSUER", "https://accounts.google.com")
SSO_GOOGLE_AUDIENCE = os.getenv("SSO_GOOGLE_AUDIENCE", "")
SSO_APPLE_ISSUER = os.getenv("SSO_APPLE_ISSUER", "https://appleid.apple.com")
SSO_APPLE_AUDIENCE = os.getenv("SSO_APPLE_AUDIENCE", "")
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", "no-reply@fluentry.local")
SMTP_STARTTLS = os.getenv("SMTP_STARTTLS", "true").lower() == "true"


CORS_ALLOW_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOW_ORIGINS", "http://localhost:8081,http://localhost:19006,http://127.0.0.1:8081,http://127.0.0.1:19006").split(",")
    if origin.strip()
]
CORS_ALLOW_CREDENTIALS = os.getenv("CORS_ALLOW_CREDENTIALS", "true").lower() == "true"

if "*" in CORS_ALLOW_ORIGINS and CORS_ALLOW_CREDENTIALS:
    CORS_ALLOW_CREDENTIALS = False

if APP_ENV in {"production", "prod"} and "*" in CORS_ALLOW_ORIGINS:
    raise RuntimeError("CORS_ALLOW_ORIGINS must not include '*' in production.")

if APP_ENV in {"production", "prod"} and len(JWT_SECRET) < 32:
    raise RuntimeError("JWT_SECRET must be at least 32 characters in production.")

if APP_ENV in {"production", "prod"} and not METRICS_TOKEN:
    raise RuntimeError("METRICS_TOKEN is required in production.")

if APP_ENV in {"production", "prod"} and SSO_VERIFY_SIGNATURE and not SSO_GOOGLE_AUDIENCE:
    raise RuntimeError("SSO_GOOGLE_AUDIENCE is required in production when signature verification is enabled.")

if APP_ENV in {"production", "prod"} and SSO_VERIFY_SIGNATURE and not SSO_APPLE_AUDIENCE:
    raise RuntimeError("SSO_APPLE_AUDIENCE is required in production when signature verification is enabled.")
