from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud
from app.db.session import SessionLocal
from app.schemas import AlgorithmCreate, AlgorithmRead, AlgorithmUpdate

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/", response_model=list[AlgorithmRead])
def list_algorithms(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    return crud.list_algorithms(db, skip=skip, limit=limit)


@router.post("/", response_model=AlgorithmRead)
def create_algorithm(payload: AlgorithmCreate, db: Session = Depends(get_db)):
    existing = crud.get_algorithm_by_code(db, payload.code)
    if existing:
        raise HTTPException(status_code=400, detail="Algorithm code already exists")
    return crud.create_algorithm(db, payload)


@router.get("/{algorithm_id}", response_model=AlgorithmRead)
def get_algorithm(algorithm_id: int, db: Session = Depends(get_db)):
    algorithm = crud.get_algorithm(db, algorithm_id)
    if not algorithm:
        raise HTTPException(status_code=404, detail="Algorithm not found")
    return algorithm


@router.patch("/{algorithm_id}", response_model=AlgorithmRead)
def patch_algorithm(algorithm_id: int, payload: AlgorithmUpdate, db: Session = Depends(get_db)):
    algorithm = crud.update_algorithm(db, algorithm_id, payload)
    if not algorithm:
        raise HTTPException(status_code=404, detail="Algorithm not found")
    return algorithm


@router.delete("/{algorithm_id}", response_model=AlgorithmRead)
def delete_algorithm(algorithm_id: int, db: Session = Depends(get_db)):
    algorithm = crud.delete_algorithm(db, algorithm_id)
    if not algorithm:
        raise HTTPException(status_code=404, detail="Algorithm not found")
    return algorithm
