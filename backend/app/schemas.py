from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class AlgorithmBase(BaseModel):
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

    class Config:
        orm_mode = True


class AlgorithmVersionBase(BaseModel):
    version_label: str
    description: Optional[str] = None
    parameter_set_json: Dict[str, Any] = Field(default_factory=dict)
    git_commit_sha: Optional[str] = None
    is_current: bool = False


class AlgorithmVersionCreate(AlgorithmVersionBase):
    pass


class AlgorithmVersionRead(AlgorithmVersionBase):
    id: int
    algo_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class TrainingModelBase(BaseModel):
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


class TrainingModelRead(TrainingModelBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class TrainingArtifactBase(BaseModel):
    artifact_type: str
    file_name: str
    s3_key: str
    content_type: str
    byte_size: Optional[int] = None
    checksum_sha256: Optional[str] = None


class TrainingArtifactRead(TrainingArtifactBase):
    id: int
    result_id: int
    created_at: datetime

    class Config:
        orm_mode = True


class TrainingResultBase(BaseModel):
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


class TrainingResultCreate(TrainingResultBase):
    artifacts: List[TrainingArtifactBase]


class TrainingResultRead(TrainingResultBase):
    id: int
    created_at: datetime
    updated_at: datetime
    artifacts: List[TrainingArtifactRead] = []

    class Config:
        orm_mode = True


class UploadRequest(BaseModel):
    file_name: str
    artifact_type: str
    content_type: str
    byte_size: Optional[int] = None


class UploadResponse(BaseModel):
    object_key: str
    upload_url: str
    expires_in_seconds: int
    storage_type: str
