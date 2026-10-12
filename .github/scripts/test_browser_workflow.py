"""Guard complete browser coverage and fail-closed publication as CI is sharded."""
import collections
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / '.github/workflows/pages.yml'
CONFIG = ROOT / 'playwright.config.js'


def complete_matrix(workflow, projects):
    matrix = workflow.split('      matrix:\n', 1)[1].split('    steps:\n', 1)[0]
    rows = re.findall(
        r'^          - \{ project: ([\w-]+), shard: (\d+), total: (\d+) \}$',
        matrix, re.M,
    )
    if not rows or matrix.count('          - ') != len(rows):
        raise ValueError('Every browser matrix entry must be understood')
    grouped = collections.defaultdict(list)
    for project, shard, total in rows:
        grouped[project].append((int(shard), int(total)))
    if set(grouped) != set(projects):
        raise ValueError('Every configured browser project must run')
    for shards in grouped.values():
        totals = {total for _, total in shards}
        if len(totals) != 1:
            raise ValueError('Shard totals must agree within a project')
        total = totals.pop()
        if total < 1 or sorted(shard for shard, _ in shards) != list(range(1, total + 1)):
            raise ValueError('Every shard must run exactly once')
    return grouped


class BrowserWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.workflow = WORKFLOW.read_text()
        self.config = CONFIG.read_text()
        self.projects = re.findall(r"\{ name: '([\w-]+)'", self.config)

    def test_every_project_and_shard_is_present_once(self):
        grouped = complete_matrix(self.workflow, self.projects)
        self.assertEqual(len(grouped['iphone-webkit']), 3)
        self.assertEqual(len(grouped['desktop-webkit']), 3)
        self.assertIn('--shard="${{ matrix.shard }}/${{ matrix.total }}"', self.workflow)
        self.assertIn('--project="${{ matrix.project }}"', self.workflow)

    def test_omitted_duplicate_unknown_or_inconsistent_shards_are_rejected(self):
        row = '          - { project: iphone-webkit, shard: 2, total: 3 }\n'
        for broken in [
            self.workflow.replace(row, ''),
            self.workflow.replace(row, row + row),
            self.workflow.replace(row, row.replace('iphone-webkit', 'unconfigured-browser')),
            self.workflow.replace(row, row.replace('total: 3', 'total: 4')),
        ]:
            with self.subTest(matrix=broken), self.assertRaises(ValueError):
                complete_matrix(broken, self.projects)

    def test_cancelled_failed_or_skipped_checks_cannot_publish(self):
        aggregate = self.workflow.split('  browser-tests:\n', 1)[1].split('  deploy:\n', 1)[0]
        deploy = self.workflow.split('  deploy:\n', 1)[1].split('  compatibility:\n', 1)[0]
        self.assertIn('if: ${{ always() }}', aggregate)
        self.assertIn('needs: [validate, browser-shards]', aggregate)
        self.assertIn('BROWSER_RESULT: ${{ needs.browser-shards.result }}', aggregate)
        self.assertIn('VALIDATION_RESULT: ${{ needs.validate.result }}', aggregate)
        self.assertIn('REUSE: ${{ needs.validate.outputs.reuse }}', aggregate)
        self.assertIn('PROOF_RUN: ${{ needs.validate.outputs.proof_run }}', aggregate)
        self.assertIn('run: python3 .github/scripts/pr_browser_reuse.py gate', aggregate)
        self.assertIn("if: needs.validate.outputs.reuse != 'true'", self.workflow)
        self.assertIn('needs: [validate, browser-tests]', deploy)
        self.assertIn("if: ${{ !cancelled() && needs.validate.result == 'success' && needs.browser-tests.result == 'success' && github.ref == 'refs/heads/main' && github.event_name == 'push' }}", deploy)
        compatibility = self.workflow.split('  compatibility:\n', 1)[1]
        self.assertIn("if: ${{ !cancelled() && needs.deploy.result == 'success' && github.ref == 'refs/heads/main' && github.event_name == 'push' }}", compatibility)
        self.assertIn('fail-fast: false', self.workflow)

    def test_only_obsolete_pull_request_runs_are_cancelled(self):
        self.assertIn("cancel-in-progress: ${{ github.event_name == 'pull_request' }}", self.workflow)
        self.assertIn('group: pages-${{ github.ref }}', self.workflow)

    def test_failure_evidence_has_a_unique_name_per_shard(self):
        self.assertIn('name: browser-test-failures-${{ matrix.project }}-${{ matrix.shard }}-of-${{ matrix.total }}', self.workflow)
        self.assertIn("if: failure()", self.workflow)
        self.assertIn('test-results/', self.workflow)
        self.assertIn('playwright-report/', self.workflow)


if __name__ == '__main__':
    unittest.main()
