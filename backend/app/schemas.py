from datetime import datetime
from pathlib import PurePosixPath
import re
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator, model_validator


ALLOWED_ARTIFACT_TYPES = {
    "stats_csv",
    "raw_result_csv",
    "best_params_json",
    "analysis_html",
    "analysis_png",
    "other",
}

ALLOWED_RESULT_STATUSES = {"pending", "completed", "failed"}
ALLOWED_ADMIN_OPTION_TYPES = {"instrument", "resolution"}
GITHUB_REPOSITORY_PART_RE = re.compile(r"^[A-Za-z0-9_.-]+$")


def _safe_file_name(value: str) -> str:
    normalized = value.replace("\\", "/").strip()
    file_name = PurePosixPath(normalized).name
    if not file_name or file_name in {".", ".."}:
        raise ValueError("file_name must include a valid file name")
    return file_name


def _validate_object_key(value: str) -> str:
    normalized = value.replace("\\", "/").strip()
    if not normalized or normalized.startswith("/") or ":" in normalized:
        raise ValueError("s3_key must be a relative object key")
    if any(part in {"", ".", ".."} for part in PurePosixPath(normalized).parts):
        raise ValueError("s3_key must not contain empty or traversal segments")
    if not normalized.startswith("training-results/"):
        raise ValueError("s3_key must be under training-results/")
    return normalized


def _normalize_optional_label(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _validate_github_repository_part(value: Optional[str]) -> Optional[str]:
    normalized = _normalize_optional_label(value)
    if normalized is None:
        return None
    if "/" in normalized or "\\" in normalized or ":" in normalized:
        raise ValueError("GitHub repository owner/name must be a single path segment")
    if not GITHUB_REPOSITORY_PART_RE.fullmatch(normalized):
        raise ValueError("GitHub repository owner/name contains unsupported characters")
    return normalized


def _validate_github_parameter_path(value: Optional[str]) -> Optional[str]:
    normalized = _normalize_optional_label(value)
    if normalized is None:
        return None
    normalized = normalized.replace("\\", "/")
    if normalized.startswith("/") or ":" in normalized:
        raise ValueError("GitHub parameter path must be a relative repository path")
    if any(part in {"", ".", ".."} for part in PurePosixPath(normalized).parts):
        raise ValueError("GitHub parameter path must not contain empty or traversal segments")
    return normalized


def _validate_github_ref(value: Optional[str]) -> Optional[str]:
    normalized = _normalize_optional_label(value)
    if normalized is None:
        return None
    if "\\" in normalized or ":" in normalized or normalized.startswith("/") or normalized.endswith("/"):
        raise ValueError("GitHub ref must be a branch, tag, or commit reference")
    if any(part in {"", ".", ".."} for part in PurePosixPath(normalized).parts):
        raise ValueError("GitHub ref must not contain empty or traversal segments")
    return normalized


class OrmBaseModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class AlgorithmBase(OrmBaseModel):
    code: str
    name: str
    instrument: str
    resolution: str
    is_active: bool = True


class AlgorithmCreate(AlgorithmBase):
    pass


class AlgorithmUpdate(BaseModel):
    name: Optional[str] = None
    instrument: Optional[str] = None
    resolution: Optional[str] = None
    is_active: Optional[bool] = None


class AlgorithmRead(AlgorithmBase):
    id: int
    created_at: datetime
    updated_at: datetime


class AlgorithmVersionBase(OrmBaseModel):
    version_label: str
    description: Optional[str] = None
    parameter_set_json: Dict[str, Any] = Field(default_factory=dict)
    git_commit_sha: Optional[str] = None
    github_repo_owner: Optional[str] = None
    github_repo_name: Optional[str] = None
    github_parameter_path: Optional[str] = None
    github_ref: Optional[str] = None
    effective_from: Optional[datetime] = None
    is_current: bool = False
    is_active: bool = True

    @field_validator("github_repo_owner", "github_repo_name")
    @classmethod
    def validate_github_repository_part(cls, value: Optional[str]) -> Optional[str]:
        return _validate_github_repository_part(value)

    @field_validator("github_parameter_path")
    @classmethod
    def validate_github_parameter_path(cls, value: Optional[str]) -> Optional[str]:
        return _validate_github_parameter_path(value)

    @field_validator("github_ref")
    @classmethod
    def validate_github_ref(cls, value: Optional[str]) -> Optional[str]:
        return _validate_github_ref(value)


class AlgorithmVersionCreate(AlgorithmVersionBase):
    pass


class AlgorithmVersionUpdate(BaseModel):
    version_label: Optional[str] = None
    description: Optional[str] = None
    parameter_set_json: Optional[Dict[str, Any]] = None
    git_commit_sha: Optional[str] = None
    github_repo_owner: Optional[str] = None
    github_repo_name: Optional[str] = None
    github_parameter_path: Optional[str] = None
    github_ref: Optional[str] = None
    effective_from: Optional[datetime] = None
    is_current: Optional[bool] = None

    @field_validator("github_repo_owner", "github_repo_name")
    @classmethod
    def validate_update_github_repository_part(cls, value: Optional[str]) -> Optional[str]:
        return _validate_github_repository_part(value)

    @field_validator("github_parameter_path")
    @classmethod
    def validate_update_github_parameter_path(cls, value: Optional[str]) -> Optional[str]:
        return _validate_github_parameter_path(value)

    @field_validator("github_ref")
    @classmethod
    def validate_update_github_ref(cls, value: Optional[str]) -> Optional[str]:
        return _validate_github_ref(value)


class AlgorithmVersionRead(AlgorithmVersionBase):
    id: int
    algo_id: int
    created_at: datetime
    updated_at: datetime


class GitHubParameterFileRead(BaseModel):
    version_id: int
    repository: str
    path: str
    ref: Optional[str] = None
    html_url: Optional[str] = None
    sha: Optional[str] = None
    content_type: str
    parameter_json: Any = None
    parameter_summary: Dict[str, Any] = Field(default_factory=dict)
    commit_date: Optional[datetime] = None
    raw_text: str
    fetched_at: datetime


class TrainingModelBase(OrmBaseModel):
    key: str
    name: str
    description: Optional[str] = None
    optimizer: Optional[str] = None
    trial_count: Optional[int] = None
    parameter_ranges_json: Dict[str, Any] = Field(default_factory=dict)
    config_json: Dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True


class TrainingModelCreate(TrainingModelBase):
    pass


class TrainingModelUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    optimizer: Optional[str] = None
    trial_count: Optional[int] = None
    parameter_ranges_json: Optional[Dict[str, Any]] = None
    config_json: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class TrainingModelRead(TrainingModelBase):
    id: int
    created_at: datetime
    updated_at: datetime


class TrainingArtifactBase(OrmBaseModel):
    artifact_type: str
    file_name: str
    s3_key: str
    content_type: str
    byte_size: Optional[int] = None
    checksum_sha256: Optional[str] = None

    @field_validator("artifact_type")
    @classmethod
    def validate_artifact_type(cls, value: str) -> str:
        if value not in ALLOWED_ARTIFACT_TYPES:
            raise ValueError(f"artifact_type must be one of {sorted(ALLOWED_ARTIFACT_TYPES)}")
        return value

    @field_validator("file_name")
    @classmethod
    def normalize_file_name(cls, value: str) -> str:
        return _safe_file_name(value)

    @field_validator("s3_key")
    @classmethod
    def validate_s3_key(cls, value: str) -> str:
        return _validate_object_key(value)

    @field_validator("byte_size")
    @classmethod
    def validate_byte_size(cls, value: Optional[int]) -> Optional[int]:
        if value is not None and value < 0:
            raise ValueError("byte_size must be zero or greater")
        return value

    @field_validator("checksum_sha256")
    @classmethod
    def validate_checksum(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and (len(value) != 64 or not all(char in "0123456789abcdefABCDEF" for char in value)):
            raise ValueError("checksum_sha256 must be a 64-character SHA-256 hex digest")
        return value.lower() if value else value


class TrainingArtifactRead(TrainingArtifactBase):
    id: int
    result_id: int
    created_at: datetime


class TrainingResultBase(OrmBaseModel):
    algo_version_id: int
    model_id: Optional[int] = None
    run_source: str
    status: str
    run_started_at: Optional[datetime] = None
    run_completed_at: Optional[datetime] = None
    data_from: Optional[datetime] = None
    data_to: Optional[datetime] = None
    summary_json: Dict[str, Any] = Field(default_factory=dict)
    chart_series_json: Dict[str, Any] = Field(default_factory=dict)
    s3_prefix: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        if value not in ALLOWED_RESULT_STATUSES:
            raise ValueError(f"status must be one of {sorted(ALLOWED_RESULT_STATUSES)}")
        return value

    @field_validator("s3_prefix")
    @classmethod
    def validate_s3_prefix(cls, value: Optional[str]) -> Optional[str]:
        return _validate_object_key(value) if value else value


class TrainingResultCreate(TrainingResultBase):
    algo_version_ids: List[int] = Field(default_factory=list)
    artifacts: List[TrainingArtifactBase]


class TrainingResultUpdate(BaseModel):
    model_id: Optional[int] = None
    run_source: Optional[str] = None
    status: Optional[str] = None
    run_started_at: Optional[datetime] = None
    run_completed_at: Optional[datetime] = None
    data_from: Optional[datetime] = None
    data_to: Optional[datetime] = None
    summary_json: Optional[Dict[str, Any]] = None
    chart_series_json: Optional[Dict[str, Any]] = None

    @field_validator("model_id")
    @classmethod
    def validate_model_id(cls, value: Optional[int]) -> Optional[int]:
        if value is not None and value <= 0:
            raise ValueError("model_id must be a positive integer")
        return value

    @field_validator("run_source")
    @classmethod
    def validate_run_source(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            raise ValueError("run_source cannot be null")
        normalized = value.strip()
        if not normalized:
            raise ValueError("run_source must not be empty")
        return normalized

    @field_validator("status")
    @classmethod
    def validate_update_status(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            raise ValueError("status cannot be null")
        if value not in ALLOWED_RESULT_STATUSES:
            raise ValueError(f"status must be one of {sorted(ALLOWED_RESULT_STATUSES)}")
        return value


class TrainingArtifactsAppend(BaseModel):
    artifacts: List[TrainingArtifactBase] = Field(min_length=1)
    summary_json: Optional[Dict[str, Any]] = None
    chart_series_json: Optional[Dict[str, Any]] = None


class AlgorithmVersionLinkRead(OrmBaseModel):
    id: int
    algo_id: int
    version_label: str
    is_current: bool = False
    is_active: bool = True
    algorithm_code: Optional[str] = None
    algorithm_name: Optional[str] = None
    algorithm_is_active: Optional[bool] = None


class TrainingResultRead(TrainingResultBase):
    id: int
    is_dashboard_latest: bool = False
    created_at: datetime
    updated_at: datetime
    artifacts: List[TrainingArtifactRead] = Field(default_factory=list)
    linked_versions: List[AlgorithmVersionLinkRead] = Field(default_factory=list)

    @computed_field
    @property
    def algo_version_ids(self) -> list[int]:
        linked_ids = [version.id for version in self.linked_versions]
        return linked_ids or [self.algo_version_id]


class TrainingResultVisualization(BaseModel):
    result_id: int
    summary_json: Dict[str, Any] = Field(default_factory=dict)
    chart_series_json: Dict[str, Any] = Field(default_factory=dict)


class UploadRequest(BaseModel):
    file_name: str
    artifact_type: str
    content_type: str
    byte_size: Optional[int] = None

    @field_validator("file_name")
    @classmethod
    def normalize_file_name(cls, value: str) -> str:
        return _safe_file_name(value)

    @field_validator("artifact_type")
    @classmethod
    def validate_artifact_type(cls, value: str) -> str:
        if value not in ALLOWED_ARTIFACT_TYPES:
            raise ValueError(f"artifact_type must be one of {sorted(ALLOWED_ARTIFACT_TYPES)}")
        return value

    @field_validator("byte_size")
    @classmethod
    def validate_byte_size(cls, value: Optional[int]) -> Optional[int]:
        if value is not None and value < 0:
            raise ValueError("byte_size must be zero or greater")
        return value


class UploadResponse(BaseModel):
    object_key: str
    upload_url: str
    expires_in_seconds: int
    storage_type: str


class AdminOptionBase(OrmBaseModel):
    option_type: Literal["instrument", "resolution"]
    value: str

    @field_validator("value")
    @classmethod
    def validate_value(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("value must not be empty")
        if any(separator in normalized for separator in ["\\", "/", ":"]):
            raise ValueError("value must be a logical label, not a path")
        return normalized


class AdminOptionCreate(AdminOptionBase):
    pass


class AdminOptionRead(AdminOptionBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class AdminOptionResetResponse(BaseModel):
    instruments: list[str]
    resolutions: list[str]


class AlgorithmMetadataImportItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    code: str
    name: str
    instrument: str
    resolution: str
    version_label: Optional[str] = None
    description: Optional[str] = None
    parameter_set_json: Dict[str, Any] = Field(default_factory=dict)
    git_commit_sha: Optional[str] = None
    is_current: bool = False

    @model_validator(mode="after")
    def strip_machine_and_account_metadata(self):
        # Do not persist workstation paths or broker account settings from trade-engine.
        self.parameter_set_json = {
            key: value
            for key, value in self.parameter_set_json.items()
            if key not in {"accounts_to_run_on", "analysis_outputs"}
        }
        return self


class AlgorithmMetadataImportRequest(BaseModel):
    items: list[AlgorithmMetadataImportItem]


class AlgorithmMetadataImportResponse(BaseModel):
    imported_algorithms: int
    imported_versions: int
