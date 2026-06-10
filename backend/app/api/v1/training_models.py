from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud
from app.db import models
from app.db.session import SessionLocal
from app.schemas import TrainingModelCreate, TrainingModelRead, TrainingModelUpdate

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/", response_model=list[TrainingModelRead])
def list_models(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    return crud.list_training_models(db, skip=skip, limit=limit)


@router.post("/", response_model=TrainingModelRead)
def create_model(payload: TrainingModelCreate, db: Session = Depends(get_db)):
    existing = db.query(models.TrainingModel).filter(models.TrainingModel.key == payload.key).first()
    if existing:
        raise HTTPException(status_code=400, detail="Training model key already exists")
    return crud.create_training_model(db, payload)


@router.get("/{model_id}", response_model=TrainingModelRead)
def get_model(model_id: int, db: Session = Depends(get_db)):
    model = crud.get_training_model(db, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Training model not found")
    return model


@router.delete("/{model_id}", response_model=TrainingModelRead)
def delete_model(model_id: int, db: Session = Depends(get_db)):
    model = crud.delete_training_model(db, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Training model not found")
    return model


@router.patch("/{model_id}", response_model=TrainingModelRead)
def patch_model(model_id: int, payload: TrainingModelUpdate, db: Session = Depends(get_db)):
    model = crud.update_training_model(db, model_id, payload)
    if not model:
        raise HTTPException(status_code=404, detail="Training model not found")
    return model
