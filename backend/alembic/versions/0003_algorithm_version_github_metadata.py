"""Add GitHub metadata to algorithm versions.

Revision ID: 0003_algorithm_version_github_metadata
Revises: 0002_algorithm_version_soft_delete
Create Date: 2026-06-11
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0003_algorithm_version_github_metadata"
down_revision: Union[str, None] = "0002_algorithm_version_soft_delete"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("algorithm_versions", sa.Column("github_repo_owner", sa.String(length=128), nullable=True))
    op.add_column("algorithm_versions", sa.Column("github_repo_name", sa.String(length=128), nullable=True))
    op.add_column("algorithm_versions", sa.Column("github_parameter_path", sa.String(length=512), nullable=True))
    op.add_column("algorithm_versions", sa.Column("github_ref", sa.String(length=256), nullable=True))


def downgrade() -> None:
    op.drop_column("algorithm_versions", "github_ref")
    op.drop_column("algorithm_versions", "github_parameter_path")
    op.drop_column("algorithm_versions", "github_repo_name")
    op.drop_column("algorithm_versions", "github_repo_owner")
