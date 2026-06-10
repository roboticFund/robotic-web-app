from datetime import UTC, datetime
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import crud
from app.core.config import settings
from app.core.storage import create_presigned_upload, persist_local_upload
from app.db.base import Base
from app.db.models import Algorithm
from app.schemas import AlgorithmCreate, AlgorithmMetadataImportItem, AlgorithmRead, AlgorithmVersionCreate, TrainingArtifactBase, TrainingArtifactsAppend, TrainingResultCreate, TrainingResultUpdate, UploadRequest


class BackendSmokeTests(unittest.TestCase):
    def test_response_models_validate_orm_instances(self):
        now = datetime.now(UTC)
        algorithm = Algorithm(
            id=1,
            code="algo-17",
            name="GOLD-RSI-15-min",
            instrument="GOLD",
            resolution="MINUTE_15",
            is_active=True,
            created_at=now,
            updated_at=now,
        )

        model = AlgorithmRead.model_validate(algorithm)

        self.assertEqual(model.code, "algo-17")
        self.assertEqual(model.instrument, "GOLD")

    def test_upload_metadata_is_sanitized_and_rejects_machine_paths(self):
        upload = UploadRequest(
            file_name=r"C:\Users\dev\best_params.json",
            artifact_type="best_params_json",
            content_type="application/json",
            byte_size=10,
        )
        self.assertEqual(upload.file_name, "best_params.json")

        with self.assertRaises(ValidationError):
            TrainingArtifactBase(
                artifact_type="best_params_json",
                file_name="best_params.json",
                s3_key=r"C:\Users\dev\best_params.json",
                content_type="application/json",
            )

    def test_local_storage_stays_inside_configured_root(self):
        previous_bucket = settings.s3_bucket
        previous_storage_dir = settings.local_storage_dir
        try:
            with TemporaryDirectory() as temp_dir:
                settings.s3_bucket = None
                settings.local_storage_dir = temp_dir

                upload = create_presigned_upload(r"C:\Users\dev\equity_analysis.png", "image/png")
                self.assertTrue(upload["object_key"].endswith("/equity_analysis.png"))

                with self.assertRaises(ValueError):
                    persist_local_upload("../escape.txt", b"bad")

                saved_path = Path(persist_local_upload(upload["object_key"], b"ok")).resolve()
                self.assertTrue(saved_path.is_relative_to(Path(temp_dir).resolve()))
                self.assertEqual(saved_path.read_bytes(), b"ok")
        finally:
            settings.s3_bucket = previous_bucket
            settings.local_storage_dir = previous_storage_dir

    def test_trade_engine_metadata_import_drops_paths_and_account_details(self):
        item = AlgorithmMetadataImportItem(
            code="algo-17",
            name="GOLD-RSI-15-min",
            instrument="GOLD",
            resolution="MINUTE_15",
            version_label="dev",
            parameter_set_json={
                "algo_name": "GOLD-RSI-15-min",
                "accounts_to_run_on": [{"secret_name": "ig-prod"}],
                "analysis_outputs": {"output_dir": r"C:\Users\dev\analysis"},
            },
        )

        self.assertEqual(item.parameter_set_json, {"algo_name": "GOLD-RSI-15-min"})

    def test_training_result_can_link_multiple_algorithm_versions(self):
        engine = create_engine("sqlite:///:memory:", future=True)
        TestingSession = sessionmaker(bind=engine, future=True)
        Base.metadata.create_all(bind=engine)

        with TestingSession() as db:
            algorithm = crud.create_algorithm(
                db,
                AlgorithmCreate(
                    code="algo-combined",
                    name="Combined test",
                    instrument="GOLD",
                    resolution="MINUTE_15",
                ),
            )
            version_a = crud.create_algorithm_version(
                db,
                algorithm.id,
                AlgorithmVersionCreate(version_label="a", parameter_set_json={}, is_current=True),
            )
            version_b = crud.create_algorithm_version(
                db,
                algorithm.id,
                AlgorithmVersionCreate(version_label="b", parameter_set_json={}),
            )

            result = crud.create_training_result(
                db,
                TrainingResultCreate(
                    algo_version_id=version_a.id,
                    algo_version_ids=[version_a.id, version_b.id],
                    run_source="offline_upload",
                    status="completed",
                    summary_json={},
                    chart_series_json={},
                    artifacts=[
                        TrainingArtifactBase(
                            artifact_type="stats_csv",
                            file_name="advanced_metrics.csv",
                            s3_key="training-results/test/advanced_metrics.csv",
                            content_type="text/csv",
                        )
                    ],
                ),
            )
            crud.create_training_result(
                db,
                TrainingResultCreate(
                    algo_version_id=version_b.id,
                    algo_version_ids=[version_b.id],
                    run_source="offline_upload",
                    status="completed",
                    summary_json={},
                    chart_series_json={},
                    artifacts=[
                        TrainingArtifactBase(
                            artifact_type="stats_csv",
                            file_name="prior_metrics.csv",
                            s3_key="training-results/test/prior_metrics.csv",
                            content_type="text/csv",
                        )
                    ],
                ),
            )

            self.assertEqual(result.algo_version_id, version_a.id)
            self.assertEqual({link.algo_version_id for link in result.version_links}, {version_a.id, version_b.id})
            self.assertEqual(len(crud.list_training_results_for_version(db, version_b.id)), 2)
            self.assertEqual(len(crud.list_training_results(db, algo_version_id=version_b.id)), 2)
            self.assertEqual(len(crud.list_training_results(db, algo_id=algorithm.id)), 2)
            self.assertEqual(len(crud.list_training_results(db, current_only=True)), 1)
            self.assertEqual(len(crud.list_training_results(db, combined_only=True)), 1)

            deleted_version = crud.delete_algorithm_version(db, version_b.id)
            self.assertFalse(deleted_version.is_active)
            self.assertEqual({version.id for version in crud.list_algorithm_versions(db, algorithm.id)}, {version_a.id})
            self.assertEqual(
                {version.id for version in crud.list_algorithm_versions(db, algorithm.id, include_inactive=True)},
                {version_a.id, version_b.id},
            )

            deleted_algorithm = crud.delete_algorithm(db, algorithm.id)
            self.assertFalse(deleted_algorithm.is_active)
            self.assertEqual(crud.list_algorithm_versions(db, algorithm.id), [])

    def test_training_result_artifacts_can_be_appended_to_existing_run(self):
        engine = create_engine("sqlite:///:memory:", future=True)
        TestingSession = sessionmaker(bind=engine, future=True)
        Base.metadata.create_all(bind=engine)

        with TestingSession() as db:
            algorithm = crud.create_algorithm(
                db,
                AlgorithmCreate(
                    code="algo-run",
                    name="Run grouping test",
                    instrument="GOLD",
                    resolution="MINUTE_15",
                ),
            )
            version = crud.create_algorithm_version(
                db,
                algorithm.id,
                AlgorithmVersionCreate(version_label="current", parameter_set_json={}, is_current=True),
            )
            result = crud.create_training_result(
                db,
                TrainingResultCreate(
                    algo_version_id=version.id,
                    algo_version_ids=[version.id],
                    run_source="offline_upload",
                    status="completed",
                    summary_json={"total_profit": 10},
                    chart_series_json={},
                    artifacts=[
                        TrainingArtifactBase(
                            artifact_type="stats_csv",
                            file_name="metrics.csv",
                            s3_key="training-results/test/metrics.csv",
                            content_type="text/csv",
                        )
                    ],
                ),
            )

            updated = crud.append_training_result_artifacts(
                db,
                result.id,
                TrainingArtifactsAppend(
                    summary_json={"sharpe_ratio": 1.2},
                    artifacts=[
                        TrainingArtifactBase(
                            artifact_type="analysis_png",
                            file_name="equity.png",
                            s3_key="training-results/test/equity.png",
                            content_type="image/png",
                        )
                    ],
                ),
            )

            self.assertEqual(updated.id, result.id)
            self.assertEqual(len(updated.artifacts), 2)
            self.assertEqual(updated.summary_json, {"total_profit": 10, "sharpe_ratio": 1.2})

            edited = crud.update_training_result(
                db,
                result.id,
                TrainingResultUpdate(
                    run_source="manual_correction",
                    status="failed",
                    summary_json={"review_note": "Bad input data"},
                    chart_series_json={"equity": [1, 2, 3]},
                ),
            )

            self.assertEqual(edited.id, result.id)
            self.assertEqual(edited.run_source, "manual_correction")
            self.assertEqual(edited.status, "failed")
            self.assertEqual(edited.summary_json, {"review_note": "Bad input data"})
            self.assertEqual(edited.chart_series_json, {"equity": [1, 2, 3]})

            remaining = crud.delete_training_artifact(db, result.id, updated.artifacts[0].id)
            self.assertEqual(remaining.id, result.id)
            self.assertEqual(len(remaining.artifacts), 1)

            deleted_result_id = crud.delete_training_result(db, result.id)
            self.assertEqual(deleted_result_id, result.id)
            self.assertIsNone(crud.get_training_result(db, result.id))


if __name__ == "__main__":
    unittest.main()
