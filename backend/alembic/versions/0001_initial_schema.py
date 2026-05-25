"""initial schema

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-05-17
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "practice_sessions",
        sa.Column("session_id", sa.String(length=80), primary_key=True),
        sa.Column("lesson_id", sa.String(length=80), nullable=False),
        sa.Column("expected_text", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("audio_path", sa.Text(), nullable=True),
        sa.Column("score_status", sa.String(length=32), nullable=True),
        sa.Column("score_task_id", sa.String(length=120), nullable=True),
        sa.Column("score_result", sa.JSON(), nullable=True),
        sa.Column("score_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "lessons",
        sa.Column("id", sa.String(length=80), primary_key=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("level", sa.String(length=40), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("xp", sa.Integer(), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
    )

    op.create_table(
        "drills",
        sa.Column("id", sa.String(length=80), primary_key=True),
        sa.Column("sound", sa.String(length=20), nullable=False),
        sa.Column("mode", sa.String(length=40), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("lesson_id", sa.String(length=80), nullable=False),
    )

    op.create_table(
        "audio_assets",
        sa.Column("id", sa.String(length=80), primary_key=True),
        sa.Column("session_id", sa.String(length=80), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=120), nullable=False),
        sa.Column("payload", sa.LargeBinary(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("audio_assets")
    op.drop_table("drills")
    op.drop_table("lessons")
    op.drop_table("practice_sessions")
