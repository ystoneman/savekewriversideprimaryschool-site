"""Verify recent PR browser evidence; any uncertainty falls back to fresh tests.

Artifacts are bounded JSON data, never executable code or deployment packages.
GitHub API provenance plus the exact tracked tree, public bytes and runtime bind
all evidence to one complete successful PR attempt.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from zoneinfo import ZoneInfo
from check_site import PUBLIC_FILES

ROOT = Path(__file__).resolve().parents[2]
REPOSITORY = 'ystoneman/savekewriversideprimaryschool-site'
WORKFLOW = '.github/workflows/pages.yml'
MAX_ARCHIVE = 64 * 1024
MAX_DOCUMENT = 16 * 1024
MAX_AGE = timedelta(hours=6)
LONDON = ZoneInfo('Europe/London')


class Refusal(ValueError):
    pass


def require(condition, reason):
    if not condition:
        raise Refusal(reason)


def sha(value, length=40):
    return isinstance(value, str) and re.fullmatch('[0-9a-f]{' + str(length) + '}', value) is not None


def positive(value):
    return type(value) is int and value > 0


def utc(value):
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(result.tzinfo is not None, 'Timestamp has no timezone')
    return result.astimezone(timezone.utc)


def gate(validation, browser, reuse, event, ref, proof_run):
    if validation != 'success':
        return False
    if reuse == 'true':
        return (event == 'push' and ref == 'refs/heads/main' and browser == 'skipped'
                and isinstance(proof_run, str) and re.fullmatch('[1-9][0-9]*', proof_run) is not None)
    return reuse == 'false' and browser == 'success'


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, 'Duplicate evidence JSON key')
        result[key] = value
    return result


def parse_archive(raw, digest):
    require(isinstance(raw, bytes) and len(raw) <= MAX_ARCHIVE, 'Evidence archive exceeds limit')
    require(isinstance(digest, str) and re.fullmatch('sha256:[0-9a-f]{64}', digest) is not None,
            'Missing artifact digest')
    require('sha256:' + hashlib.sha256(raw).hexdigest() == digest, 'Artifact digest differs')
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            entries = archive.infolist()
            require(len(entries) == 1, 'Evidence archive must contain one file')
            entry = entries[0]
            require(entry.filename == 'evidence.json' and not entry.is_dir(), 'Unexpected evidence member')
            require(entry.file_size <= MAX_DOCUMENT and not (entry.flag_bits & 1), 'Invalid evidence size or encryption')
            require((entry.external_attr >> 16) & 0o170000 != 0o120000, 'Evidence cannot be a symlink')
            with archive.open(entry) as stream:
                body = stream.read(MAX_DOCUMENT + 1)
            require(len(body) <= MAX_DOCUMENT, 'Evidence document exceeds limit')
        document = json.loads(body.decode('utf-8'), object_pairs_hook=unique_object)
        require(type(document) is dict, 'Evidence must be a JSON object')
        return document
    except (zipfile.BadZipFile, UnicodeError, json.JSONDecodeError, RuntimeError, NotImplementedError) as error:
        raise Refusal('Invalid evidence archive') from error


def policy(root=ROOT):
    workflow = (root / WORKFLOW).read_text()
    block = workflow.split('      matrix:\n', 1)[1].split('    steps:\n', 1)[0]
    rows = re.findall(r'^          - \{ project: ([\w-]+), shard: (\d+), total: (\d+) \}$', block, re.M)
    require(rows and len(rows) == block.count('          - '), 'Unrecognized browser matrix')
    matrix = [(project, int(shard), int(total)) for project, shard, total in rows]
    projects = re.findall(r"\{ name: '([\w-]+)'", (root / 'playwright.config.js').read_text())
    require(set(projects) == {p for p, _, _ in matrix}, 'Incomplete browser projects')
    for project in projects:
        group = [(s, n) for p, s, n in matrix if p == project]
        totals = {n for _, n in group}
        require(len(totals) == 1, 'Inconsistent shard totals')
        total = totals.pop()
        require(total > 0 and sorted(s for s, _ in group) == list(range(1, total + 1)), 'Incomplete or duplicate shards')
    images = re.findall(r'^      image: (\S+@sha256:[0-9a-f]{64})$', workflow, re.M)
    require(len(images) == 1, 'Browser image must have one immutable digest')
    return {'matrix': matrix, 'browser_image': images[0]}


def git(*args, root=ROOT):
    return subprocess.check_output(['git', *args], cwd=root, text=True, timeout=15).strip()


def public_digest(folder):
    files = {}
    for name in sorted(PUBLIC_FILES):
        path = folder / name
        require(path.is_file() and not path.is_symlink(), 'Missing or linked public file')
        files[name] = hashlib.sha256(path.read_bytes()).hexdigest()
    return hashlib.sha256(json.dumps(files, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def snapshot(root=ROOT, site=None):
    require(not git('status', '--porcelain', '--untracked-files=no', root=root), 'Tracked files changed during checking')
    checkout = git('rev-parse', 'HEAD', root=root)
    require(checkout == os.environ.get('GITHUB_SHA'), 'Checkout differs from workflow revision')
    runtime = json.loads(subprocess.check_output(
        ['node', '-p', 'JSON.stringify({node:process.version,platform:process.platform,arch:process.arch})'],
        cwd=root, text=True, timeout=10))
    runtime['browser_image'] = policy(root)['browser_image']
    digest = public_digest(root)
    if site is not None:
        actual = {p.relative_to(site).as_posix() for p in site.rglob('*') if p.is_file()}
        require(actual == set(PUBLIC_FILES) and public_digest(site) == digest, 'Staged public artifact differs')
    return {'checkout': checkout, 'tree': git('rev-parse', 'HEAD^{tree}', root=root),
            'public_digest': digest, 'runtime': runtime}


def evidence(project, shard, total, site=None):
    require(os.environ.get('GITHUB_EVENT_NAME') == 'pull_request', 'Evidence must come from a PR')
    require(os.environ.get('GITHUB_REPOSITORY') == REPOSITORY, 'Unexpected evidence repository')
    event = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
    pr = event['pull_request']
    data = {'schema': 1, 'repository': REPOSITORY, 'repository_id': int(os.environ['GITHUB_REPOSITORY_ID']),
            'run_id': int(os.environ['GITHUB_RUN_ID']), 'attempt': int(os.environ['GITHUB_RUN_ATTEMPT']),
            'pr': event['number'], 'head': pr['head']['sha'], 'base': pr['base']['sha'],
            'project': project, 'shard': shard, 'total': total}
    data.update(snapshot(site=site))
    return data


def verify_evidence(document, current, identity, project, shard, total):
    expected = {'schema': 1, 'repository': REPOSITORY, **identity,
                'tree': current['tree'], 'public_digest': current['public_digest'], 'runtime': current['runtime'],
                'project': project, 'shard': shard, 'total': total}
    require(type(document) is dict and set(document) == set(expected), 'Evidence fields differ')
    for key in ['schema', 'repository_id', 'run_id', 'attempt', 'pr', 'shard', 'total']:
        require(positive(document[key]), 'Invalid numeric evidence identity')
    for key in ['head', 'base', 'checkout', 'tree']:
        require(sha(document[key]), 'Invalid evidence revision')
    require(sha(document['public_digest'], 64), 'Invalid public artifact digest')
    require(type(document['runtime']) is dict and all(type(v) is str for v in document['runtime'].values()),
            'Invalid runtime evidence')
    require(document == expected, 'Tested contents, runtime or provenance differ')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class API:
    def __init__(self, token):
        self.token = token
        self.deadline = time.monotonic() + 80
        self.opener = urllib.request.build_opener(NoRedirect)

    def timeout(self):
        remaining = self.deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError('Evidence lookup deadline reached')
        return min(8, remaining)

    def request(self, path):
        require(path.startswith('/') and not path.startswith('//'), 'Invalid API path')
        return urllib.request.Request('https://api.github.com/repos/' + REPOSITORY + path,
            headers={'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10',
                     'Authorization': 'Bearer ' + self.token, 'User-Agent': 'Kew-PR-evidence'})

    def get(self, path):
        with self.opener.open(self.request(path), timeout=self.timeout()) as response:
            raw = response.read(1024 * 1024 + 1)
        require(len(raw) <= 1024 * 1024, 'API response exceeds limit')
        return json.loads(raw)

    def artifact(self, metadata):
        try:
            self.opener.open(self.request('/actions/artifacts/' + str(metadata['id']) + '/zip'), timeout=self.timeout())
            raise Refusal('Expected a signed artifact redirect')
        except urllib.error.HTTPError as response:
            require(response.code == 302, 'Artifact download unavailable')
            location = response.headers.get('Location', '')
        url = urllib.parse.urlsplit(location)
        require(url.scheme == 'https' and url.hostname is not None and url.username is None and url.password is None
                and url.port in (None, 443) and any(url.hostname.endswith(suffix) for suffix in
                ['.blob.core.windows.net', '.actions.githubusercontent.com', '.githubusercontent.com']),
                'Unexpected artifact storage origin')
        # New request and no redirects: never forward the API token to storage.
        with self.opener.open(urllib.request.Request(location, headers={'User-Agent': 'Kew-PR-evidence'}),
                              timeout=self.timeout()) as response:
            raw = response.read(MAX_ARCHIVE + 1)
        return parse_archive(raw, metadata.get('digest'))


def successful_job(jobs, name, steps):
    matches = [j for j in jobs if j.get('name') == name]
    require(len(matches) == 1, 'Missing or duplicate required job')
    job = matches[0]
    require(job.get('status') == 'completed' and job.get('conclusion') == 'success', 'Required job did not pass')
    numbers = []
    for step in steps:
        matches = [s for s in job.get('steps', []) if s.get('name') == step]
        require(len(matches) == 1 and matches[0].get('status') == 'completed'
                and matches[0].get('conclusion') == 'success', 'Required evidence or test step did not pass')
        numbers.append(matches[0]['number'])
    require(numbers == sorted(set(numbers)), 'Evidence and test steps ran out of order')


def verify_candidate(api, current, context, now, configuration):
    require(context['repository'] == REPOSITORY and positive(context['repository_id']), 'Unexpected current repository')
    require(context['event'] == 'push' and context['ref'] == 'refs/heads/main', 'Only main pushes can reuse tests')
    require(context['attempt'] == 1, 'Rerunning main requests fresh checks')
    require(sha(current['checkout']), 'Invalid current checkout')
    candidates = api.get('/commits/' + current['checkout'] + '/pulls?per_page=100')
    candidates = [p for p in candidates if p.get('merge_commit_sha') == current['checkout'] and p.get('merged_at')]
    require(len(candidates) == 1 and positive(candidates[0].get('number')), 'No unique merged PR for this commit')
    pr = api.get('/pulls/' + str(candidates[0]['number']))
    require(pr.get('state') == 'closed' and pr.get('merged') is True and pr.get('merge_commit_sha') == current['checkout'],
            'PR is not the merged release')
    require(pr['base']['ref'] == 'main' and pr['base']['repo']['id'] == context['repository_id']
            and pr['base']['repo']['full_name'] == REPOSITORY and pr['head']['repo']['id'] == context['repository_id']
            and pr['head']['repo']['full_name'] == REPOSITORY, 'Fork or other target PR requires fresh checks')
    head = pr['head']['sha']
    require(sha(head), 'Invalid PR head')
    workflow = api.get('/actions/workflows/pages.yml')
    require(workflow.get('path') == WORKFLOW and workflow.get('state') == 'active' and positive(workflow.get('id')),
            'Unexpected workflow identity')
    runs = api.get('/actions/workflows/' + str(workflow['id']) + '/runs?event=pull_request&head_sha=' + head + '&per_page=100')['workflow_runs']
    require(bool(runs), 'No PR run available')
    latest = max(runs, key=lambda r: r['id'])
    require(positive(latest['id']), 'Invalid PR run identity')
    run = api.get('/actions/runs/' + str(latest['id']))
    require(run.get('id') == latest['id'] and run.get('workflow_id') == workflow['id'] and run.get('path') == WORKFLOW
            and run.get('event') == 'pull_request' and run.get('head_sha') == head, 'Run provenance differs')
    require(run['repository']['id'] == context['repository_id'] and run['repository']['full_name'] == REPOSITORY
            and run['head_repository']['id'] == context['repository_id'] and run['head_repository']['full_name'] == REPOSITORY,
            'Run repository differs')
    require(run.get('status') == 'completed' and run.get('conclusion') == 'success', 'Latest PR run did not pass')
    # Mixed partial reruns have ambiguous inherited jobs/artifacts: always retest.
    require(run.get('run_attempt') == 1, 'PR reruns require fresh checks')
    started, finished, merged = utc(run['run_started_at']), utc(run['updated_at']), utc(pr['merged_at'])
    require(timedelta(0) <= now - started <= MAX_AGE and started <= finished <= merged <= now,
            'PR evidence is stale, unfinished or newer than the merge')
    require(started.astimezone(LONDON).date() == now.astimezone(LONDON).date(), 'London date changed since testing')
    prefix = '/actions/runs/' + str(run['id'])
    response = api.get(prefix + '/attempts/1/jobs?per_page=100')
    jobs = response['jobs']
    require(response.get('total_count') == len(jobs) and len(jobs) <= 100, 'Incomplete attempt job listing')
    successful_job(jobs, 'validate', ['Validate and stage only public assets', 'Capture validation evidence', 'Save validation evidence'])
    successful_job(jobs, 'browser-tests', ['Require complete browser coverage'])
    matrix = configuration['matrix']
    for project, shard, total in matrix:
        successful_job(jobs, f'browser-shards ({project}, {shard}, {total})',
                       ['Capture browser inputs', 'Test navigation and visitor journeys', 'Seal browser evidence', 'Save browser evidence'])
    response = api.get(prefix + '/artifacts?per_page=100')
    artifacts = response['artifacts']
    require(response.get('total_count') == len(artifacts) and len(artifacts) <= 100, 'Incomplete artifact listing')
    expected = [('validate', 1, 1)] + matrix
    selected = []
    for project, shard, total in expected:
        name = f'pr-evidence-{run["id"]}-1-{project}-{shard}'
        matches = [a for a in artifacts if a.get('name') == name]
        require(len(matches) == 1, 'Missing or duplicate evidence artifact')
        artifact = matches[0]
        require(positive(artifact.get('id')) and artifact.get('expired') is False
                and type(artifact.get('size_in_bytes')) is int and 0 < artifact['size_in_bytes'] <= MAX_ARCHIVE
                and utc(artifact['expires_at']) > now and started <= utc(artifact['created_at']) <= finished,
                'Expired or invalid evidence artifact')
        source = artifact['workflow_run']
        require(source.get('id') == run['id'] and source.get('head_sha') == head
                and source.get('repository_id') == context['repository_id']
                and source.get('head_repository_id') == context['repository_id'], 'Artifact belongs to another run')
        selected.append(artifact)
    with ThreadPoolExecutor(max_workers=4) as pool:
        documents = list(pool.map(api.artifact, selected))
    checkout = documents[0].get('checkout')
    require(sha(checkout), 'Invalid tested checkout')
    tested = api.get('/git/commits/' + checkout)
    require(tested.get('sha') == checkout and tested['tree']['sha'] == current['tree'], 'Tested Git tree differs')
    parents = tested.get('parents', [])
    require(len(parents) == 2 and parents[1]['sha'] == head and sha(parents[0]['sha']), 'Tested checkout is not this PR merge')
    identity = {'repository_id': context['repository_id'], 'run_id': run['id'], 'attempt': 1,
                'pr': pr['number'], 'head': head, 'base': parents[0]['sha'], 'checkout': checkout}
    for document, (project, shard, total) in zip(documents, expected):
        verify_evidence(document, current, identity, project, shard, total)
    return {'reuse': 'true', 'proof_run': str(run['id']), 'reason': 'Verified complete PR evidence for identical contents and runtime'}


def decision(api, current, context, now, configuration):
    try:
        return verify_candidate(api, current, context, now, configuration)
    except Refusal as error:
        return {'reuse': 'false', 'proof_run': '', 'reason': str(error)}
    except Exception as error:
        # API errors can contain signed URLs: print only their type, never details.
        return {'reuse': 'false', 'proof_run': '', 'reason': 'Evidence unavailable (' + type(error).__name__ + ')'}


def write_document(path, document):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(document, sort_keys=True) + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['capture', 'seal', 'probe', 'gate'])
    parser.add_argument('--project', default='validate')
    parser.add_argument('--shard', type=int, default=1)
    parser.add_argument('--total', type=int, default=1)
    parser.add_argument('--site', type=Path)
    parser.add_argument('--out', type=Path)
    parser.add_argument('--before', type=Path)
    args = parser.parse_args()
    if args.operation == 'gate':
        require(gate(*(os.environ.get(k, '') for k in ['VALIDATION_RESULT', 'BROWSER_RESULT', 'REUSE',
                                                     'GITHUB_EVENT_NAME', 'GITHUB_REF', 'PROOF_RUN'])),
                'Browser coverage gate failed')
    elif args.operation in ['capture', 'seal']:
        document = evidence(args.project, args.shard, args.total, args.site)
        if args.operation == 'seal':
            require(json.loads(args.before.read_text()) == document, 'Browser inputs changed while tests ran')
        write_document(args.out, document)
    else:
        result = {'reuse': 'false', 'proof_run': '', 'reason': 'PRs always run the complete browser suite'}
        if os.environ.get('GITHUB_EVENT_NAME') == 'push':
            try:
                require(args.site is not None, 'Main must stage its own public artifact')
                current = snapshot(site=args.site)
                context = {'repository': os.environ.get('GITHUB_REPOSITORY'),
                           'repository_id': int(os.environ['GITHUB_REPOSITORY_ID']),
                           'event': os.environ['GITHUB_EVENT_NAME'], 'ref': os.environ['GITHUB_REF'],
                           'attempt': int(os.environ['GITHUB_RUN_ATTEMPT'])}
                result = decision(API(os.environ['GH_TOKEN']), current, context, datetime.now(timezone.utc), policy())
            except Exception as error:
                result = {'reuse': 'false', 'proof_run': '', 'reason': 'Local evidence unavailable (' + type(error).__name__ + ')'}
        with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
            output.write('reuse=' + result['reuse'] + '\nproof_run=' + result['proof_run'] + '\n')
        summary = 'Browser checks: ' + ('reuse' if result['reuse'] == 'true' else 'full suite') + '. ' + result['reason']
        if result['proof_run']:
            summary += '. Verified run: https://github.com/' + REPOSITORY + '/actions/runs/' + result['proof_run']
        print(summary)
        if os.environ.get('GITHUB_STEP_SUMMARY'):
            with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as output:
                output.write(summary + '\n')


if __name__ == '__main__':
    main()
