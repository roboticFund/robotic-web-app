from datetime import UTC, datetime
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from pydantic import ValidationError

from app.core.config import settings
from app.core.storage import create_presigned_upload, persist_local_upload
from app.db.models import Algorithm
from app.schemas import AlgorithmMetadataImportItem, AlgorithmRead, TrainingArtifactBase, UploadRequest


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


if __name__ == "__main__":
    unittest.main()
