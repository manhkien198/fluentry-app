from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
from time import perf_counter
from uuid import uuid4

from app.api.auth import router as auth_router
from app.api.lessons import router as lessons_router
from app.api.practice import router as practice_router
from app.api.users import router as users_router
from app.api.drills import router as drills_router
from app.api.content import router as content_router
from app.core.config import CORS_ALLOW_CREDENTIALS, CORS_ALLOW_ORIGINS, METRICS_TOKEN
from app.services.session_store import migrate_legacy_sessions
from app.services.runtime_metrics import snapshot as metrics_snapshot

app = FastAPI(title="Fluentry API", version="0.1.0")
logger = logging.getLogger("fluentry.api")
logging.basicConfig(level=logging.INFO)
migrate_legacy_sessions()

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_credentials=CORS_ALLOW_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(lessons_router, prefix="/lessons", tags=["lessons"])
app.include_router(practice_router, prefix="/practice", tags=["practice"])
app.include_router(users_router, prefix="/users", tags=["users"])
app.include_router(drills_router, prefix="/drills", tags=["drills"])
app.include_router(content_router, prefix="/content", tags=["content"])

MAX_SENSITIVE_BODY_BYTES = 1024 * 1024  # 1 MB


@app.middleware("http")
async def request_logging_middleware(request, call_next):
    started = perf_counter()
    request_id = request.headers.get("X-Request-Id") or f"req-{uuid4()}"
    content_length = request.headers.get("content-length")
    if content_length and request.url.path.startswith(("/auth/", "/practice/")):
        try:
            if int(content_length) > MAX_SENSITIVE_BODY_BYTES:
                response = JSONResponse(status_code=413, content={"detail": "Payload too large"})
                response.headers["X-Request-Id"] = request_id
                response.headers["X-Content-Type-Options"] = "nosniff"
                response.headers["X-Frame-Options"] = "DENY"
                response.headers["Referrer-Policy"] = "no-referrer"
                response.headers["Cache-Control"] = "no-store"
                return response
        except ValueError:
            pass
    response = await call_next(request)
    elapsed_ms = round((perf_counter() - started) * 1000, 2)
    response.headers["X-Request-Id"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store"
    logger.info(
        "request_id=%s method=%s path=%s status=%s latency_ms=%s",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    return response


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready")
def readiness() -> dict[str, str]:
    return {"status": "ready"}


@app.get("/metrics")
def metrics(x_metrics_token: str | None = Header(default=None)) -> dict[str, dict[str, int]]:
    if METRICS_TOKEN and x_metrics_token != METRICS_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return {"counters": metrics_snapshot()}
