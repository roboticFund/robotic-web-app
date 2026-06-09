from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app import crud
from app.core.storage import create_presigned_upload, persist_local_upload
from app.db.session import SessionLocal
from app.schemas import TrainingResultCreate, TrainingResultRead, UploadRequest, UploadResponse

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


@router.post("/", response_model=TrainingResultRead)
def create_result(payload: TrainingResultCreate, db: Session = Depends(get_db)):
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


@router.post("/uploads", response_model=UploadResponse)
def create_upload_target(payload: UploadRequest):
    return UploadResponse.model_validate(create_presigned_upload(payload.file_name, payload.content_type))


@router.put("/uploads/local/{object_key:path}")
async def local_upload(object_key: str, request: Request):
    data = await request.body()
    persist_local_upload(object_key, data)
    return {"object_key": object_key, "status": "saved"}
