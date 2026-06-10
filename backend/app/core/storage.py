import hashlib
from pathlib import Path, PurePosixPath
from uuid import uuid4

import boto3

from app.core.config import settings


def sanitize_file_name(file_name: str) -> str:
    normalized = file_name.replace("\\", "/").strip()
    safe_name = PurePosixPath(normalized).name
    if not safe_name or safe_name in {".", ".."}:
        raise ValueError("Invalid file name")
    return safe_name


def build_object_key(file_name: str) -> str:
    prefix = f"training-results/{uuid4()}"
    return f"{prefix}/{sanitize_file_name(file_name)}"


def calculate_checksum(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def validate_object_key(object_key: str) -> str:
    normalized_key = object_key.replace("\\", "/").strip()
    if not normalized_key or normalized_key.startswith("/") or ":" in normalized_key:
        raise ValueError("Invalid artifact key")
    if any(part in {"", ".", ".."} for part in PurePosixPath(normalized_key).parts):
        raise ValueError("Invalid artifact key")
    if not normalized_key.startswith("training-results/"):
        raise ValueError("Invalid artifact key")
    return normalized_key


def create_presigned_upload(file_name: str, content_type: str) -> dict:
    object_key = build_object_key(file_name)
    if settings.s3_bucket:
        session = boto3.Session(
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            aws_session_token=settings.aws_session_token,
            region_name=settings.aws_region,
        )
        client = session.client("s3")
        upload_url = client.generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": settings.s3_bucket,
                "Key": object_key,
                "ContentType": content_type,
            },
            ExpiresIn=900,
        )
        return {
            "object_key": object_key,
            "upload_url": upload_url,
            "expires_in_seconds": 900,
            "storage_type": "s3",
        }

    local_target = resolve_local_storage_path(object_key)
    local_target.parent.mkdir(parents=True, exist_ok=True)
    return {
        "object_key": object_key,
        "upload_url": f"/v1/training-results/uploads/local/{object_key}",
        "expires_in_seconds": 0,
        "storage_type": "local",
    }


def create_presigned_download(object_key: str) -> str:
    if not settings.s3_bucket:
        raise ValueError("S3 bucket is not configured")
    validated_key = validate_object_key(object_key)

    session = boto3.Session(
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        aws_session_token=settings.aws_session_token,
        region_name=settings.aws_region,
    )
    client = session.client("s3")
    return client.generate_presigned_url(
        ClientMethod="get_object",
        Params={
            "Bucket": settings.s3_bucket,
            "Key": validated_key,
        },
        ExpiresIn=900,
    )


def resolve_local_storage_path(object_key: str) -> Path:
    normalized_key = validate_object_key(object_key)
    local_root = Path(settings.local_storage_dir).resolve()
    target_path = (local_root / normalized_key).resolve()
    try:
        target_path.relative_to(local_root)
    except ValueError as exc:
        raise ValueError("Invalid artifact key") from exc
    return target_path


def persist_local_upload(object_key: str, data: bytes) -> str:
    target_path = resolve_local_storage_path(object_key)
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_bytes(data)
    return str(target_path)


def preserve_artifact_metadata(file_name: str, content_type: str, data: bytes) -> dict:
    return {
        "checksum_sha256": calculate_checksum(data),
        "byte_size": len(data),
    }
