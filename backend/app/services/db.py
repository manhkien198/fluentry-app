from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, Index, String, Text, create_engine
from sqlalchemy import LargeBinary
from sqlalchemy import text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from app.core.config import DATABASE_URL


class Base(DeclarativeBase):
    pass


class PracticeSessionRecord(Base):
    __tablename__ = "practice_sessions"

    session_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(80), ForeignKey("users.id"), nullable=False, default="user-legacy")
    lesson_id: Mapped[str] = mapped_column(String(80), nullable=False)
    expected_text: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    audio_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    score_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    score_task_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    score_result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    score_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        Index("ix_practice_sessions_user_id", "user_id"),
        Index("ix_practice_sessions_score_status", "score_status"),
        Index("ix_practice_sessions_updated_at", "updated_at"),
    )


class LessonRecord(Base):
    __tablename__ = "lessons"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    level: Mapped[str] = mapped_column(String(40), nullable=False)
    duration_minutes: Mapped[int]
    xp: Mapped[int]
    prompt: Mapped[str] = mapped_column(Text, nullable=False)


class DrillRecord(Base):
    __tablename__ = "drills"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    sound: Mapped[str] = mapped_column(String(20), nullable=False)
    mode: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    lesson_id: Mapped[str] = mapped_column(String(80), nullable=False)


class AudioAssetRecord(Base):
    __tablename__ = "audio_assets"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    session_id: Mapped[str] = mapped_column(String(80), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(120), nullable=False)
    payload: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)


class UserRecord(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email_verified: Mapped[str] = mapped_column(String(8), nullable=False, default="false")
    email_verify_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email_verify_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class RefreshTokenRecord(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(80), ForeignKey("users.id"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


engine = create_engine(DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _ensure_runtime_schema_compat()


def _ensure_runtime_schema_compat() -> None:
    with engine.begin() as conn:
        try:
            rows = conn.execute(text("PRAGMA table_info(practice_sessions)")).fetchall()
            columns = {row[1] for row in rows}
            if "user_id" not in columns:
                conn.execute(text("ALTER TABLE practice_sessions ADD COLUMN user_id VARCHAR(80) DEFAULT 'user-legacy'"))
        except Exception:
            pass
        try:
            rows = conn.execute(text("PRAGMA table_info(users)")).fetchall()
            columns = {row[1] for row in rows}
            if "email_verified" not in columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN email_verified VARCHAR(8) DEFAULT 'false'"))
            if "email_verify_token" not in columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN email_verify_token VARCHAR(255)"))
            if "email_verify_expires_at" not in columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN email_verify_expires_at DATETIME"))
        except Exception:
            pass


def utc_now() -> datetime:
    return datetime.now(timezone.utc)
