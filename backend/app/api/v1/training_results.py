from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app import crud
from app.core.config import settings
from app.core.storage import create_presigned_download, create_presigned_upload, persist_local_upload, resolve_local_storage_path
from app.db.session import SessionLocal
from app.schemas import (
    ALLOWED_RESULT_STATUSES,
    TrainingArtifactsAppend,
    TrainingArtifactRead,
    TrainingResultCreate,
    TrainingResultRead,
    TrainingResultUpdate,
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
def list_results(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    algo_id: int | None = None,
    algo_version_id: int | None = None,
    current_only: bool = False,
    status: str | None = None,
    run_source: str | None = None,
    combined_only: bool = False,
    dashboard_latest: bool | None = None,
    db: Session = Depends(get_db),
):
    if status and status not in ALLOWED_RESULT_STATUSES:
        raise HTTPException(status_code=400, detail=f"status must be one of {sorted(ALLOWED_RESULT_STATUSES)}")
    return crud.list_training_results(
        db,
        skip=skip,
        limit=limit,
        algo_id=algo_id,
        algo_version_id=algo_version_id,
        current_only=current_only,
        status=status,
        run_source=run_source,
        combined_only=combined_only,
        dashboard_latest=dashboard_latest,
    )


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


@router.get("/dashboard/latest", response_model=TrainingResultRead | None)
def get_dashboard_result(db: Session = Depends(get_db)):
    return crud.get_dashboard_training_result(db)


@router.post("/", response_model=TrainingResultRead)
def create_result(payload: TrainingResultCreate, db: Session = Depends(get_db)):
    if not crud.get_algorithm_version(db, payload.algo_version_id):
        raise HTTPException(status_code=404, detail="Algorithm version not found")
    missing_version_ids = [
        version_id
        for version_id in payload.algo_version_ids
        if not crud.get_algorithm_version(db, version_id)
    ]
    if missing_version_ids:
        raise HTTPException(status_code=404, detail=f"Algorithm versions not found: {missing_version_ids}")
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


@router.post("/{result_id}/dashboard-latest", response_model=TrainingResultRead)
def mark_result_dashboard_latest(result_id: int, db: Session = Depends(get_db)):
    result = crud.mark_training_result_dashboard_latest(db, result_id=result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Training result not found")
    return result


@router.delete("/{result_id}/dashboard-latest", response_model=TrainingResultRead)
def clear_result_dashboard_latest(result_id: int, db: Session = Depends(get_db)):
    result = crud.clear_training_result_dashboard_latest(db, result_id=result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Training result not found")
    return result


@router.patch("/{result_id}", response_model=TrainingResultRead)
def update_result(result_id: int, payload: TrainingResultUpdate, db: Session = Depends(get_db)):
    if payload.model_id is not None and not crud.get_training_model(db, payload.model_id):
        raise HTTPException(status_code=404, detail="Training model not found")
    try:
        result = crud.update_training_result(db, result_id=result_id, payload=payload)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not result:
        raise HTTPException(status_code=404, detail="Training result not found")
    return result


@router.delete("/{result_id}")
def delete_result(result_id: int, db: Session = Depends(get_db)):
    deleted_result_id = crud.delete_training_result(db, result_id=result_id)
    if deleted_result_id is None:
        raise HTTPException(status_code=404, detail="Training result not found")
    return {"id": deleted_result_id, "status": "deleted"}


@router.get("/{result_id}/artifacts", response_model=list[TrainingArtifactRead])
def list_result_artifacts(result_id: int, db: Session = Depends(get_db)):
    if not crud.get_training_result(db, result_id=result_id):
        raise HTTPException(status_code=404, detail="Training result not found")
    return crud.list_training_artifacts(db, result_id=result_id)


@router.post("/{result_id}/artifacts", response_model=TrainingResultRead)
def append_result_artifacts(result_id: int, payload: TrainingArtifactsAppend, db: Session = Depends(get_db)):
    try:
        result = crud.append_training_result_artifacts(db, result_id=result_id, payload=payload)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not result:
        raise HTTPException(status_code=404, detail="Training result not found")
    return result


@router.delete("/{result_id}/artifacts/{artifact_id}", response_model=TrainingResultRead)
def delete_result_artifact(result_id: int, artifact_id: int, db: Session = Depends(get_db)):
    result = crud.delete_training_artifact(db, result_id=result_id, artifact_id=artifact_id)
    if not result:
        raise HTTPException(status_code=404, detail="Training artifact not found")
    return result


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
