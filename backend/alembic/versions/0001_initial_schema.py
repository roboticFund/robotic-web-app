"""Initial application schema.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-06-10
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "algorithms",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(length=64), nullable=False, unique=True),
        sa.Column("name", sa.String(length=256), nullable=False),
        sa.Column("instrument", sa.String(length=64), nullable=False),
        sa.Column("resolution", sa.String(length=64), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_algorithms_id", "algorithms", ["id"])

    op.create_table(
        "training_models",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("key", sa.String(length=128), nullable=False, unique=True),
        sa.Column("name", sa.String(length=256), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("optimizer", sa.String(length=128), nullable=True),
        sa.Column("trial_count", sa.Integer(), nullable=True),
        sa.Column("parameter_ranges_json", sa.JSON(), nullable=True),
        sa.Column("config_json", sa.JSON(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_training_models_id", "training_models", ["id"])

    op.create_table(
        "admin_options",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("option_type", sa.String(length=64), nullable=False),
        sa.Column("value", sa.String(length=128), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("option_type", "value", name="uq_admin_option_type_value"),
    )
    op.create_index("ix_admin_options_id", "admin_options", ["id"])

    op.create_table(
        "algorithm_versions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("algo_id", sa.Integer(), nullable=False),
        sa.Column("version_label", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("parameter_set_json", sa.JSON(), nullable=False),
        sa.Column("git_commit_sha", sa.String(length=128), nullable=True),
        sa.Column("is_current", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["algo_id"], ["algorithms.id"]),
    )
    op.create_index("ix_algorithm_versions_id", "algorithm_versions", ["id"])

    op.create_table(
        "training_results",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("algo_version_id", sa.Integer(), nullable=False),
        sa.Column("model_id", sa.Integer(), nullable=True),
        sa.Column("run_source", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=64), nullable=False),
        sa.Column("run_started_at", sa.DateTime(), nullable=True),
        sa.Column("run_completed_at", sa.DateTime(), nullable=True),
        sa.Column("data_from", sa.DateTime(), nullable=True),
        sa.Column("data_to", sa.DateTime(), nullable=True),
        sa.Column("summary_json", sa.JSON(), nullable=True),
        sa.Column("chart_series_json", sa.JSON(), nullable=True),
        sa.Column("s3_prefix", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["algo_version_id"], ["algorithm_versions.id"]),
        sa.ForeignKeyConstraint(["model_id"], ["training_models.id"]),
    )
    op.create_index("ix_training_results_id", "training_results", ["id"])

    op.create_table(
        "training_artifacts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("result_id", sa.Integer(), nullable=False),
        sa.Column("artifact_type", sa.String(length=64), nullable=False),
        sa.Column("file_name", sa.String(length=256), nullable=False),
        sa.Column("s3_key", sa.String(length=1024), nullable=False),
        sa.Column("content_type", sa.String(length=128), nullable=False),
        sa.Column("byte_size", sa.Integer(), nullable=True),
        sa.Column("checksum_sha256", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["result_id"], ["training_results.id"]),
    )
    op.create_index("ix_training_artifacts_id", "training_artifacts", ["id"])


def downgrade() -> None:
    op.drop_index("ix_training_artifacts_id", table_name="training_artifacts")
    op.drop_table("training_artifacts")
    op.drop_index("ix_training_results_id", table_name="training_results")
    op.drop_table("training_results")
    op.drop_index("ix_algorithm_versions_id", table_name="algorithm_versions")
    op.drop_table("algorithm_versions")
    op.drop_index("ix_admin_options_id", table_name="admin_options")
    op.drop_table("admin_options")
    op.drop_index("ix_training_models_id", table_name="training_models")
    op.drop_table("training_models")
    op.drop_index("ix_algorithms_id", table_name="algorithms")
    op.drop_table("algorithms")
