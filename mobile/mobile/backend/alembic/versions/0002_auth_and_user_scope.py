"""auth and user scope

Revision ID: 0002_auth_and_user_scope
Revises: 0001_initial_schema
Create Date: 2026-05-17
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0002_auth_and_user_scope"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=80), primary_key=True),
        sa.Column("email", sa.String(length=255), unique=True, nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
    )

    with op.batch_alter_table("practice_sessions") as batch:
        batch.add_column(sa.Column("user_id", sa.String(length=80), nullable=True))

    op.execute("UPDATE practice_sessions SET user_id = 'user-legacy' WHERE user_id IS NULL")

    with op.batch_alter_table("practice_sessions") as batch:
        batch.alter_column("user_id", existing_type=sa.String(length=80), nullable=False)


def downgrade() -> None:
    with op.batch_alter_table("practice_sessions") as batch:
        batch.drop_column("user_id")
    op.drop_table("users")

