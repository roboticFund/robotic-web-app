from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud
from app.core.config import settings
from app.core.github import GitHubIntegrationError, fetch_github_parameter_file, render_github_parameter_path, validate_github_file_path
from app.db.session import SessionLocal
from app.schemas import AlgorithmVersionCreate, AlgorithmVersionRead, AlgorithmVersionUpdate, GitHubParameterFileRead

router = APIRouter()
version_router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def resolve_github_parameter_path(version) -> str | None:
    if version.github_parameter_path:
        return validate_github_file_path(version.github_parameter_path)
    algorithm = version.algorithm
    if settings.github_parameter_path_template and algorithm:
        return render_github_parameter_path(
            settings.github_parameter_path_template,
            {
                "algorithm_id": algorithm.id,
                "algorithm_code": algorithm.code,
                "algorithm_name": algorithm.name,
                "instrument": algorithm.instrument,
                "resolution": algorithm.resolution,
                "version_id": version.id,
                "version_label": version.version_label,
                "git_commit_sha": version.git_commit_sha,
            },
        )
    if settings.github_parameter_path:
        return validate_github_file_path(settings.github_parameter_path)
    return None


@router.get("/{algo_id}/versions", response_model=list[AlgorithmVersionRead])
def list_versions(algo_id: int, include_inactive: bool = False, db: Session = Depends(get_db)):
    return crud.list_algorithm_versions(db, algorithm_id=algo_id, include_inactive=include_inactive)


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


@version_router.get("/{version_id}/github-parameters", response_model=GitHubParameterFileRead)
def get_version_github_parameters(version_id: int, db: Session = Depends(get_db)):
    version = crud.get_algorithm_version(db, version_id=version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    owner = version.github_repo_owner or settings.github_repo_owner
    repo = version.github_repo_name or settings.github_repo_name
    path = resolve_github_parameter_path(version)
    ref = version.github_ref or version.git_commit_sha
    if not owner or not repo or not path:
        raise HTTPException(
            status_code=400,
            detail="GitHub parameter file is not configured. Set repository owner/name on the version or in backend .env.",
        )

    try:
        return fetch_github_parameter_file(
            version_id=version.id,
            owner=owner,
            repo=repo,
            path=path,
            ref=ref,
        )
    except GitHubIntegrationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


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
