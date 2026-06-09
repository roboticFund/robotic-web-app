from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.algorithms import router as algorithms_router
from app.api.v1.algorithm_versions import router as algorithm_versions_router
from app.api.v1.training_models import router as training_models_router
from app.api.v1.training_results import router as training_results_router

app = FastAPI(
    title="Robotic Web App API",
    version="0.1.0",
    description="Backend API for the robotic-web-app control plane.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(algorithms_router, prefix="/v1/algorithms", tags=["algorithms"])
app.include_router(algorithm_versions_router, prefix="/v1/algorithms", tags=["algorithm_versions"])
app.include_router(training_models_router, prefix="/v1/training-models", tags=["training_models"])
app.include_router(training_results_router, prefix="/v1/training-results", tags=["training_results"])


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}
