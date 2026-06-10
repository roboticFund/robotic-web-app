from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud
from app.db.session import SessionLocal
from app.schemas import (
    ALLOWED_ADMIN_OPTION_TYPES,
    AdminOptionCreate,
    AdminOptionRead,
    AdminOptionResetResponse,
    AlgorithmMetadataImportRequest,
    AlgorithmMetadataImportResponse,
)

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/options/{option_type}", response_model=list[AdminOptionRead])
def list_options(option_type: str, db: Session = Depends(get_db)):
    if option_type not in ALLOWED_ADMIN_OPTION_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported option type")
    return crud.list_admin_options(db, option_type=option_type)


@router.post("/options", response_model=AdminOptionRead)
def create_option(payload: AdminOptionCreate, db: Session = Depends(get_db)):
    return crud.create_admin_option(db, payload)


@router.delete("/options/{option_type}/{value}", response_model=AdminOptionRead)
def delete_option(option_type: str, value: str, db: Session = Depends(get_db)):
    if option_type not in ALLOWED_ADMIN_OPTION_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported option type")
    option = crud.delete_admin_option(db, option_type=option_type, value=value)
    if not option:
        raise HTTPException(status_code=404, detail="Option not found")
    return option


@router.post("/options/reset", response_model=AdminOptionResetResponse)
def reset_options(db: Session = Depends(get_db)):
    return crud.reset_admin_options(db)


@router.post("/import-algorithm-metadata", response_model=AlgorithmMetadataImportResponse)
def import_algorithm_metadata(payload: AlgorithmMetadataImportRequest, db: Session = Depends(get_db)):
    return crud.import_algorithm_metadata(db, payload.items)
