from pydantic import BaseSettings, Field


class Settings(BaseSettings):
    app_name: str = "Robotic Web App API"
    debug: bool = Field(False, env="DEBUG")
    database_url: str = Field("sqlite:///./dev.db", env="DATABASE_URL")
    aws_region: str = Field("ap-southeast-2", env="AWS_REGION")
    s3_bucket: str | None = Field(None, env="S3_BUCKET")
    local_storage_dir: str = Field("storage", env="LOCAL_STORAGE_DIR")
    aws_access_key_id: str | None = Field(None, env="AWS_ACCESS_KEY_ID")
    aws_secret_access_key: str | None = Field(None, env="AWS_SECRET_ACCESS_KEY")
    aws_session_token: str | None = Field(None, env="AWS_SESSION_TOKEN")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
