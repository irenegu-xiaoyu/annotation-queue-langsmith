"""Add feedback span fields.

Revision ID: 20260216_add_span_fields
Revises: 0a3a5ead7ef5
Create Date: 2026-02-16 00:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260216_add_span_fields"
down_revision: str | Sequence[str] | None = "0a3a5ead7ef5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(
        """
        ALTER TABLE feedback
            ADD COLUMN span_path JSONB,
            ADD COLUMN span_start_index INTEGER,
            ADD COLUMN span_end_index INTEGER
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute(
        """
        ALTER TABLE feedback
            DROP COLUMN IF EXISTS span_end_index,
            DROP COLUMN IF EXISTS span_start_index,
            DROP COLUMN IF EXISTS span_path
        """
    )