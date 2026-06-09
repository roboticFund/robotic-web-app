from sqlalchemy.orm import Session

from app.db import models
from app.schemas import (
    AlgorithmCreate,
    AlgorithmUpdate,
    AlgorithmVersionCreate,
    TrainingModelCreate,
    TrainingResultCreate,
    TrainingArtifactBase,
)


def get_algorithm(db: Session, algorithm_id: int):
    return db.query(models.Algorithm).filter(models.Algorithm.id == algorithm_id).first()


def get_algorithm_by_code(db: Session, code: str):
    return db.query(models.Algorithm).filter(models.Algorithm.code == code).first()


def list_algorithms(db: Session, skip: int = 0, limit: int = 50):
    return db.query(models.Algorithm).offset(skip).limit(limit).all()


def create_algorithm(db: Session, algorithm: AlgorithmCreate):
    db_obj = models.Algorithm(**algorithm.model_dump())
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def update_algorithm(db: Session, algorithm_id: int, algorithm: AlgorithmUpdate):
    db_obj = get_algorithm(db, algorithm_id)
    if not db_obj:
        return None
    for field, value in algorithm.model_dump(exclude_none=True).items():
        setattr(db_obj, field, value)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def delete_algorithm(db: Session, algorithm_id: int):
    db_obj = get_algorithm(db, algorithm_id)
    if not db_obj:
        return None
    db_obj.is_active = False
    db.commit()
    return db_obj


def list_algorithm_versions(db: Session, algorithm_id: int):
    return (
        db.query(models.AlgorithmVersion)
        .filter(models.AlgorithmVersion.algo_id == algorithm_id)
        .order_by(models.AlgorithmVersion.created_at.desc())
        .all()
    )


def get_algorithm_version(db: Session, version_id: int):
    return db.query(models.AlgorithmVersion).filter(models.AlgorithmVersion.id == version_id).first()


def create_algorithm_version(db: Session, algorithm_id: int, version: AlgorithmVersionCreate):
    db_obj = models.AlgorithmVersion(algo_id=algorithm_id, **version.model_dump())
    if version.is_current:
        db.query(models.AlgorithmVersion).filter(models.AlgorithmVersion.algo_id == algorithm_id).update({"is_current": False})
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def mark_algorithm_version_current(db: Session, version_id: int):
    version = get_algorithm_version(db, version_id)
    if not version:
        return None
    db.query(models.AlgorithmVersion).filter(models.AlgorithmVersion.algo_id == version.algo_id).update({"is_current": False})
    version.is_current = True
    db.commit()
    db.refresh(version)
    return version


def list_training_models(db: Session, skip: int = 0, limit: int = 50):
    return db.query(models.TrainingModel).offset(skip).limit(limit).all()


def get_training_model(db: Session, model_id: int):
    return db.query(models.TrainingModel).filter(models.TrainingModel.id == model_id).first()


def create_training_model(db: Session, model: TrainingModelCreate):
    db_obj = models.TrainingModel(**model.model_dump())
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def create_training_result(db: Session, payload: TrainingResultCreate):
    artifacts_data = payload.artifacts
    payload_data = payload.model_dump(exclude={"artifacts"})
    db_obj = models.TrainingResult(**payload_data)
    db.add(db_obj)
    db.flush()
    for artifact in artifacts_data:
        artifact_obj = models.TrainingArtifact(result_id=db_obj.id, **artifact.model_dump())
        db.add(artifact_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def list_training_results(db: Session, skip: int = 0, limit: int = 50):
    return db.query(models.TrainingResult).offset(skip).limit(limit).all()


def get_training_result(db: Session, result_id: int):
    return db.query(models.TrainingResult).filter(models.TrainingResult.id == result_id).first()
