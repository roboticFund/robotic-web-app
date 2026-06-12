from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from urllib.error import HTTPError

from app import crud
from app.core.config import settings
from app.core.github import (
    GitHubIntegrationError,
    derive_parameter_summary,
    fetch_github_parameter_file,
    parse_parameter_content,
    render_github_parameter_path,
)
from app.core.storage import create_presigned_upload, persist_local_upload
from app.db.base import Base
from app.db.models import Algorithm
from app.schemas import (
    AlgorithmCreate,
    AlgorithmMetadataImportItem,
    AlgorithmRead,
    AlgorithmVersionCreate,
    AlgorithmVersionRead,
    AlgorithmVersionUpdate,
    TrainingArtifactBase,
    TrainingArtifactsAppend,
    TrainingResultCreate,
    TrainingResultUpdate,
    UploadRequest,
)


class BackendSmokeTests(unittest.TestCase):
    class _FakeGitHubResponse:
        def __init__(self, payload: bytes):
            self.payload = payload

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, traceback):
            return False

        def read(self):
            return self.payload

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

    def test_algorithm_version_detail_preserves_parameter_metadata(self):
        engine = create_engine("sqlite:///:memory:", future=True)
        TestingSession = sessionmaker(bind=engine, future=True)
        Base.metadata.create_all(bind=engine)

        with TestingSession() as db:
            algorithm = crud.create_algorithm(
                db,
                AlgorithmCreate(
                    code="algo-params",
                    name="Parameter detail test",
                    instrument="GOLD",
                    resolution="MINUTE_15",
                ),
            )
            version = crud.create_algorithm_version(
                db,
                algorithm.id,
                AlgorithmVersionCreate(
                    version_label="v1",
                    description="Initial tuned version",
                    parameter_set_json={
                        "lookback": 20,
                        "risk": {"max_position": 2, "stop_loss": 0.0125},
                    },
                    git_commit_sha="abc123",
                    github_repo_owner="robotic-fund",
                    github_repo_name="trade-engine",
                    github_parameter_path="algorithms/algo-params/params.json",
                    github_ref="main",
                    effective_from=datetime(2026, 6, 11, 9, 30),
                    is_current=True,
                ),
            )

            fetched = crud.get_algorithm_version(db, version.id)
            detail = AlgorithmVersionRead.model_validate(fetched)

            self.assertEqual(detail.algo_id, algorithm.id)
            self.assertEqual(detail.description, "Initial tuned version")
            self.assertEqual(detail.parameter_set_json["lookback"], 20)
            self.assertEqual(detail.parameter_set_json["risk"], {"max_position": 2, "stop_loss": 0.0125})
            self.assertEqual(detail.git_commit_sha, "abc123")
            self.assertEqual(detail.github_repo_owner, "robotic-fund")
            self.assertEqual(detail.github_parameter_path, "algorithms/algo-params/params.json")
            self.assertEqual(detail.effective_from, datetime(2026, 6, 11, 9, 30))

            updated = crud.update_algorithm_version(
                db,
                version.id,
                AlgorithmVersionUpdate(
                    github_repo_owner=None,
                    github_repo_name=None,
                    github_parameter_path=None,
                    github_ref=None,
                ),
            )

            self.assertIsNone(updated.github_repo_owner)
            self.assertIsNone(updated.github_parameter_path)

    def test_algorithm_versions_order_current_first_then_version_number_desc(self):
        engine = create_engine("sqlite:///:memory:", future=True)
        TestingSession = sessionmaker(bind=engine, future=True)
        Base.metadata.create_all(bind=engine)

        with TestingSession() as db:
            algorithm = crud.create_algorithm(
                db,
                AlgorithmCreate(
                    code="algo-order",
                    name="Version order test",
                    instrument="GOLD",
                    resolution="MINUTE_15",
                ),
            )
            for label in ["2", "10", "1"]:
                crud.create_algorithm_version(
                    db,
                    algorithm.id,
                    AlgorithmVersionCreate(
                        version_label=label,
                        parameter_set_json={},
                        is_current=label == "1",
                    ),
                )

            versions = crud.list_algorithm_versions(db, algorithm.id)

        self.assertEqual([version.version_label for version in versions], ["1", "10", "2"])

    def test_github_parameter_metadata_rejects_local_paths_and_parses_json(self):
        with self.assertRaises(ValidationError):
            AlgorithmVersionCreate(
                version_label="bad-path",
                parameter_set_json={},
                github_repo_owner="robotic-fund",
                github_repo_name="trade-engine",
                github_parameter_path=r"C:\Users\dev\params.json",
            )

        parsed, content_type = parse_parameter_content('{"lookback": 20, "enabled": true}', "params.json")
        python_params, python_content_type = parse_parameter_content("PARAMS = {'lookback': 20}", "algo_params.py")

        self.assertEqual(content_type, "application/json")
        self.assertEqual(parsed, {"lookback": 20, "enabled": True})
        self.assertEqual(python_content_type, "text/x-python")
        self.assertIsNone(python_params)

    def test_python_algo_params_extracts_robotic_fund_size(self):
        parsed, content_type = parse_parameter_content(
            """
algo_params = {
    "algo_name": "squeeze momentum strategy",
    "algo_number": "algo-1",
    "instrument": "AUDUSD",
    "resolution": "MINUTE_15",
    "accounts_to_run_on": [{
        "secret_name": "ig-robotic-fund",
        "size": 5,
        "broker": "IG"
    }, {
        "secret_name": "ig-daniel-prod",
        "size": 2,
        "broker": "IG"
    }]
}
""",
            "algo_params.py",
        )
        summary = derive_parameter_summary(parsed)

        self.assertEqual(content_type, "text/x-python")
        self.assertEqual(parsed["algo_name"], "squeeze momentum strategy")
        self.assertEqual(summary["robotic_fund_size"], 5)

    def test_github_parameter_path_template_uses_algorithm_version_metadata(self):
        path = render_github_parameter_path(
            "resources/algorithms/{algorithm_code_lower}/versions/{version_label_lower}/algo_params.py",
            {
                "algorithm_code": "Algo 1",
                "version_label": "Release 2",
                "version_id": 3,
            },
        )

        self.assertEqual(path, "resources/algorithms/algo-1/versions/release-2/algo_params.py")

    def test_github_404_explains_private_repo_or_missing_file(self):
        with patch(
            "app.core.github.urlopen",
            side_effect=HTTPError(
                "https://api.github.com/repos/roboticFund/trade-engine/contents/resources/algorithms/algo1/algo_params.py",
                404,
                "Not Found",
                {},
                BytesIO(b'{"message":"Not Found"}'),
            ),
        ):
            with self.assertRaises(GitHubIntegrationError) as context:
                fetch_github_parameter_file(
                    version_id=3,
                    owner="roboticFund",
                    repo="trade-engine",
                    path="resources/algorithms/algo1/algo_params.py",
                    ref="d177b9102795283e0e07fd9a4c790c530b5545c9",
                )

        self.assertEqual(context.exception.status_code, 404)
        self.assertIn("not accessible with the configured token", context.exception.detail)

    def test_github_parameter_file_includes_commit_date(self):
        content_response = self._FakeGitHubResponse(
            b"""{
                "type": "file",
                "encoding": "base64",
                "content": "eyJhY2NvdW50c190b19ydW5fb24iOlt7InNlY3JldF9uYW1lIjoiaWctcm9ib3RpYy1mdW5kIiwic2l6ZSI6NX1dfQ==",
                "html_url": "https://github.com/roboticFund/trade-engine/blob/abc123/resources/algorithms/algo1/algo_params.json",
                "sha": "file-sha"
            }"""
        )
        commit_response = self._FakeGitHubResponse(
            b"""{
                "commit": {
                    "committer": {"date": "2026-06-10T23:45:12Z"},
                    "author": {"date": "2026-06-10T22:00:00Z"}
                }
            }"""
        )

        with patch("app.core.github.urlopen", side_effect=[content_response, commit_response]):
            file_data = fetch_github_parameter_file(
                version_id=3,
                owner="roboticFund",
                repo="trade-engine",
                path="resources/algorithms/algo1/algo_params.json",
                ref="abc123",
            )

        self.assertEqual(file_data["commit_date"], datetime(2026, 6, 10, 23, 45, 12, tzinfo=UTC))
        self.assertEqual(file_data["parameter_summary"]["robotic_fund_size"], 5)

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
            single_result = crud.create_training_result(
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
            self.assertFalse(result.is_dashboard_latest)

            dashboard_result = crud.mark_training_result_dashboard_latest(db, result.id)
            self.assertTrue(dashboard_result.is_dashboard_latest)
            self.assertEqual(crud.get_dashboard_training_result(db).id, result.id)
            self.assertEqual([item.id for item in crud.list_training_results(db, dashboard_latest=True)], [result.id])

            dashboard_result = crud.mark_training_result_dashboard_latest(db, single_result.id)
            db.refresh(result)
            self.assertTrue(dashboard_result.is_dashboard_latest)
            self.assertFalse(result.is_dashboard_latest)
            self.assertEqual(crud.get_dashboard_training_result(db).id, single_result.id)

            dashboard_result = crud.clear_training_result_dashboard_latest(db, single_result.id)
            self.assertFalse(dashboard_result.is_dashboard_latest)
            self.assertIsNone(crud.get_dashboard_training_result(db))

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
                    data_from=datetime(2020, 1, 1, tzinfo=UTC),
                    data_to=datetime(2026, 6, 5, tzinfo=UTC),
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
            self.assertEqual(updated.data_from, datetime(2020, 1, 1))
            self.assertEqual(updated.data_to, datetime(2026, 6, 5))

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
