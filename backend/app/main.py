from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import crud
from app.api.v1.admin import router as admin_router
from app.api.v1.algorithms import router as algorithms_router
from app.api.v1.algorithm_versions import router as algorithm_versions_router, version_router
from app.api.v1.training_models import router as training_models_router
from app.api.v1.training_results import router as training_results_router
from app.core.config import settings
from app.db import Base, SessionLocal, engine  # noqa: F401

app = FastAPI(
    title="Robotic Web App API",
    version="0.1.0",
    description="Backend API for the robotic-web-app control plane.",
)

@app.on_event("startup")
def startup_event():
    if settings.auto_create_sqlite_tables and settings.database_url.startswith("sqlite"):
        # Local development convenience only. Shared databases should use Alembic.
        Base.metadata.create_all(bind=engine)
        with SessionLocal() as db:
            crud.ensure_default_admin_options(db)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4173", "http://127.0.0.1:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(algorithms_router, prefix="/v1/algorithms", tags=["algorithms"])
app.include_router(algorithm_versions_router, prefix="/v1/algorithms", tags=["algorithm_versions"])
app.include_router(version_router, prefix="/v1/algorithm-versions", tags=["algorithm_versions"])
app.include_router(training_models_router, prefix="/v1/training-models", tags=["training_models"])
app.include_router(training_results_router, prefix="/v1/training-results", tags=["training_results"])
app.include_router(admin_router, prefix="/v1/admin", tags=["admin"])


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}
