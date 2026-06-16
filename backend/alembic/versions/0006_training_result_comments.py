"""Add comments to training results.

Revision ID: 0006_training_result_comments
Revises: 0005_training_result_dashboard_latest
Create Date: 2026-06-16
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0006_training_result_comments"
down_revision: Union[str, None] = "0005_training_result_dashboard_latest"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("training_results", sa.Column("comments", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("training_results", "comments")
