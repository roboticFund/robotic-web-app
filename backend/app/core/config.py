from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings


ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    app_name: str = "Robotic Web App API"
    debug: bool = Field(False, env="DEBUG")
    database_url: str = Field("sqlite:///./dev.db", env="DATABASE_URL")
    aws_region: str = Field("ap-southeast-2", env="AWS_REGION")

    @field_validator("debug", mode="before")
    def parse_debug(cls, value):
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "on", "debug"}:
                return True
            if normalized in {"0", "false", "no", "off", "release"}:
                return False
        return value
    s3_bucket: str | None = Field(None, env="S3_BUCKET")
    local_storage_dir: str = Field("storage", env="LOCAL_STORAGE_DIR")
    max_upload_bytes: int = Field(250 * 1024 * 1024, env="MAX_UPLOAD_BYTES")
    auto_create_sqlite_tables: bool = Field(True, env="AUTO_CREATE_SQLITE_TABLES")
    aws_access_key_id: str | None = Field(None, env="AWS_ACCESS_KEY_ID")
    aws_secret_access_key: str | None = Field(None, env="AWS_SECRET_ACCESS_KEY")
    aws_session_token: str | None = Field(None, env="AWS_SESSION_TOKEN")
    github_token: str | None = Field(None, env="GITHUB_TOKEN")
    github_api_base_url: str = Field("https://api.github.com", env="GITHUB_API_BASE_URL")
    github_repo_owner: str | None = Field(None, env="GITHUB_REPO_OWNER")
    github_repo_name: str | None = Field(None, env="GITHUB_REPO_NAME")
    github_parameter_path: str | None = Field(None, env="GITHUB_PARAMETER_PATH")
    github_parameter_path_template: str | None = Field(
        "resources/algorithms/{algorithm_code_lower}/algo_params.py",
        env="GITHUB_PARAMETER_PATH_TEMPLATE",
    )

    class Config:
        env_file = ENV_FILE
        env_file_encoding = "utf-8"


settings = Settings()
