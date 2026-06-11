import re

from sqlalchemy import case, func, or_
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
    TrainingArtifactsAppend,
    TrainingResultCreate,
    TrainingResultUpdate,
)


DEFAULT_ADMIN_OPTIONS = {
    "instrument": ["EURUSD", "BTCUSD", "AAPL", "ETHUSD", "GOLD"],
    "resolution": ["1m", "5m", "15m", "1h", "1d", "MINUTE_15"],
}


def _version_number_parts(version_label: str | None) -> tuple[int, ...]:
    return tuple(int(part) for part in re.findall(r"\d+", version_label or ""))


def _order_algorithm_versions(versions: list[models.AlgorithmVersion]) -> list[models.AlgorithmVersion]:
    version_parts = {
        version.id: _version_number_parts(version.version_label)
        for version in versions
    }
    max_part_count = max((len(parts) for parts in version_parts.values()), default=0)

    def sort_key(version: models.AlgorithmVersion):
        parts = version_parts.get(version.id, ())
        padded_parts = parts + (0,) * (max_part_count - len(parts))
        return (
            0 if version.is_current else 1,
            0 if parts else 1,
            tuple(-part for part in padded_parts),
            (version.version_label or "").lower(),
            -(version.id or 0),
        )

    return sorted(versions, key=sort_key)


def _list_training_results_by_ordered_ids(db: Session, result_ids: list[int]):
    if not result_ids:
        return []
    ordering = case({result_id: index for index, result_id in enumerate(result_ids)}, value=models.TrainingResult.id)
    return (
        db.query(models.TrainingResult)
        .filter(models.TrainingResult.id.in_(result_ids))
        .order_by(ordering)
        .all()
    )


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
    (
        db.query(models.AlgorithmVersion)
        .filter(models.AlgorithmVersion.algo_id == algorithm_id)
        .update({"is_active": False, "is_current": False})
    )
    db.commit()
    db.refresh(db_obj)
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


def list_algorithm_versions(db: Session, algorithm_id: int, include_inactive: bool = False):
    query = db.query(models.AlgorithmVersion).filter(models.AlgorithmVersion.algo_id == algorithm_id)
    if not include_inactive:
        query = query.filter(models.AlgorithmVersion.is_active == True)
    return _order_algorithm_versions(query.all())


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
    update_data = version_update.model_dump(exclude_unset=True)
    if update_data.get("is_current"):
        db.query(models.AlgorithmVersion).filter(models.AlgorithmVersion.algo_id == version.algo_id).update({"is_current": False})
    for field, value in update_data.items():
        setattr(version, field, value)
    db.commit()
    db.refresh(version)
    return version


def mark_algorithm_version_current(db: Session, version_id: int):
    version = get_algorithm_version(db, version_id)
    if not version or not version.is_active:
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
    db_obj.is_active = False
    db_obj.is_current = False
    db.commit()
    db.refresh(db_obj)
    return db_obj


def create_training_result(db: Session, payload: TrainingResultCreate):
    artifacts_data = payload.artifacts
    linked_version_ids = list(dict.fromkeys([payload.algo_version_id, *payload.algo_version_ids]))
    payload_data = payload.model_dump(exclude={"artifacts", "algo_version_ids"})
    db_obj = models.TrainingResult(**payload_data)
    db.add(db_obj)
    db.flush()

    for version_id in linked_version_ids:
        db.add(models.TrainingResultVersion(result_id=db_obj.id, algo_version_id=version_id))

    for artifact in artifacts_data:
        artifact_obj = models.TrainingArtifact(result_id=db_obj.id, **artifact.model_dump())
        db.add(artifact_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def list_training_results(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    algo_id: int | None = None,
    algo_version_id: int | None = None,
    current_only: bool = False,
    status: str | None = None,
    run_source: str | None = None,
    combined_only: bool = False,
    dashboard_latest: bool | None = None,
):
    query = db.query(models.TrainingResult)

    if combined_only:
        combined_result_ids = (
            db.query(models.TrainingResultVersion.result_id.label("result_id"))
            .group_by(models.TrainingResultVersion.result_id)
            .having(func.count(models.TrainingResultVersion.algo_version_id) > 1)
            .subquery()
        )
        query = query.join(combined_result_ids, combined_result_ids.c.result_id == models.TrainingResult.id)

    needs_version_context = algo_id is not None or algo_version_id is not None or current_only
    if needs_version_context:
        query = (
            query.outerjoin(models.TrainingResultVersion)
            .outerjoin(
                models.AlgorithmVersion,
                or_(
                    models.AlgorithmVersion.id == models.TrainingResultVersion.algo_version_id,
                    models.AlgorithmVersion.id == models.TrainingResult.algo_version_id,
                ),
            )
        )
        if current_only:
            query = query.outerjoin(models.Algorithm, models.Algorithm.id == models.AlgorithmVersion.algo_id)

    if algo_id is not None:
        query = query.filter(models.AlgorithmVersion.algo_id == algo_id)
    if algo_version_id is not None:
        query = query.filter(or_(
            models.TrainingResult.algo_version_id == algo_version_id,
            models.TrainingResultVersion.algo_version_id == algo_version_id,
        ))
    if current_only:
        query = query.filter(
            models.AlgorithmVersion.is_current == True,
            models.AlgorithmVersion.is_active == True,
            models.Algorithm.is_active == True,
        )
    if status:
        query = query.filter(models.TrainingResult.status == status)
    if run_source:
        query = query.filter(models.TrainingResult.run_source == run_source)
    if dashboard_latest is not None:
        query = query.filter(models.TrainingResult.is_dashboard_latest == dashboard_latest)

    result_ids = [
        row.id
        for row in (
            query.with_entities(models.TrainingResult.id)
            .group_by(models.TrainingResult.id, models.TrainingResult.created_at)
            .order_by(models.TrainingResult.created_at.desc(), models.TrainingResult.id.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
    ]
    return _list_training_results_by_ordered_ids(db, result_ids)


def get_dashboard_training_result(db: Session):
    return (
        db.query(models.TrainingResult)
        .filter(models.TrainingResult.is_dashboard_latest == True)
        .order_by(models.TrainingResult.updated_at.desc(), models.TrainingResult.id.desc())
        .first()
    )


def list_training_results_for_version(db: Session, algo_version_id: int, skip: int = 0, limit: int = 50):
    result_ids = [
        row.id
        for row in (
            db.query(models.TrainingResult.id)
            .outerjoin(models.TrainingResultVersion)
            .filter(or_(
                models.TrainingResult.algo_version_id == algo_version_id,
                models.TrainingResultVersion.algo_version_id == algo_version_id,
            ))
            .group_by(models.TrainingResult.id, models.TrainingResult.created_at)
            .order_by(models.TrainingResult.created_at.desc(), models.TrainingResult.id.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
    ]
    return _list_training_results_by_ordered_ids(db, result_ids)


def get_training_result(db: Session, result_id: int):
    return db.query(models.TrainingResult).filter(models.TrainingResult.id == result_id).first()


def mark_training_result_dashboard_latest(db: Session, result_id: int):
    result = get_training_result(db, result_id)
    if not result:
        return None
    (
        db.query(models.TrainingResult)
        .filter(models.TrainingResult.id != result_id, models.TrainingResult.is_dashboard_latest == True)
        .update({"is_dashboard_latest": False}, synchronize_session=False)
    )
    result.is_dashboard_latest = True
    db.commit()
    db.refresh(result)
    return result


def clear_training_result_dashboard_latest(db: Session, result_id: int):
    result = get_training_result(db, result_id)
    if not result:
        return None
    result.is_dashboard_latest = False
    db.commit()
    db.refresh(result)
    return result


def update_training_result(db: Session, result_id: int, payload: TrainingResultUpdate):
    result = get_training_result(db, result_id)
    if not result:
        return None
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field in {"summary_json", "chart_series_json"} and value is None:
            value = {}
        setattr(result, field, value)
    db.commit()
    db.refresh(result)
    return result


def list_training_artifacts(db: Session, result_id: int):
    return (
        db.query(models.TrainingArtifact)
        .filter(models.TrainingArtifact.result_id == result_id)
        .order_by(models.TrainingArtifact.created_at.asc())
        .all()
    )


def get_training_artifact(db: Session, artifact_id: int):
    return db.query(models.TrainingArtifact).filter(models.TrainingArtifact.id == artifact_id).first()


def delete_training_artifact(db: Session, result_id: int, artifact_id: int):
    artifact = (
        db.query(models.TrainingArtifact)
        .filter(
            models.TrainingArtifact.id == artifact_id,
            models.TrainingArtifact.result_id == result_id,
        )
        .first()
    )
    if not artifact:
        return None
    db.delete(artifact)
    db.commit()
    return get_training_result(db, result_id)


def delete_training_result(db: Session, result_id: int):
    result = get_training_result(db, result_id)
    if not result:
        return None
    db.query(models.TrainingArtifact).filter(models.TrainingArtifact.result_id == result_id).delete()
    db.query(models.TrainingResultVersion).filter(models.TrainingResultVersion.result_id == result_id).delete()
    db.delete(result)
    db.commit()
    return result_id


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


def append_training_result_artifacts(db: Session, result_id: int, payload: TrainingArtifactsAppend):
    result = get_training_result(db, result_id)
    if not result:
        return None

    if payload.summary_json:
        result.summary_json = {
            **(result.summary_json or {}),
            **payload.summary_json,
        }
    if payload.chart_series_json:
        result.chart_series_json = {
            **(result.chart_series_json or {}),
            **payload.chart_series_json,
        }

    for artifact in payload.artifacts:
        db.add(models.TrainingArtifact(result_id=result.id, **artifact.model_dump()))

    db.commit()
    db.refresh(result)
    return result


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
