import json
from pathlib import Path
from typing import Annotated
from urllib.parse import quote

import boto3
from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode


ENV_FILE = Path(__file__).resolve().parents[2] / ".env"
LOCAL_CORS_ORIGINS = [
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


def database_url_from_secret_payload(
    secret_payload: object,
    database_name: str | None = None,
) -> str:
    if isinstance(secret_payload, str):
        return secret_payload

    if not isinstance(secret_payload, dict):
        raise ValueError("Database secret must contain a string or JSON object")

    for key in ("DATABASE_URL", "database_url", "url", "connection_string"):
        value = secret_payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    engine = str(secret_payload.get("engine", "")).strip().lower()
    if engine not in {"mysql", "aurora-mysql"}:
        raise ValueError(
            "RDS database secret must use the MySQL engine or contain DATABASE_URL"
        )

    username = str(secret_payload.get("username", "")).strip()
    password = str(secret_payload.get("password", ""))
    host = str(secret_payload.get("host", "")).strip()
    port = str(secret_payload.get("port", "3306")).strip()
    selected_database = (
        database_name
        or str(secret_payload.get("dbname", "")).strip()
        or str(secret_payload.get("database", "")).strip()
    )
    if not username or not password or not host:
        raise ValueError(
            "RDS database secret must contain username, password, and host"
        )

    return (
        f"mysql+pymysql://{quote(username, safe='')}:{quote(password, safe='')}"
        f"@{host}:{port}/{quote(selected_database, safe='')}"
    )


def load_database_url_from_secret(
    secret_id: str,
    region_name: str,
    database_name: str | None = None,
) -> str:
    client = boto3.client("secretsmanager", region_name=region_name)
    response = client.get_secret_value(SecretId=secret_id)
    secret_string = response.get("SecretString")
    if not secret_string:
        raise ValueError("Database secret must contain a SecretString value")

    try:
        secret_payload = json.loads(secret_string)
    except json.JSONDecodeError:
        return secret_string

    return database_url_from_secret_payload(
        secret_payload,
        database_name=database_name,
    )


class Settings(BaseSettings):
    app_name: str = "Robotic Web App API"
    debug: bool = Field(False, env="DEBUG")
    database_url: str = Field("sqlite:///./dev.db", env="DATABASE_URL")
    database_secret_arn: str | None = Field(None, env="DATABASE_SECRET_ARN")
    database_name: str | None = Field(None, env="DATABASE_NAME")
    aws_region: str = Field("ap-southeast-2", env="AWS_REGION")
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: LOCAL_CORS_ORIGINS.copy(),
        env="CORS_ORIGINS",
    )

    @field_validator("debug", mode="before")
    def parse_debug(cls, value):
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "on", "debug"}:
                return True
            if normalized in {"0", "false", "no", "off", "release"}:
                return False
        return value

    @field_validator("cors_origins", mode="before")
    def parse_cors_origins(cls, value):
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @model_validator(mode="after")
    def apply_database_secret(self):
        if self.database_secret_arn:
            self.database_url = load_database_url_from_secret(
                self.database_secret_arn,
                self.aws_region,
                database_name=self.database_name,
            )
        return self

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
