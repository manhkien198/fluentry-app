from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.lessons import router as lessons_router
from app.api.practice import router as practice_router
from app.api.users import router as users_router
from app.api.drills import router as drills_router
from app.core.config import CORS_ALLOW_CREDENTIALS, CORS_ALLOW_ORIGINS

app = FastAPI(title="Fluentry API", version="0.1.0")

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


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
