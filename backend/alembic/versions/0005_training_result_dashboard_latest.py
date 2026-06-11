"""Add dashboard latest flag to training results.

Revision ID: 0005_training_result_dashboard_latest
Revises: 0004_algorithm_version_effective_from
Create Date: 2026-06-11
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0005_training_result_dashboard_latest"
down_revision: Union[str, None] = "0004_algorithm_version_effective_from"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "training_results",
        sa.Column("is_dashboard_latest", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index(
        "ix_training_results_is_dashboard_latest",
        "training_results",
        ["is_dashboard_latest"],
    )


def downgrade() -> None:
    op.drop_index("ix_training_results_is_dashboard_latest", table_name="training_results")
    op.drop_column("training_results", "is_dashboard_latest")
