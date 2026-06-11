"""Add effective from date to algorithm versions.

Revision ID: 0004_algorithm_version_effective_from
Revises: 0003_algorithm_version_github_metadata
Create Date: 2026-06-11
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0004_algorithm_version_effective_from"
down_revision: Union[str, None] = "0003_algorithm_version_github_metadata"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("algorithm_versions", sa.Column("effective_from", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("algorithm_versions", "effective_from")
