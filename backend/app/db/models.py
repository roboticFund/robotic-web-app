from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.base import Base


class Algorithm(Base):
    __tablename__ = "algorithms"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(64), unique=True, nullable=False)
    name = Column(String(256), nullable=False)
    instrument = Column(String(64), nullable=False)
    resolution = Column(String(64), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    versions = relationship("AlgorithmVersion", back_populates="algorithm")


class AlgorithmVersion(Base):
    __tablename__ = "algorithm_versions"

    id = Column(Integer, primary_key=True, index=True)
    algo_id = Column(Integer, ForeignKey("algorithms.id"), nullable=False)
    version_label = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)
    parameter_set_json = Column(JSON, nullable=False, default=dict)
    git_commit_sha = Column(String(128), nullable=True)
    is_current = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    algorithm = relationship("Algorithm", back_populates="versions")
    results = relationship("TrainingResult", back_populates="algorithm_version")


class TrainingModel(Base):
    __tablename__ = "training_models"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(128), unique=True, nullable=False)
    name = Column(String(256), nullable=False)
    description = Column(Text, nullable=True)
    optimizer = Column(String(128), nullable=True)
    trial_count = Column(Integer, nullable=True)
    parameter_ranges_json = Column(JSON, nullable=True, default=dict)
    config_json = Column(JSON, nullable=True, default=dict)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    results = relationship("TrainingResult", back_populates="model")


class TrainingResult(Base):
    __tablename__ = "training_results"

    id = Column(Integer, primary_key=True, index=True)
    algo_version_id = Column(Integer, ForeignKey("algorithm_versions.id"), nullable=False)
    model_id = Column(Integer, ForeignKey("training_models.id"), nullable=True)
    run_source = Column(String(64), nullable=False)
    status = Column(String(64), nullable=False, default="pending")
    run_started_at = Column(DateTime, nullable=True)
    run_completed_at = Column(DateTime, nullable=True)
    data_from = Column(DateTime, nullable=True)
    data_to = Column(DateTime, nullable=True)
    summary_json = Column(JSON, nullable=True, default=dict)
    chart_series_json = Column(JSON, nullable=True, default=dict)
    s3_prefix = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    algorithm_version = relationship("AlgorithmVersion", back_populates="results")
    model = relationship("TrainingModel", back_populates="results")
    artifacts = relationship("TrainingArtifact", back_populates="result")


class TrainingArtifact(Base):
    __tablename__ = "training_artifacts"

    id = Column(Integer, primary_key=True, index=True)
    result_id = Column(Integer, ForeignKey("training_results.id"), nullable=False)
    artifact_type = Column(String(64), nullable=False)
    file_name = Column(String(256), nullable=False)
    s3_key = Column(String(1024), nullable=False)
    content_type = Column(String(128), nullable=False)
    byte_size = Column(Integer, nullable=True)
    checksum_sha256 = Column(String(128), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    result = relationship("TrainingResult", back_populates="artifacts")


class AdminOption(Base):
    __tablename__ = "admin_options"
    __table_args__ = (UniqueConstraint("option_type", "value", name="uq_admin_option_type_value"),)

    id = Column(Integer, primary_key=True, index=True)
    option_type = Column(String(64), nullable=False)
    value = Column(String(128), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
