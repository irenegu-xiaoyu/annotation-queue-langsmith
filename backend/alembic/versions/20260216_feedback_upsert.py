"""Add unique constraint for feedback upsert.

Revision ID: 20260216_feedback_upsert
Revises: 20260216_add_span_fields
Create Date: 2026-02-16 00:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260216_feedback_upsert"
down_revision: str | Sequence[str] | None = "20260216_add_span_fields"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(
        """
        DELETE FROM feedback
        WHERE id IN (
            SELECT id
            FROM (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY trace_id, key
                        ORDER BY modified_at DESC, created_at DESC, id DESC
                    ) AS rn
                FROM feedback
            ) dedupe
            WHERE dedupe.rn > 1
        )
        """
    )
    op.execute(
        """
        ALTER TABLE feedback
        ADD CONSTRAINT uq_feedback_trace_key UNIQUE (trace_id, key)
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute(
        """
        ALTER TABLE feedback
        DROP CONSTRAINT IF EXISTS uq_feedback_trace_key
        """
    )
