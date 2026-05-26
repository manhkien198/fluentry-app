"""indexes and foreign keys

Revision ID: 0003_indexes_and_fk
Revises: 0002_auth_and_user_scope
Create Date: 2026-05-18
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0003_indexes_and_fk"
down_revision = "0002_auth_and_user_scope"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_practice_sessions_user_id", "practice_sessions", ["user_id"])
    op.create_index("ix_practice_sessions_score_status", "practice_sessions", ["score_status"])
    op.create_index("ix_practice_sessions_updated_at", "practice_sessions", ["updated_at"])


def downgrade() -> None:
    op.drop_index("ix_practice_sessions_updated_at", table_name="practice_sessions")
    op.drop_index("ix_practice_sessions_score_status", table_name="practice_sessions")
    op.drop_index("ix_practice_sessions_user_id", table_name="practice_sessions")

