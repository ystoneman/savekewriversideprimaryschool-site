#!/usr/bin/env python3
"""Verify exact promoted bytes; optionally recheck their source workflow evidence."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tempfile
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SOURCE_REPOSITORY = "ystoneman/kew-riverside-website"
CANDIDATE_BRANCH = "codex/primaryschool-domain-candidate"
REQUIRED_JOBS = {
    "validate", "browser-tests",
    *(f"browser-shards ({project})" for project in (
        "iphone-webkit", "android-chromium", "desktop-chromium",
        "desktop-webkit", "iphone-no-javascript")),
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def api(suffix):
    request = Request(
        f"https://api.github.com/repos/{SOURCE_REPOSITORY}/{suffix}",
        headers={"Accept": "application/vnd.github+json",
                 "X-GitHub-Api-Version": "2022-11-28",
                 "User-Agent": "savekewriverside-deployment-verifier"},
    )
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def source_evidence(run_id, commit, base_main_commit):
    require(type(run_id) is int and run_id > 0, "A numeric source workflow run ID is required.")
    require(bool(re.fullmatch(r"[0-9a-f]{40}", commit)), "Use a full source commit SHA.")
    require(bool(re.fullmatch(r"[0-9a-f]{40}", base_main_commit)), "Use a full base-main commit SHA.")
    run = api(f"actions/runs/{run_id}")
    require(run.get("repository", {}).get("full_name") == SOURCE_REPOSITORY,
            "Workflow run belongs to another repository.")
    require(run.get("head_sha") == commit, "Source checks are for a different commit.")
    require(run.get("path") == ".github/workflows/pages.yml", "Unexpected source workflow.")
    require(run.get("status") == "completed" and run.get("conclusion") == "success",
            "Source workflow must have completed successfully.")
    branch, event = run.get("head_branch"), run.get("event")
    require(branch == CANDIDATE_BRANCH and event == "workflow_dispatch",
            "Only a tested new-domain candidate dispatch can be promoted during the overlap.")
    jobs_response = api(f"actions/runs/{run_id}/jobs?per_page=100")
    jobs = jobs_response.get("jobs", [])
    require(jobs_response.get("total_count") == len(jobs), "Source job response is incomplete.")
    names = {job.get("name") for job in jobs}
    require(REQUIRED_JOBS <= names, "Source run is missing required browser or validation jobs.")
    for name in REQUIRED_JOBS:
        matches = [job for job in jobs if job.get("name") == name]
        require(len(matches) == 1 and matches[0].get("status") == "completed"
                and matches[0].get("conclusion") == "success", f"Required source job did not pass: {name}")
    deploy = [job for job in jobs if job.get("name") == "deploy"]
    require(len(deploy) == 1 and deploy[0].get("conclusion") == "skipped",
            "Candidate workflow must not deploy the original website.")
    main = api("git/ref/heads/main")
    require(main.get("object", {}).get("sha") == base_main_commit,
            "Source main advanced; update and retest the candidate before promotion.")
    comparison = api(f"compare/{base_main_commit}...{commit}")
    require(comparison.get("merge_base_commit", {}).get("sha") == base_main_commit
            and comparison.get("status") in {"ahead", "identical"},
            "Recorded base-main commit is not an ancestor of the tested candidate.")
    return {
        "repository": SOURCE_REPOSITORY, "commit": commit,
        "branch": branch, "event": event, "base_main_commit": base_main_commit,
        "workflow_path": ".github/workflows/pages.yml",
        "run_id": run_id, "run_attempt": run["run_attempt"],
        "run_url": f"https://github.com/{SOURCE_REPOSITORY}/actions/runs/{run_id}",
        "required_jobs": {name: "success" for name in sorted(REQUIRED_JOBS)},
    }


def regenerate_source(commit):
    """Fetch tested source read-only and derive the asset digests independently."""
    with tempfile.TemporaryDirectory(prefix="savekewriverside-source-check-") as temporary:
        directory = Path(temporary)
        checkout = directory / "source"
        subprocess.run(["git", "init", "--quiet", str(checkout)], check=True)
        subprocess.run(["git", "-C", str(checkout), "-c", "core.hooksPath=/dev/null",
                        "fetch", "--quiet", "--no-tags", "--depth=1",
                        f"https://github.com/{SOURCE_REPOSITORY}.git", commit], check=True)
        subprocess.run(["git", "-C", str(checkout), "-c", "core.hooksPath=/dev/null",
                        "checkout", "--quiet", "--detach", "FETCH_HEAD"], check=True)
        actual = subprocess.check_output(["git", "-C", str(checkout), "rev-parse", "HEAD"], text=True).strip()
        require(actual == commit, "Fetched source does not match the tested commit.")
        validator = checkout / ".github/scripts/check_site.py"
        require(validator.is_file() and not validator.is_symlink(), "Tested source validator is missing.")
        staged = directory / "public"
        subprocess.run([sys.executable, str(validator), "--stage", str(staged)], cwd=checkout, check=True)
        files = {}
        for path in staged.rglob("*"):
            require(not path.is_symlink(), "Tested source produced a public symlink.")
            if path.is_file():
                files[path.relative_to(staged).as_posix()] = digest(path)
        return digest(validator), files


def verify(root=ROOT, check_source_run=False):
    root = Path(root)
    manifest_path = root / "promotion.json"
    require(manifest_path.is_file() and not manifest_path.is_symlink(),
            "No promoted release: promotion.json is required before deployment.")
    manifest = json.loads(manifest_path.read_text())
    require(manifest.get("schema_version") == 2, "Unsupported promotion manifest.")
    source = manifest.get("source", {})
    require(source.get("repository") == SOURCE_REPOSITORY, "Unexpected authoritative source.")
    require(bool(re.fullmatch(r"[0-9a-f]{40}", source.get("commit", ""))), "Missing source commit.")
    require(type(source.get("run_id")) is int and source["run_id"] > 0, "Missing successful source run.")
    require(source.get("required_jobs") == {name: "success" for name in sorted(REQUIRED_JOBS)},
            "Manifest does not record all required passing source checks.")
    require(bool(re.fullmatch(r"[0-9a-f]{40}", source.get("base_main_commit", ""))), "Missing base-main commit.")
    require(source.get("branch") == CANDIDATE_BRANCH and source.get("event") == "workflow_dispatch",
            "Only the new-domain candidate branch may be promoted during the overlap.")
    require(bool(re.fullmatch(r"[0-9a-f]{64}", manifest.get("validator_sha256", ""))),
            "Missing source validator digest.")
    files = manifest.get("files", {})
    require(isinstance(files, dict) and "index.html" in files and len(files) > 1,
            "A populated public asset manifest is required.")
    for name, sha in files.items():
        path = PurePosixPath(name)
        require(path.as_posix() == name and not path.is_absolute() and ".." not in path.parts
                and all(not part.startswith(".") for part in path.parts) and "\\" not in name,
                f"Unsafe public path: {name}")
        require(isinstance(sha, str) and bool(re.fullmatch(r"[0-9a-f]{64}", sha)),
                f"Invalid digest: {name}")
    public = root / "public"
    require(public.is_dir() and not public.is_symlink(), "Missing public asset directory.")
    found = set()
    for path in public.rglob("*"):
        require(not path.is_symlink(), f"Public symlink forbidden: {path.name}")
        if path.is_dir():
            continue
        require(path.is_file(), f"Non-file public entry: {path.name}")
        found.add(path.relative_to(public).as_posix())
    require(found == set(files), "Public file set differs from the source allowlist manifest.")
    for name, sha in files.items():
        require(digest(public / name) == sha, f"Promoted asset was changed: {name}")
    if check_source_run:
        current = source_evidence(source["run_id"], source["commit"], source["base_main_commit"])
        require(current == source, "Source workflow evidence changed; promote the verified run again.")
        validator_sha, source_files = regenerate_source(source["commit"])
        require(validator_sha == manifest["validator_sha256"], "Validator digest differs from the tested source.")
        require(source_files == files, "Public assets or manifest differ from the tested source allowlist output.")
    return len(files)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check-source-run", action="store_true")
    args = parser.parse_args()
    try:
        print(f"Verified {verify(check_source_run=args.check_source_run)} promoted public assets.")
    except (ValueError, OSError, KeyError, TypeError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"Verification failed: {error}\n")
