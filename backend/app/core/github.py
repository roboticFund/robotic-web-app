import ast
import base64
from datetime import UTC, datetime
import json
from pathlib import Path, PurePosixPath
import re
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from app.core.config import settings


ROBOTIC_FUND_SECRET_NAME = "ig-robotic-fund"


class GitHubIntegrationError(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


def _read_env_value(name: str) -> str | None:
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.exists():
        return None
    for line in env_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        if key.strip() == name:
            normalized = value.strip().strip('"').strip("'")
            return normalized or None
    return None


def _github_token() -> str | None:
    return settings.github_token or _read_env_value("GITHUB_TOKEN")


class _TemplateValues(dict[str, str]):
    def __missing__(self, key: str) -> str:
        raise KeyError(key)


def _template_slug(value: str) -> str:
    return re.sub(r"[^a-z0-9_.-]+", "-", value.strip().lower()).strip("-")


def validate_github_file_path(path: str) -> str:
    normalized = path.replace("\\", "/").strip()
    if not normalized or normalized.startswith("/") or ":" in normalized:
        raise GitHubIntegrationError(400, "GitHub parameter path must be a relative repository path")
    if any(part in {"", ".", ".."} for part in PurePosixPath(normalized).parts):
        raise GitHubIntegrationError(400, "GitHub parameter path must not contain empty or traversal segments")
    return normalized


def render_github_parameter_path(template: str, values: dict[str, Any]) -> str:
    normalized_values = {
        key: "" if value is None else str(value)
        for key, value in values.items()
    }
    normalized_values.update({
        f"{key}_lower": _template_slug(value)
        for key, value in normalized_values.items()
    })
    try:
        rendered = template.format_map(_TemplateValues(normalized_values))
    except KeyError as exc:
        raise GitHubIntegrationError(400, f"Unknown GitHub parameter path template field: {exc.args[0]}") from exc
    return validate_github_file_path(rendered)


def parse_python_parameter_content(raw_text: str) -> dict[str, Any] | None:
    module = ast.parse(raw_text)
    for statement in module.body:
        value_node = None
        targets: list[ast.expr] = []
        if isinstance(statement, ast.Assign):
            value_node = statement.value
            targets = list(statement.targets)
        elif isinstance(statement, ast.AnnAssign):
            value_node = statement.value
            targets = [statement.target]

        if value_node is None:
            continue

        target_names = {
            target.id
            for target in targets
            if isinstance(target, ast.Name)
        }
        if not target_names.intersection({"algo_params", "ALGO_PARAMS"}):
            continue

        parsed = ast.literal_eval(value_node)
        if not isinstance(parsed, dict):
            raise ValueError("algo_params must be a dictionary")
        return parsed
    return None


def parse_parameter_content(raw_text: str, path: str) -> tuple[Any, str]:
    extension = path.rsplit(".", 1)[-1].lower() if "." in path else ""
    if extension == "json":
        return json.loads(raw_text), "application/json"
    if extension == "py":
        return parse_python_parameter_content(raw_text), "text/x-python"
    return None, "text/plain"


def extract_account_size(parameter_json: Any, secret_name: str = ROBOTIC_FUND_SECRET_NAME) -> Any:
    if not isinstance(parameter_json, dict):
        return None
    accounts = parameter_json.get("accounts_to_run_on")
    if not isinstance(accounts, list):
        return None
    for account in accounts:
        if not isinstance(account, dict):
            continue
        if account.get("secret_name") == secret_name:
            return account.get("size")
    return None


def derive_parameter_summary(parameter_json: Any) -> dict[str, Any]:
    return {
        "robotic_fund_size": extract_account_size(parameter_json),
    }


def _github_contents_url(owner: str, repo: str, path: str, ref: str | None) -> str:
    encoded_path = "/".join(quote(part, safe="") for part in path.split("/"))
    url = f"{settings.github_api_base_url.rstrip('/')}/repos/{quote(owner, safe='')}/{quote(repo, safe='')}/contents/{encoded_path}"
    if ref:
        url = f"{url}?ref={quote(ref, safe='')}"
    return url


def _github_commit_url(owner: str, repo: str, ref: str) -> str:
    return f"{settings.github_api_base_url.rstrip('/')}/repos/{quote(owner, safe='')}/{quote(repo, safe='')}/commits/{quote(ref, safe='')}"


def _github_request(url: str) -> Request:
    request = Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "robotic-web-app",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    token = _github_token()
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    return request


def _parse_github_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def fetch_github_commit_date(owner: str, repo: str, ref: str | None) -> datetime | None:
    if not ref:
        return None
    try:
        with urlopen(_github_request(_github_commit_url(owner, repo, ref)), timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, json.JSONDecodeError):
        return None

    commit = payload.get("commit") if isinstance(payload, dict) else None
    if not isinstance(commit, dict):
        return None
    committer = commit.get("committer")
    author = commit.get("author")
    if isinstance(committer, dict):
        parsed = _parse_github_datetime(committer.get("date"))
        if parsed:
            return parsed
    if isinstance(author, dict):
        return _parse_github_datetime(author.get("date"))
    return None


def fetch_github_parameter_file(
    *,
    version_id: int,
    owner: str,
    repo: str,
    path: str,
    ref: str | None = None,
) -> dict[str, Any]:
    try:
        with urlopen(_github_request(_github_contents_url(owner, repo, path, ref)), timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        if exc.code == 404:
            ref_label = ref or "default branch"
            raise GitHubIntegrationError(
                404,
                (
                    "GitHub parameter file not found, or the repository/ref is not accessible "
                    f"with the configured token: {owner}/{repo}/{path} at {ref_label}"
                ),
            ) from exc
        if exc.code in {401, 403}:
            raise GitHubIntegrationError(exc.code, "GitHub credentials cannot access this file") from exc
        raise GitHubIntegrationError(502, f"GitHub request failed with status {exc.code}") from exc
    except URLError as exc:
        raise GitHubIntegrationError(502, "Unable to reach GitHub") from exc
    except json.JSONDecodeError as exc:
        raise GitHubIntegrationError(502, "GitHub returned an unexpected response") from exc

    if isinstance(payload, list) or payload.get("type") != "file":
        raise GitHubIntegrationError(400, "GitHub parameter path must point to a file")

    encoding = payload.get("encoding")
    content = payload.get("content")
    if encoding != "base64" or not isinstance(content, str):
        raise GitHubIntegrationError(502, "GitHub file content is not base64 encoded")

    try:
        raw_text = base64.b64decode(content, validate=False).decode("utf-8")
    except (ValueError, UnicodeDecodeError) as exc:
        raise GitHubIntegrationError(502, "GitHub parameter file must be UTF-8 text") from exc

    try:
        parameter_json, content_type = parse_parameter_content(raw_text, path)
    except json.JSONDecodeError as exc:
        raise GitHubIntegrationError(422, "GitHub JSON parameter file is not valid JSON") from exc
    except (SyntaxError, ValueError) as exc:
        raise GitHubIntegrationError(422, "GitHub Python parameter file must contain a literal algo_params dictionary") from exc

    return {
        "version_id": version_id,
        "repository": f"{owner}/{repo}",
        "path": path,
        "ref": ref,
        "html_url": payload.get("html_url"),
        "sha": payload.get("sha"),
        "content_type": content_type,
        "parameter_json": parameter_json,
        "parameter_summary": derive_parameter_summary(parameter_json),
        "commit_date": fetch_github_commit_date(owner, repo, ref),
        "raw_text": raw_text,
        "fetched_at": datetime.now(UTC),
    }
