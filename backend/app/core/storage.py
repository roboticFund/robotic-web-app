import hashlib
import os
from pathlib import Path
from uuid import uuid4

import boto3

from app.core.config import settings


def build_object_key(file_name: str) -> str:
    prefix = f"training-results/{uuid4()}"
    return f"{prefix}/{file_name}"


def calculate_checksum(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


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

    local_root = Path(settings.local_storage_dir)
    local_target = local_root / object_key
    local_target.parent.mkdir(parents=True, exist_ok=True)
    return {
        "object_key": object_key,
        "upload_url": f"/v1/training-results/uploads/local/{object_key}",
        "expires_in_seconds": 0,
        "storage_type": "local",
    }


def persist_local_upload(object_key: str, data: bytes) -> str:
    local_root = Path(settings.local_storage_dir)
    target_path = local_root / object_key
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_bytes(data)
    return str(target_path)


def preserve_artifact_metadata(file_name: str, content_type: str, data: bytes) -> dict:
    return {
        "checksum_sha256": calculate_checksum(data),
        "byte_size": len(data),
    }
