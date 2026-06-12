import os
import shutil
import tempfile
from pathlib import Path


def prepare_frontend_dist(root_dir: Path) -> None:
    if os.name != "nt":
        return

    source_dir = root_dir / "frontend" / "dist"
    if not source_dir.exists():
        return

    target_dir = Path(
        tempfile.mkdtemp(prefix="robotic-web-app-cdk-")
    ) / "frontend-dist"
    shutil.copytree(source_dir, target_dir)
    os.environ["ROBOTIC_FRONTEND_DIST_DIR"] = str(target_dir)
