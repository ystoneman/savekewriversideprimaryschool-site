"""Regression coverage for independent checks and serialized, current-only publication."""
import contextlib
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import urllib.error

import deployment_queue as queue

ROOT = Path(__file__).resolve().parents[2]
OLD = 'a' * 40
NEW = 'b' * 40


class Response(io.BytesIO):
    pass


class PublicationEligibilityTests(unittest.TestCase):
    def test_latest_checked_revision_can_publish(self):
        self.assertTrue(queue.eligible(NEW, NEW))

    def test_older_run_finishing_late_or_rerun_cannot_overwrite_main(self):
        for revision in [OLD, 'c' * 40]:
            with self.subTest(revision=revision):
                self.assertFalse(queue.eligible(revision, NEW))

    def test_newer_failed_checks_do_not_allow_old_revision_to_publish(self):
        # Eligibility follows the branch head, regardless of the newer run's outcome.
        # The workflow separately requires both newer checks to succeed.
        self.assertFalse(queue.eligible(OLD, NEW))

    def test_pull_request_or_other_branch_cannot_publish(self):
        for event, ref in [('pull_request', 'refs/heads/main'),
                           ('push', 'refs/heads/feature'),
                           ('workflow_dispatch', 'refs/heads/main'),
                           (None, None)]:
            with self.subTest(event=event, ref=ref):
                self.assertFalse(queue.eligible(NEW, NEW, event, ref))

    def test_malformed_revisions_fail_closed(self):
        for invalid in [None, True, 40, '', 'a' * 39, 'a' * 41, 'A' * 40,
                        'g' * 40, NEW + '\n']:
            for candidate, head in [(invalid, NEW), (NEW, invalid)]:
                with self.subTest(candidate=candidate, head=head):
                    with self.assertRaises(ValueError):
                        queue.eligible(candidate, head)


class CurrentMainAPITests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, {'GH_TOKEN': 'fictional-test-token'})
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def payload(self, **changes):
        data = {'ref': 'refs/heads/main', 'object': {'type': 'commit', 'sha': NEW}}
        data.update(changes)
        return json.dumps(data).encode()

    def test_read_only_current_branch_request_has_bounded_timeout(self):
        with patch.object(queue.urllib.request, 'urlopen', return_value=Response(self.payload())) as request:
            self.assertEqual(queue.current_main(), NEW)
        api_request = request.call_args.args[0]
        self.assertEqual(api_request.get_method(), 'GET')
        self.assertEqual(api_request.full_url,
                         'https://api.github.com/repos/' + queue.REPOSITORY + '/git/ref/heads/main')
        self.assertEqual(api_request.get_header('Cache-control'), 'no-cache')
        self.assertEqual(request.call_args.kwargs['timeout'], 15)

    def test_api_errors_cannot_be_converted_to_permission_to_publish(self):
        for error in [urllib.error.HTTPError('https://api.github.com/', 403, 'denied', {}, None),
                      urllib.error.URLError('unavailable'), TimeoutError('timed out')]:
            with self.subTest(error=type(error).__name__):
                with patch.object(queue.urllib.request, 'urlopen', side_effect=error):
                    with self.assertRaises(Exception):
                        queue.current_main()

    def test_oversized_invalid_or_wrong_reference_response_is_rejected(self):
        for raw in [b'x' * (64 * 1024 + 1), b'not JSON', b'{}', b'[]',
                    self.payload(ref='refs/heads/feature'),
                    self.payload(object={'type': 'tag', 'sha': NEW}),
                    self.payload(object={'type': 'commit'})]:
            with self.subTest(raw=raw[:80]):
                with patch.object(queue.urllib.request, 'urlopen', return_value=Response(raw)):
                    with self.assertRaises(Exception):
                        queue.eligible(NEW, queue.current_main())


class PublicationCLITests(unittest.TestCase):
    def run_cli(self, head=NEW, error=None):
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / 'outputs'
            summary = Path(folder) / 'summary'
            environment = {'GITHUB_OUTPUT': str(output), 'GITHUB_STEP_SUMMARY': str(summary),
                           'GITHUB_EVENT_NAME': 'push', 'GITHUB_REF': 'refs/heads/main'}
            captured = io.StringIO()
            with patch.dict(os.environ, environment), patch('sys.argv', ['guard', '--sha', NEW]), \
                    patch.object(queue, 'current_main', return_value=head, side_effect=error), \
                    contextlib.redirect_stdout(captured), contextlib.redirect_stderr(captured):
                if error:
                    with self.assertRaises(Exception):
                        queue.main()
                else:
                    queue.main()
            return (output.read_text() if output.exists() else '',
                    summary.read_text() if summary.exists() else '', captured.getvalue())

    def test_latest_revision_emits_true(self):
        output, summary, logged = self.run_cli()
        self.assertEqual(output, 'current=true\n')
        self.assertIn('Current main revision', summary)

    def test_superseded_revision_emits_false_and_preserves_live_site(self):
        output, summary, logged = self.run_cli(head=OLD)
        self.assertEqual(output, 'current=false\n')
        self.assertIn('existing live site retained', summary)

    def test_api_failure_emits_no_publish_permission_or_secret(self):
        output, summary, logged = self.run_cli(error=RuntimeError('fictional-secret'))
        self.assertEqual(output, '')
        self.assertEqual(summary, '')
        self.assertNotIn('fictional-secret', logged)


class DeploymentQueueWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.workflow = (ROOT / '.github/workflows/pages.yml').read_text()
        self.deploy = self.workflow.split('  deploy:\n', 1)[1].split('  compatibility:\n', 1)[0]
        self.compatibility = self.workflow.split('  compatibility:\n', 1)[1]

    def test_production_checks_are_independent_and_only_pr_revisions_cancel(self):
        global_settings = self.workflow.split('jobs:\n', 1)[0]
        self.assertIn("group: pages-${{ github.event_name == 'pull_request' && github.ref || github.run_id }}", global_settings)
        self.assertIn("cancel-in-progress: ${{ github.event_name == 'pull_request' }}", global_settings)
        before_publication = self.workflow.split('  deploy:\n', 1)[0]
        self.assertNotIn('pages-refs/heads/main', before_publication)
        self.assertNotIn('compatibility-pages-publication', before_publication)

    def test_canonical_publishing_is_serial_and_uncancellable_by_new_run(self):
        self.assertIn('concurrency:\n      group: pages-refs/heads/main\n      cancel-in-progress: false', self.deploy)
        self.assertIn("!cancelled() && needs.validate.result == 'success' && needs.browser-tests.result == 'success'", self.deploy)
        self.assertIn('needs: [validate, browser-tests]', self.deploy)

    def test_branch_guard_runs_under_lock_immediately_before_publish(self):
        guard = self.deploy.index('name: Reject obsolete canonical publication')
        publish = self.deploy.index('name: Deploy validated artifact')
        self.assertLess(guard, publish)
        self.assertIn('id: current', self.deploy[guard:publish])
        self.assertIn('GH_TOKEN: ${{ github.token }}', self.deploy[guard:publish])
        self.assertIn('deployment_queue.py --sha "${{ github.sha }}"', self.deploy[guard:publish])
        self.assertIn("if: steps.current.outputs.current == 'true'", self.deploy[publish:])
        self.assertIn("published: ${{ steps.deployment.outcome == 'success' }}", self.deploy)

    def test_legacy_copies_have_separate_lock_and_require_actual_publication(self):
        self.assertIn('concurrency:\n      group: compatibility-pages-publication\n      cancel-in-progress: false', self.compatibility)
        self.assertIn("!cancelled() && needs.deploy.result == 'success' && needs.deploy.outputs.published == 'true'", self.compatibility)
        self.assertIn('needs: deploy', self.compatibility)
        self.assertIn('compatibility_release.py synchronize --sha "${{ github.sha }}" --run-id "${{ github.run_id }}"', self.compatibility)


if __name__ == '__main__':
    unittest.main()
