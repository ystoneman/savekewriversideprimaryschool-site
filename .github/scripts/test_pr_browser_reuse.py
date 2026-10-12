"""Adversarial checks for bounded, fail-closed PR browser evidence reuse."""
import copy
from datetime import datetime, timedelta, timezone
import hashlib
import io
import json
import struct
import warnings
import unittest
from unittest.mock import Mock
import urllib.error
import zipfile

import pr_browser_reuse as reuse


def archive(payload, name='evidence.json'):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as bundle:
        bundle.writestr(name, payload)
    raw = buffer.getvalue()
    return raw, 'sha256:' + hashlib.sha256(raw).hexdigest()


class ArchiveTests(unittest.TestCase):
    def test_accepts_single_bounded_json_object_with_verified_digest(self):
        raw, digest = archive('{"schema":1}')
        self.assertEqual(reuse.parse_archive(raw, digest), {'schema': 1})

    def test_rejects_missing_wrong_or_malformed_digest(self):
        raw, digest = archive('{}')
        for bad in ['', None, 'sha256:' + '0' * 64, digest[7:], 'md5:' + '0' * 64]:
            with self.subTest(digest=bad), self.assertRaises(reuse.Refusal):
                reuse.parse_archive(raw, bad)

    def test_rejects_extra_duplicate_traversal_and_symlink_members(self):
        for mode in ['extra', 'duplicate', 'traversal', 'symlink']:
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, 'w') as bundle:
                if mode == 'symlink':
                    info = zipfile.ZipInfo('evidence.json')
                    info.create_system = 3
                    info.external_attr = 0o120777 << 16
                    bundle.writestr(info, '{}')
                elif mode == 'traversal':
                    bundle.writestr('../evidence.json', '{}')
                else:
                    bundle.writestr('evidence.json', '{}')
                    with warnings.catch_warnings():
                        warnings.simplefilter('ignore', UserWarning)
                        bundle.writestr('other.json' if mode == 'extra' else 'evidence.json', '{}')
            raw = buffer.getvalue()
            with self.subTest(mode=mode), self.assertRaises(reuse.Refusal):
                reuse.parse_archive(raw, 'sha256:' + hashlib.sha256(raw).hexdigest())

    def test_rejects_encrypted_archive_flag(self):
        raw, _ = archive('{}')
        raw = bytearray(raw)
        for signature, offset in [(b'PK\x03\x04', 6), (b'PK\x01\x02', 8)]:
            index = raw.index(signature) + offset
            flags = struct.unpack_from('<H', raw, index)[0]
            struct.pack_into('<H', raw, index, flags | 1)
        raw = bytes(raw)
        with self.assertRaises(reuse.Refusal):
            reuse.parse_archive(raw, 'sha256:' + hashlib.sha256(raw).hexdigest())

    def test_rejects_invalid_json_nonobjects_and_duplicate_keys(self):
        for payload in ['{', '[]', 'null', '1', '{"schema":1,"schema":2}', '{"nested":{"x":1,"x":2}}']:
            raw, digest = archive(payload)
            with self.subTest(payload=payload), self.assertRaises(reuse.Refusal):
                reuse.parse_archive(raw, digest)

    def test_rejects_compressed_expansion_and_oversized_archive(self):
        raw, digest = archive(json.dumps({'padding': 'x' * 16384}))
        with self.assertRaises(reuse.Refusal):
            reuse.parse_archive(raw, digest)
        raw = b'x' * 65537
        with self.assertRaises(reuse.Refusal):
            reuse.parse_archive(raw, 'sha256:' + hashlib.sha256(raw).hexdigest())

    def test_rejects_corrupt_zip_even_with_matching_digest(self):
        raw = b'not a zip archive'
        with self.assertRaises(reuse.Refusal):
            reuse.parse_archive(raw, 'sha256:' + hashlib.sha256(raw).hexdigest())


class EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.identity = {
            'repository_id': 12345, 'run_id': 23456, 'attempt': 1, 'pr': 27,
            'head': 'a' * 40, 'base': 'b' * 40, 'checkout': 'c' * 40,
        }
        self.current = {
            'tree': 'd' * 40, 'public_digest': 'e' * 64,
            'runtime': {'node': 'v22.20.0', 'platform': 'linux', 'arch': 'x64',
                        'browser_image': 'mcr.microsoft.com/playwright:v1.56.1-noble@sha256:' + 'f' * 64},
        }
        self.doc = {'schema': 1, 'repository': reuse.REPOSITORY,
                    **self.identity, **copy.deepcopy(self.current),
                    'project': 'iphone-webkit', 'shard': 2, 'total': 3}

    def verify(self, doc):
        return reuse.verify_evidence(doc, self.current, self.identity, 'iphone-webkit', 2, 3)

    def test_accepts_complete_matching_evidence(self):
        self.verify(self.doc)

    def test_rejects_each_changed_provenance_or_content_field(self):
        replacements = {
            'schema': 2, 'repository': 'attacker/repo', 'repository_id': 67890,
            'run_id': 23457, 'attempt': 2, 'pr': 28, 'head': '1' * 40,
            'base': '2' * 40, 'checkout': '3' * 40, 'tree': '4' * 40,
            'public_digest': '5' * 64, 'project': 'desktop-webkit', 'shard': 1, 'total': 4,
        }
        for key, value in replacements.items():
            doc = copy.deepcopy(self.doc)
            doc[key] = value
            with self.subTest(field=key), self.assertRaises(reuse.Refusal):
                self.verify(doc)

    def test_rejects_missing_or_unknown_keys(self):
        for key in self.doc:
            doc = copy.deepcopy(self.doc)
            del doc[key]
            with self.subTest(missing=key), self.assertRaises(reuse.Refusal):
                self.verify(doc)
        doc = {**self.doc, 'unexpected': True}
        with self.assertRaises(reuse.Refusal):
            self.verify(doc)

    def test_rejects_boolean_or_string_numeric_ids(self):
        for key in ['schema', 'repository_id', 'run_id', 'attempt', 'pr', 'shard', 'total']:
            for value in [True, str(self.doc[key]), float(self.doc[key]), None]:
                doc = {**self.doc, key: value}
                with self.subTest(field=key, value=value), self.assertRaises(reuse.Refusal):
                    self.verify(doc)

    def test_rejects_any_runtime_difference(self):
        for key in self.current['runtime']:
            doc = copy.deepcopy(self.doc)
            doc['runtime'][key] += '-different'
            with self.subTest(runtime=key), self.assertRaises(reuse.Refusal):
                self.verify(doc)
        for runtime in [{}, None, {**self.current['runtime'], 'extra': 'value'}]:
            doc = {**self.doc, 'runtime': runtime}
            with self.subTest(runtime=runtime), self.assertRaises(reuse.Refusal):
                self.verify(doc)

    def test_rejects_malformed_hashes_even_if_current_matches(self):
        for key in ['tree', 'public_digest']:
            for value in ['', 'z' * len(self.current[key]), 1]:
                doc = copy.deepcopy(self.doc)
                current = copy.deepcopy(self.current)
                doc[key] = current[key] = value
                with self.subTest(field=key, value=value), self.assertRaises(reuse.Refusal):
                    reuse.verify_evidence(doc, current, self.identity, 'iphone-webkit', 2, 3)

    def test_validation_evidence_has_its_own_project_and_single_shard(self):
        doc = {**self.doc, 'project': 'validate', 'shard': 1, 'total': 1}
        reuse.verify_evidence(doc, self.current, self.identity, 'validate', 1, 1)
        with self.assertRaises(reuse.Refusal):
            reuse.verify_evidence(self.doc, self.current, self.identity, 'validate', 1, 1)


class PublicationGateTests(unittest.TestCase):
    def test_fresh_success_and_explicit_verified_main_reuse_pass(self):
        self.assertTrue(reuse.gate('success', 'success', 'false', 'pull_request', 'refs/pull/27/merge', ''))
        self.assertTrue(reuse.gate('success', 'skipped', 'true', 'push', 'refs/heads/main', '23456'))

    def test_fresh_path_rejects_every_non_success_browser_result(self):
        for state in ['failure', 'cancelled', 'skipped', '', None]:
            with self.subTest(state=state):
                self.assertFalse(reuse.gate('success', state, 'false', 'push', 'refs/heads/main', ''))

    def test_reuse_cannot_mask_failed_or_cancelled_browser_or_validation(self):
        for state in ['success', 'failure', 'cancelled', '', None]:
            with self.subTest(browser=state):
                self.assertFalse(reuse.gate('success', state, 'true', 'push', 'refs/heads/main', '23456'))
        for state in ['failure', 'cancelled', 'skipped', '', None]:
            for reused, browser in [('true', 'skipped'), ('false', 'success')]:
                with self.subTest(validation=state, reused=reused):
                    self.assertFalse(reuse.gate(state, browser, reused, 'push', 'refs/heads/main', '23456'))

    def test_reuse_requires_main_push_and_positive_run_identifier(self):
        for event, ref, run in [
            ('pull_request', 'refs/heads/main', '23456'),
            ('workflow_dispatch', 'refs/heads/main', '23456'),
            ('push', 'refs/heads/feature', '23456'),
            *[('push', 'refs/heads/main', run) for run in ['', '0', '-1', '1.5', 'true', None]],
        ]:
            with self.subTest(event=event, ref=ref, run=run):
                self.assertFalse(reuse.gate('success', 'skipped', 'true', event, ref, run))

    def test_unknown_or_empty_reuse_output_never_passes(self):
        for reuse_flag in ['', None, True, False, 'TRUE', 'yes']:
            for browser in ['success', 'skipped']:
                with self.subTest(reuse=reuse_flag, browser=browser):
                    self.assertFalse(reuse.gate('success', browser, reuse_flag, 'push', 'refs/heads/main', '23456'))


class FakeAPI:
    def __init__(self, routes, documents):
        self.routes = routes
        self.documents = documents

    def get(self, path):
        result = self.routes[path]
        if isinstance(result, Exception):
            raise result
        return copy.deepcopy(result)

    def artifact(self, metadata):
        return copy.deepcopy(self.documents[metadata['id']])


class CandidateTests(unittest.TestCase):
    def setUp(self):
        EvidenceTests.setUp(self)
        self.current['checkout'] = '9' * 40
        self.context = {'repository': reuse.REPOSITORY, 'repository_id': 12345,
                        'event': 'push', 'ref': 'refs/heads/main', 'attempt': 1}
        self.now = datetime(2026, 10, 12, 12, tzinfo=timezone.utc)
        self.configuration = {'matrix': [
            ('desktop-chromium', 1, 1), ('desktop-webkit', 1, 3),
            ('desktop-webkit', 2, 3), ('desktop-webkit', 3, 3),
            ('iphone-webkit', 1, 3), ('iphone-webkit', 2, 3),
            ('iphone-webkit', 3, 3), ('android-chromium', 1, 1), ('iphone-nojs', 1, 1),
        ], 'browser_image': self.current['runtime']['browser_image']}
        repo = {'id': 12345, 'full_name': reuse.REPOSITORY}
        pr = {'number': 27, 'state': 'closed', 'merged': True,
              'merge_commit_sha': self.current['checkout'], 'merged_at': '2026-10-12T11:50:00Z',
              'base': {'ref': 'main', 'repo': repo},
              'head': {'sha': self.identity['head'], 'repo': copy.deepcopy(repo)}}
        run = {'id': 23456, 'workflow_id': 987, 'path': reuse.WORKFLOW, 'event': 'pull_request',
               'head_sha': self.identity['head'], 'repository': repo, 'head_repository': repo,
               'status': 'completed', 'conclusion': 'success', 'run_attempt': 1,
               'run_started_at': '2026-10-12T11:00:00Z', 'updated_at': '2026-10-12T11:30:00Z'}
        jobs = []
        def job(name, steps):
            jobs.append({'name': name, 'status': 'completed', 'conclusion': 'success',
                         'steps': [{'name': step, 'status': 'completed', 'conclusion': 'success', 'number': n}
                                   for n, step in enumerate(steps, 1)]})
        job('validate', ['Validate and stage only public assets', 'Capture validation evidence', 'Save validation evidence'])
        job('browser-tests', ['Require complete browser coverage'])
        for project, shard, total in self.configuration['matrix']:
            job(f'browser-shards ({project}, {shard}, {total})',
                ['Capture browser inputs', 'Test navigation and visitor journeys', 'Seal browser evidence', 'Save browser evidence'])
        artifacts, documents = [], {}
        for n, (project, shard, total) in enumerate([('validate', 1, 1)] + self.configuration['matrix'], 1):
            artifacts.append({'id': n, 'name': f'pr-evidence-23456-1-{project}-{shard}',
                              'expired': False, 'size_in_bytes': 500, 'expires_at': '2026-10-19T12:00:00Z',
                              'created_at': '2026-10-12T11:20:00Z',
                              'workflow_run': {'id': 23456, 'head_sha': self.identity['head'],
                                               'repository_id': 12345, 'head_repository_id': 12345}})
            documents[n] = {**copy.deepcopy(self.doc), 'project': project, 'shard': shard, 'total': total}
        self.routes = {
            '/commits/' + self.current['checkout'] + '/pulls?per_page=100': [pr],
            '/pulls/27': pr,
            '/actions/workflows/pages.yml': {'id': 987, 'path': reuse.WORKFLOW, 'state': 'active'},
            '/actions/workflows/987/runs?event=pull_request&head_sha=' + self.identity['head'] + '&per_page=100': {'workflow_runs': [run]},
            '/actions/runs/23456': run,
            '/actions/runs/23456/attempts/1/jobs?per_page=100': {'jobs': jobs, 'total_count': len(jobs)},
            '/actions/runs/23456/artifacts?per_page=100': {'artifacts': artifacts, 'total_count': len(artifacts)},
            '/git/commits/' + self.identity['checkout']: {'sha': self.identity['checkout'],
                'tree': {'sha': self.current['tree']},
                'parents': [{'sha': self.identity['base']}, {'sha': self.identity['head']}]},
        }
        self.api = FakeAPI(self.routes, documents)

    def result(self):
        return reuse.decision(self.api, self.current, self.context, self.now, self.configuration)

    def fallback(self):
        result = self.result()
        self.assertEqual(result['reuse'], 'false')
        self.assertEqual(result['proof_run'], '')

    def test_complete_trusted_attempt_is_reused(self):
        self.assertEqual(self.result()['reuse'], 'true')
        self.assertEqual(self.result()['proof_run'], '23456')

    def test_api_failure_falls_back_without_leaking_response(self):
        self.routes['/pulls/27'] = RuntimeError('secret signed URL')
        self.fallback()
        self.assertNotIn('secret', self.result()['reason'])

    def test_direct_push_fork_or_unmerged_pr_falls_back(self):
        original = copy.deepcopy(self.routes)
        for change in ['direct', 'fork', 'unmerged', 'wrongbase']:
            self.api.routes = self.routes = copy.deepcopy(original)
            if change == 'direct':
                self.routes['/commits/' + self.current['checkout'] + '/pulls?per_page=100'] = []
            elif change == 'fork':
                self.routes['/pulls/27']['head']['repo']['id'] = 999
            elif change == 'unmerged':
                self.routes['/pulls/27']['merged'] = False
            else:
                self.routes['/pulls/27']['base']['ref'] = 'other'
            with self.subTest(change=change):
                self.fallback()

    def test_reruns_and_unsuccessful_latest_run_fall_back(self):
        original = copy.deepcopy(self.routes['/actions/runs/23456'])
        for field, value in [('run_attempt', 2), ('status', 'in_progress'), ('conclusion', 'cancelled'),
                             ('event', 'workflow_dispatch'), ('workflow_id', 999), ('head_sha', '7' * 40)]:
            self.routes['/actions/runs/23456'] = {**original, field: value}
            with self.subTest(field=field, value=value):
                self.fallback()
        self.routes['/actions/runs/23456'] = original
        self.context['attempt'] = 2
        self.fallback()

    def test_stale_evidence_falls_back(self):
        self.now += timedelta(hours=6)
        self.fallback()

    def test_london_midnight_invalidates_recent_evidence(self):
        # UTC remains on 12 October; London passes midnight during BST.
        self.now = datetime(2026, 10, 12, 23, 10, tzinfo=timezone.utc)
        run = self.routes['/actions/runs/23456']
        run['run_started_at'] = '2026-10-12T22:20:00Z'
        run['updated_at'] = '2026-10-12T22:40:00Z'
        self.routes['/pulls/27']['merged_at'] = '2026-10-12T23:00:00Z'
        for artifact in self.routes['/actions/runs/23456/artifacts?per_page=100']['artifacts']:
            artifact['created_at'] = '2026-10-12T22:30:00Z'
        self.fallback()
        self.assertIn('London date', self.result()['reason'])

    def test_missing_duplicate_skipped_cancelled_and_out_of_order_jobs_fail(self):
        route = '/actions/runs/23456/attempts/1/jobs?per_page=100'
        original = copy.deepcopy(self.routes[route])
        for change in ['missing', 'duplicate', 'skipped', 'cancelled', 'step', 'order', 'pagination']:
            response = copy.deepcopy(original)
            jobs = response['jobs']
            if change == 'missing': jobs.pop()
            elif change == 'duplicate': jobs.append(copy.deepcopy(jobs[-1]))
            elif change in ['skipped', 'cancelled']: jobs[-1]['conclusion'] = change
            elif change == 'step': jobs[-1]['steps'][1]['conclusion'] = 'skipped'
            elif change == 'order': jobs[-1]['steps'][2]['number'] = 1
            response['total_count'] = len(jobs) + (1 if change == 'pagination' else 0)
            self.routes[route] = response
            with self.subTest(change=change): self.fallback()

    def test_missing_expired_wrong_run_and_oversized_artifacts_fail(self):
        route = '/actions/runs/23456/artifacts?per_page=100'
        original = copy.deepcopy(self.routes[route])
        for change in ['missing', 'duplicate', 'expired', 'wrongrun', 'oversized']:
            response = copy.deepcopy(original)
            artifacts = response['artifacts']
            if change == 'missing': artifacts.pop()
            elif change == 'duplicate': artifacts.append(copy.deepcopy(artifacts[-1]))
            elif change == 'expired': artifacts[-1]['expired'] = True
            elif change == 'wrongrun': artifacts[-1]['workflow_run']['id'] = 23455
            else: artifacts[-1]['size_in_bytes'] = 65537
            response['total_count'] = len(artifacts)
            self.routes[route] = response
            with self.subTest(change=change): self.fallback()

    def test_actual_git_tree_and_merge_parents_must_match(self):
        route = '/git/commits/' + self.identity['checkout']
        original = copy.deepcopy(self.routes[route])
        for change in ['tree', 'head', 'base', 'oneparent']:
            commit = copy.deepcopy(original)
            if change == 'tree': commit['tree']['sha'] = '7' * 40
            elif change == 'head': commit['parents'][1]['sha'] = '7' * 40
            elif change == 'base': commit['parents'][0]['sha'] = '7' * 40
            else: commit['parents'].pop()
            self.routes[route] = commit
            with self.subTest(change=change): self.fallback()

    def test_single_shard_runtime_or_tree_mismatch_fails_entire_reuse(self):
        original = copy.deepcopy(self.api.documents)
        for change in ['runtime', 'tree', 'attempt', 'public_digest']:
            self.api.documents = copy.deepcopy(original)
            doc = self.api.documents[5]
            if change == 'runtime': doc['runtime']['node'] = 'v99.0.0'
            elif change == 'attempt': doc['attempt'] = 2
            else: doc[change] = '7' * len(doc[change])
            with self.subTest(change=change): self.fallback()


class BoundedResponse:
    def __init__(self, body):
        self.body = body
        self.read_limits = []

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self, limit):
        self.read_limits.append(limit)
        return self.body[:limit]


class TransportTests(unittest.TestCase):
    storage = 'https://artifacts.blob.core.windows.net/container/file?sig=fictional'

    def setUp(self):
        self.api = reuse.API('fictional-test-token')
        self.api.opener = Mock()
        self.raw, self.digest = archive('{"schema":1}')
        self.metadata = {'id': 42, 'digest': self.digest}

    def redirect(self, destination=None, status=302):
        return urllib.error.HTTPError('https://api.github.com/artifact', status, 'redirect',
                                      {'Location': destination or self.storage}, None)

    def test_token_only_reaches_authenticated_github_request(self):
        response = BoundedResponse(self.raw)
        self.api.opener.open.side_effect = [self.redirect(), response]
        self.assertEqual(self.api.artifact(self.metadata), {'schema': 1})
        first, second = [call.args[0] for call in self.api.opener.open.call_args_list]
        self.assertEqual(first.full_url, 'https://api.github.com/repos/' + reuse.REPOSITORY + '/actions/artifacts/42/zip')
        self.assertEqual(first.get_header('Authorization'), 'Bearer fictional-test-token')
        self.assertEqual(first.get_header('X-github-api-version'), '2022-11-28')
        self.assertEqual(second.full_url, self.storage)
        self.assertIsNone(second.get_header('Authorization'))
        self.assertNotIn('fictional-test-token', str(second.header_items()))
        self.assertEqual(response.read_limits, [reuse.MAX_ARCHIVE + 1])
        for call in self.api.opener.open.call_args_list:
            self.assertGreater(call.kwargs['timeout'], 0)
            self.assertLessEqual(call.kwargs['timeout'], 8)

    def test_foreign_insecure_or_credentialed_storage_is_rejected_before_download(self):
        for destination in ['https://evil.example/file', 'http://artifacts.blob.core.windows.net/file',
                            'https://artifacts.blob.core.windows.net.evil.example/file',
                            'https://user:password@artifacts.blob.core.windows.net/file',
                            'https://artifacts.blob.core.windows.net:444/file', '//artifacts.blob.core.windows.net/file']:
            self.api.opener.open.reset_mock()
            self.api.opener.open.side_effect = [self.redirect(destination)]
            with self.subTest(destination=destination), self.assertRaises(reuse.Refusal):
                self.api.artifact(self.metadata)
            self.assertEqual(self.api.opener.open.call_count, 1)

    def test_storage_redirect_cannot_trigger_a_third_request(self):
        self.api.opener.open.side_effect = [self.redirect(), self.redirect('https://evil.example/next')]
        with self.assertRaises(urllib.error.HTTPError):
            self.api.artifact(self.metadata)
        self.assertEqual(self.api.opener.open.call_count, 2)
        self.assertIsNone(self.api.opener.open.call_args_list[1].args[0].get_header('Authorization'))
        handler = reuse.NoRedirect()
        self.assertIsNone(handler.redirect_request(None, None, 302, '', {}, 'https://evil.example/next'))

    def test_wrong_initial_status_or_direct_download_is_refused(self):
        for outcome in [self.redirect(status=301), self.redirect(status=403), BoundedResponse(self.raw)]:
            self.api.opener.open.reset_mock()
            self.api.opener.open.side_effect = [outcome]
            with self.subTest(outcome=outcome), self.assertRaises(reuse.Refusal):
                self.api.artifact(self.metadata)
            self.assertEqual(self.api.opener.open.call_count, 1)

    def test_oversized_downloads_and_api_responses_are_bounded(self):
        response = BoundedResponse(b'x' * (reuse.MAX_ARCHIVE + 10))
        self.api.opener.open.side_effect = [self.redirect(), response]
        with self.assertRaises(reuse.Refusal):
            self.api.artifact(self.metadata)
        self.assertEqual(response.read_limits, [reuse.MAX_ARCHIVE + 1])
        response = BoundedResponse(b'x' * (1024 * 1024 + 10))
        self.api.opener.open.side_effect = [response]
        with self.assertRaises(reuse.Refusal):
            self.api.get('/actions/runs/23456')
        self.assertEqual(response.read_limits, [1024 * 1024 + 1])

    def test_expired_lookup_budget_prevents_network_call(self):
        self.api.deadline = 0
        with self.assertRaises(TimeoutError):
            self.api.get('/actions/runs/23456')
        self.api.opener.open.assert_not_called()


if __name__ == '__main__':
    unittest.main()
