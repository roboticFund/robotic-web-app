from datetime import datetime
from pathlib import PurePosixPath
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


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
    is_current: bool = False


class AlgorithmVersionCreate(AlgorithmVersionBase):
    pass


class AlgorithmVersionUpdate(BaseModel):
    version_label: Optional[str] = None
    description: Optional[str] = None
    parameter_set_json: Optional[Dict[str, Any]] = None
    git_commit_sha: Optional[str] = None
    is_current: Optional[bool] = None


class AlgorithmVersionRead(AlgorithmVersionBase):
    id: int
    algo_id: int
    created_at: datetime
    updated_at: datetime


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
    artifacts: List[TrainingArtifactBase]


class TrainingResultRead(TrainingResultBase):
    id: int
    created_at: datetime
    updated_at: datetime
    artifacts: List[TrainingArtifactRead] = Field(default_factory=list)


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
