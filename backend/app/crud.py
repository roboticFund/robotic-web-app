from sqlalchemy.orm import Session

from app.db import models
from app.schemas import (
    AdminOptionCreate,
    AlgorithmCreate,
    AlgorithmUpdate,
    AlgorithmVersionCreate,
    AlgorithmVersionUpdate,
    AlgorithmMetadataImportItem,
    TrainingModelCreate,
    TrainingModelUpdate,
    TrainingResultCreate,
)


DEFAULT_ADMIN_OPTIONS = {
    "instrument": ["EURUSD", "BTCUSD", "AAPL", "ETHUSD", "GOLD"],
    "resolution": ["1m", "5m", "15m", "1h", "1d", "MINUTE_15"],
}


def get_algorithm(db: Session, algorithm_id: int):
    return db.query(models.Algorithm).filter(models.Algorithm.id == algorithm_id).first()


def get_algorithm_by_code(db: Session, code: str):
    return db.query(models.Algorithm).filter(models.Algorithm.code == code).first()


def list_algorithms(db: Session, skip: int = 0, limit: int = 50):
    return (
        db.query(models.Algorithm)
        .filter(models.Algorithm.is_active == True)
        .offset(skip)
        .limit(limit)
        .all()
    )


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


def list_retired_algorithms(db: Session, skip: int = 0, limit: int = 50):
    return (
        db.query(models.Algorithm)
        .filter(models.Algorithm.is_active == False)
        .offset(skip)
        .limit(limit)
        .all()
    )


def reactivate_algorithm(db: Session, algorithm_id: int):
    db_obj = get_algorithm(db, algorithm_id)
    if not db_obj:
        return None
    db_obj.is_active = True
    db.commit()
    db.refresh(db_obj)
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


def update_algorithm_version(db: Session, version_id: int, version_update: AlgorithmVersionUpdate):
    version = get_algorithm_version(db, version_id)
    if not version:
        return None
    update_data = version_update.model_dump(exclude_none=True)
    if update_data.get("is_current"):
        db.query(models.AlgorithmVersion).filter(models.AlgorithmVersion.algo_id == version.algo_id).update({"is_current": False})
    for field, value in update_data.items():
        setattr(version, field, value)
    db.commit()
    db.refresh(version)
    return version


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


def update_training_model(db: Session, model_id: int, model: TrainingModelUpdate):
    db_obj = get_training_model(db, model_id)
    if not db_obj:
        return None
    for field, value in model.model_dump(exclude_none=True).items():
        setattr(db_obj, field, value)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def delete_training_model(db: Session, model_id: int):
    db_obj = get_training_model(db, model_id)
    if not db_obj:
        return None
    db.delete(db_obj)
    db.commit()
    return db_obj


def delete_algorithm_version(db: Session, version_id: int):
    db_obj = get_algorithm_version(db, version_id)
    if not db_obj:
        return None
    db.delete(db_obj)
    db.commit()
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


def list_training_results_for_version(db: Session, algo_version_id: int, skip: int = 0, limit: int = 50):
    return (
        db.query(models.TrainingResult)
        .filter(models.TrainingResult.algo_version_id == algo_version_id)
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_training_result(db: Session, result_id: int):
    return db.query(models.TrainingResult).filter(models.TrainingResult.id == result_id).first()


def list_training_artifacts(db: Session, result_id: int):
    return (
        db.query(models.TrainingArtifact)
        .filter(models.TrainingArtifact.result_id == result_id)
        .order_by(models.TrainingArtifact.created_at.asc())
        .all()
    )


def list_admin_options(db: Session, option_type: str):
    return (
        db.query(models.AdminOption)
        .filter(models.AdminOption.option_type == option_type, models.AdminOption.is_active == True)
        .order_by(models.AdminOption.value.asc())
        .all()
    )


def get_admin_option(db: Session, option_type: str, value: str):
    return (
        db.query(models.AdminOption)
        .filter(models.AdminOption.option_type == option_type, models.AdminOption.value == value)
        .first()
    )


def create_admin_option(db: Session, option: AdminOptionCreate):
    existing = get_admin_option(db, option.option_type, option.value)
    if existing:
        existing.is_active = True
        db.commit()
        db.refresh(existing)
        return existing

    db_obj = models.AdminOption(**option.model_dump())
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def delete_admin_option(db: Session, option_type: str, value: str):
    db_obj = get_admin_option(db, option_type, value)
    if not db_obj:
        return None
    db_obj.is_active = False
    db.commit()
    db.refresh(db_obj)
    return db_obj


def reset_admin_options(db: Session):
    db.query(models.AdminOption).update({"is_active": False})
    for option_type, values in DEFAULT_ADMIN_OPTIONS.items():
        for value in values:
            create_admin_option(db, AdminOptionCreate(option_type=option_type, value=value))
    return {
        "instruments": [option.value for option in list_admin_options(db, "instrument")],
        "resolutions": [option.value for option in list_admin_options(db, "resolution")],
    }


def ensure_default_admin_options(db: Session):
    has_options = db.query(models.AdminOption).first()
    if has_options:
        return
    reset_admin_options(db)


def import_algorithm_metadata(db: Session, items: list[AlgorithmMetadataImportItem]):
    imported_algorithms = 0
    imported_versions = 0

    for item in items:
        algorithm = get_algorithm_by_code(db, item.code)
        if not algorithm:
            algorithm = create_algorithm(
                db,
                AlgorithmCreate(
                    code=item.code,
                    name=item.name,
                    instrument=item.instrument,
                    resolution=item.resolution,
                ),
            )
            imported_algorithms += 1
        else:
            algorithm.name = item.name
            algorithm.instrument = item.instrument
            algorithm.resolution = item.resolution
            algorithm.is_active = True
            db.commit()
            db.refresh(algorithm)

        if item.version_label:
            existing_version = (
                db.query(models.AlgorithmVersion)
                .filter(
                    models.AlgorithmVersion.algo_id == algorithm.id,
                    models.AlgorithmVersion.version_label == item.version_label,
                )
                .first()
            )
            if not existing_version:
                parameter_set = item.parameter_set_json or {
                    "algo_name": item.name,
                    "algo_number": item.code,
                    "instrument": item.instrument,
                    "resolution": item.resolution,
                }
                create_algorithm_version(
                    db,
                    algorithm_id=algorithm.id,
                    version=AlgorithmVersionCreate(
                        version_label=item.version_label,
                        description=item.description,
                        parameter_set_json=parameter_set,
                        git_commit_sha=item.git_commit_sha,
                        is_current=item.is_current,
                    ),
                )
                imported_versions += 1

    return {
        "imported_algorithms": imported_algorithms,
        "imported_versions": imported_versions,
    }
