from pydantic import Field, field_validator
from pydantic_settings import BaseSettings


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

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
