from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud
from app.db.session import SessionLocal
from app.schemas import AlgorithmVersionCreate, AlgorithmVersionRead, AlgorithmVersionUpdate

router = APIRouter()
version_router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/{algo_id}/versions", response_model=list[AlgorithmVersionRead])
def list_versions(algo_id: int, db: Session = Depends(get_db)):
    return crud.list_algorithm_versions(db, algorithm_id=algo_id)


@router.post("/{algo_id}/versions", response_model=AlgorithmVersionRead)
def create_version(algo_id: int, payload: AlgorithmVersionCreate, db: Session = Depends(get_db)):
    algorithm = crud.get_algorithm(db, algo_id)
    if not algorithm:
        raise HTTPException(status_code=404, detail="Algorithm not found")
    return crud.create_algorithm_version(db, algorithm_id=algo_id, version=payload)


@version_router.get("/{version_id}", response_model=AlgorithmVersionRead)
def get_version(version_id: int, db: Session = Depends(get_db)):
    version = crud.get_algorithm_version(db, version_id=version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    return version


@version_router.patch("/{version_id}", response_model=AlgorithmVersionRead)
def patch_version(version_id: int, payload: AlgorithmVersionUpdate, db: Session = Depends(get_db)):
    version = crud.update_algorithm_version(db, version_id=version_id, version_update=payload)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    return version


@version_router.delete("/{version_id}", response_model=AlgorithmVersionRead)
def delete_version(version_id: int, db: Session = Depends(get_db)):
    version = crud.delete_algorithm_version(db, version_id=version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    return version


@version_router.post("/{version_id}/make-current", response_model=AlgorithmVersionRead)
def make_version_current(version_id: int, db: Session = Depends(get_db)):
    version = crud.mark_algorithm_version_current(db, version_id=version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    return version
