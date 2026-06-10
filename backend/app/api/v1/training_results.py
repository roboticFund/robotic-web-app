from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app import crud
from app.core.config import settings
from app.core.storage import create_presigned_download, create_presigned_upload, persist_local_upload, resolve_local_storage_path
from app.db.session import SessionLocal
from app.schemas import (
    TrainingArtifactRead,
    TrainingResultCreate,
    TrainingResultRead,
    TrainingResultVisualization,
    UploadRequest,
    UploadResponse,
)

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/", response_model=list[TrainingResultRead])
def list_results(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    return crud.list_training_results(db, skip=skip, limit=limit)


@router.get("/version/{algo_version_id}", response_model=list[TrainingResultRead])
def list_results_for_version(algo_version_id: int, skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    return crud.list_training_results_for_version(db, algo_version_id, skip=skip, limit=limit)


@router.get("/artifacts/{artifact_key:path}")
def get_artifact(artifact_key: str):
    if settings.s3_bucket:
        try:
            return RedirectResponse(create_presigned_download(artifact_key))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid artifact key")

    try:
        target = resolve_local_storage_path(artifact_key)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid artifact key")
    if not target.exists():
        raise HTTPException(status_code=404, detail="Artifact not found")
    return FileResponse(target)


@router.post("/", response_model=TrainingResultRead)
def create_result(payload: TrainingResultCreate, db: Session = Depends(get_db)):
    if not crud.get_algorithm_version(db, payload.algo_version_id):
        raise HTTPException(status_code=404, detail="Algorithm version not found")
    if payload.model_id is not None and not crud.get_training_model(db, payload.model_id):
        raise HTTPException(status_code=404, detail="Training model not found")
    try:
        return crud.create_training_result(db, payload)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/{result_id}", response_model=TrainingResultRead)
def get_result(result_id: int, db: Session = Depends(get_db)):
    result = crud.get_training_result(db, result_id=result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Training result not found")
    return result


@router.get("/{result_id}/artifacts", response_model=list[TrainingArtifactRead])
def list_result_artifacts(result_id: int, db: Session = Depends(get_db)):
    if not crud.get_training_result(db, result_id=result_id):
        raise HTTPException(status_code=404, detail="Training result not found")
    return crud.list_training_artifacts(db, result_id=result_id)


@router.get("/{result_id}/visualization", response_model=TrainingResultVisualization)
def get_result_visualization(result_id: int, db: Session = Depends(get_db)):
    result = crud.get_training_result(db, result_id=result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Training result not found")
    return TrainingResultVisualization(
        result_id=result.id,
        summary_json=result.summary_json or {},
        chart_series_json=result.chart_series_json or {},
    )


@router.post("/uploads", response_model=UploadResponse)
def create_upload_target(payload: UploadRequest):
    if payload.byte_size is not None and payload.byte_size > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="File is larger than the configured upload limit")
    return UploadResponse.model_validate(create_presigned_upload(payload.file_name, payload.content_type))


@router.put("/uploads/local/{object_key:path}")
async def local_upload(object_key: str, request: Request):
    data = await request.body()
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="File is larger than the configured upload limit")
    try:
        persist_local_upload(object_key, data)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid artifact key")
    return {"object_key": object_key, "status": "saved"}
