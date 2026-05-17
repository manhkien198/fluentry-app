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


CORS_ALLOW_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOW_ORIGINS", "http://localhost:8081,http://localhost:19006,http://127.0.0.1:8081,http://127.0.0.1:19006").split(",")
    if origin.strip()
]
CORS_ALLOW_CREDENTIALS = os.getenv("CORS_ALLOW_CREDENTIALS", "true").lower() == "true"

if "*" in CORS_ALLOW_ORIGINS and CORS_ALLOW_CREDENTIALS:
    CORS_ALLOW_CREDENTIALS = False
