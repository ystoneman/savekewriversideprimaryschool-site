"""Regression checks for the deployment's source-evidence and publication boundary."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from verify import CANDIDATE_BRANCH, REQUIRED_JOBS, SOURCE_REPOSITORY, digest, source_evidence, verify

COMMIT = "1" * 40
BASE_MAIN = "0" * 40
VALIDATOR_SHA = "a" * 64


class PromotionGuards(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        (self.root / "public").mkdir()
        (self.root / "public/index.html").write_text("<p>Fictional test site</p>\n")
        (self.root / "public/site.css").write_text("p { color: black; }\n")
        self.manifest = {
            "schema_version": 2,
            "validator_sha256": VALIDATOR_SHA,
            "source": {
                "repository": SOURCE_REPOSITORY, "commit": COMMIT,
                "branch": CANDIDATE_BRANCH, "event": "workflow_dispatch", "base_main_commit": BASE_MAIN,
                "run_id": 123, "run_attempt": 1,
                "workflow_path": ".github/workflows/pages.yml",
                "run_url": f"https://github.com/{SOURCE_REPOSITORY}/actions/runs/123",
                "required_jobs": {name: "success" for name in sorted(REQUIRED_JOBS)},
            },
            "files": {name: digest(self.root / "public" / name) for name in ("index.html", "site.css")},
        }
        self.write_manifest()

    def write_manifest(self):
        (self.root / "promotion.json").write_text(json.dumps(self.manifest))

    def test_exact_assets_pass_and_metadata_stays_outside_public(self):
        self.assertEqual(verify(self.root), 2)
        self.assertFalse((self.root / "public/promotion.json").exists())

    def test_empty_scaffold_cannot_deploy(self):
        (self.root / "promotion.json").unlink()
        with self.assertRaisesRegex(ValueError, "No promoted release"):
            verify(self.root)

    def test_edited_asset_cannot_deploy(self):
        (self.root / "public/index.html").write_text("Changed without source checks")
        with self.assertRaisesRegex(ValueError, "was changed"):
            verify(self.root)

    def test_extra_private_file_cannot_deploy(self):
        (self.root / "public/private-notes.txt").write_text("Fictional private test note")
        with self.assertRaisesRegex(ValueError, "file set differs"):
            verify(self.root)

    def test_missing_asset_cannot_deploy(self):
        (self.root / "public/site.css").unlink()
        with self.assertRaisesRegex(ValueError, "file set differs"):
            verify(self.root)

    def test_public_symlink_cannot_deploy(self):
        (self.root / "public/site.css").unlink()
        (self.root / "public/site.css").symlink_to(self.root / "promotion.json")
        with self.assertRaisesRegex(ValueError, "symlink forbidden"):
            verify(self.root)

    def test_manifest_cannot_escape_public_directory(self):
        self.manifest["files"]["../private.txt"] = "a" * 64
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "Unsafe public path"):
            verify(self.root)

    def test_workflow_evidence_is_rechecked(self):
        with patch("verify.source_evidence", return_value=self.manifest["source"]) as lookup, \
                patch("verify.regenerate_source", return_value=(VALIDATOR_SHA, self.manifest["files"])) as regenerate:
            self.assertEqual(verify(self.root, check_source_run=True), 2)
            lookup.assert_called_once_with(123, COMMIT, BASE_MAIN)
            regenerate.assert_called_once_with(COMMIT)
        changed = dict(self.manifest["source"], run_attempt=2)
        with patch("verify.source_evidence", return_value=changed):
            with self.assertRaisesRegex(ValueError, "evidence changed"):
                verify(self.root, check_source_run=True)

    def test_jointly_edited_asset_and_manifest_cannot_hide_untested_bytes(self):
        tested_files = dict(self.manifest["files"])
        (self.root / "public/index.html").write_text("Changed after source tests passed")
        self.manifest["files"]["index.html"] = digest(self.root / "public/index.html")
        self.write_manifest()
        self.assertEqual(verify(self.root), 2)  # Local consistency alone is insufficient.
        with patch("verify.source_evidence", return_value=self.manifest["source"]), \
                patch("verify.regenerate_source", return_value=(VALIDATOR_SHA, tested_files)):
            with self.assertRaisesRegex(ValueError, "differ from the tested source"):
                verify(self.root, check_source_run=True)

    def test_validator_digest_is_anchored_to_fetched_source(self):
        with patch("verify.source_evidence", return_value=self.manifest["source"]), \
                patch("verify.regenerate_source", return_value=("b" * 64, self.manifest["files"])):
            with self.assertRaisesRegex(ValueError, "Validator digest differs"):
                verify(self.root, check_source_run=True)


class SourceEvidenceGuards(unittest.TestCase):
    def setUp(self):
        self.run = {
            "repository": {"full_name": SOURCE_REPOSITORY}, "head_sha": COMMIT,
            "path": ".github/workflows/pages.yml", "status": "completed", "conclusion": "success",
            "head_branch": CANDIDATE_BRANCH, "event": "workflow_dispatch", "run_attempt": 1,
        }
        self.jobs = [{"name": name, "status": "completed", "conclusion": "success"}
                     for name in REQUIRED_JOBS]
        self.jobs.append({"name": "deploy", "status": "completed", "conclusion": "skipped"})
        self.main = {"object": {"sha": BASE_MAIN}}
        self.comparison = {"merge_base_commit": {"sha": BASE_MAIN}, "status": "ahead"}

    def evidence(self):
        with patch("verify.api", side_effect=[self.run, {"total_count": len(self.jobs), "jobs": self.jobs},
                                             self.main, self.comparison]):
            return source_evidence(123, COMMIT, BASE_MAIN)

    def test_successful_candidate_requires_all_browser_projects(self):
        self.assertEqual(self.evidence()["base_main_commit"], BASE_MAIN)
        self.jobs = [job for job in self.jobs if job["name"] != "browser-shards (iphone-webkit)"]
        with self.assertRaisesRegex(ValueError, "missing required"):
            self.evidence()

    def test_failed_job_cannot_be_promoted(self):
        self.jobs[0]["conclusion"] = "failure"
        with self.assertRaisesRegex(ValueError, "did not pass"):
            self.evidence()

    def test_workflow_must_test_the_explicit_commit(self):
        self.run["head_sha"] = "2" * 40
        with self.assertRaisesRegex(ValueError, "different commit"):
            self.evidence()

    def test_candidate_cannot_deploy_original_site(self):
        self.jobs[-1]["conclusion"] = "success"
        with self.assertRaisesRegex(ValueError, "must not deploy"):
            self.evidence()

    def test_main_is_not_a_domain_ready_candidate(self):
        self.run.update(head_branch="main", event="push")
        with self.assertRaisesRegex(ValueError, "Only a tested new-domain candidate"):
            self.evidence()

    def test_candidate_gate_does_not_allow_arbitrary_branch(self):
        self.run.update(head_branch="another-branch", event="workflow_dispatch")
        with self.assertRaisesRegex(ValueError, "Only a tested new-domain candidate"):
            self.evidence()

    def test_previous_domain_candidate_cannot_replace_primaryschool_bindings(self):
        self.run.update(head_branch="codex/new-domain-candidate", event="workflow_dispatch")
        with self.assertRaisesRegex(ValueError, "Only a tested new-domain candidate"):
            self.evidence()

    def test_stale_candidate_cannot_omit_new_main_corrections(self):
        self.main["object"]["sha"] = "2" * 40
        with self.assertRaisesRegex(ValueError, "Source main advanced"):
            self.evidence()

    def test_claimed_base_must_actually_be_candidate_ancestor(self):
        self.comparison["merge_base_commit"]["sha"] = "2" * 40
        with self.assertRaisesRegex(ValueError, "not an ancestor"):
            self.evidence()


if __name__ == "__main__":
    unittest.main()
