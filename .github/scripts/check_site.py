"""Validate public files before committing or deploying. Python standard library only."""
import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import shutil
import subprocess
from urllib.parse import urlsplit
from public_data import validate_board

ROOT = Path(__file__).resolve().parents[2]
PUBLIC_FILES = frozenset('''
images/school-discovery-480.jpg images/school-discovery-960.jpg images/school-project-480.jpg images/school-project-960.jpg
rally.html rally.css rally-6-october.ics
fundraising-trustees.html fundraising-admin.html fundraising-briefs.css
visit/index.html qr/kew-riverside-website-qr.png qr/kew-riverside-website-qr.svg qr/kew-riverside-visit-qr.png qr/kew-riverside-visit-qr.svg qr/savekewriverside-home-qr.png qr/savekewriverside-home-qr.svg qr/savekewriverside-visit-qr.png qr/savekewriverside-visit-qr.svg
theme.css theme.js
analytics.js analytics.css analytics-config.json
videos.html videos.css videos.js evidence.html options.html options.css options.js homepage.css homepage.js
lessons.html lessons-sources.html lessons-data.json lessons.css lessons.js lessons-report.pdf lessons-01-where-proposals-stopped.png lessons-01-where-proposals-stopped.svg lessons-02-recorded-reasons-matrix.png lessons-02-recorded-reasons-matrix.svg lessons-03-isle-of-wight-cohort.png lessons-03-isle-of-wight-cohort.svg lessons-04-fletching-funding-and-budget.png lessons-04-fletching-funding-and-budget.svg lessons-05-reprieve-versus-recovery.png lessons-05-reprieve-versus-recovery.svg lessons-06-where-to-focus-effort.png lessons-06-where-to-focus-effort.svg lessons-07-efforts-that-did-not-prevent-closure.png lessons-07-efforts-that-did-not-prevent-closure.svg lessons-08-petitions-and-outcomes.png lessons-08-petitions-and-outcomes.svg
meeting.css meeting.js faq.html discovery.css discovery.js research-discovery.css about.html app.js applications.csv community.css corrections.html
corrections.js favicon.svg feedback.css feedback.html feedback.js index.html insights.css orientation.css navigation.js participation.css parent-plan.css button-motion.css enrolment.css
letters.html letters.js letters.json privacy.html proposal.css proposal.html
kew-budget-summary-2026.pdf response-checklist.md response-checklist.pdf sources.csv sources.json styles.css
suggestions.json supporters.html supporters.js supporters.json
attainment-data.json attainment.csv case-evidence-data.json case-evidence.csv
understand.html understand.css understand.js understand-data.json richmond-schools.csv
voice.css voice.js contribute.css sent.html sent.js private-form.js respond-reminder.ics
og-home.png og-letters.png og-ideas.png og-videos.png
og-fundraising-trustees-v1.png og-fundraising-admin-v1.png
'''.split())
MAINTENANCE_FILES = frozenset('''
.github/scripts/compatibility-assets.json .github/scripts/compatibility_release.py .github/scripts/test_compatibility_release.py CONSOLIDATION.md
tests/review-evidence/research-update-mobile.png tests/review-evidence/research-update-desktop.png
tests/browser/research-update.spec.js
.github/scripts/build_old_site_redirect.py .github/scripts/old_site_redirect.js .github/scripts/old_site_redirect.css .github/scripts/test_old_site_redirect.py tests/browser/old-site-redirect.spec.js
tests/browser/fundraising-briefs.spec.js
.github/scripts/build_navigation.py tests/browser/orientation.spec.js
tests/browser/clarity.spec.js tests/browser/rally.spec.js
tests/browser/qr.spec.js
tests/browser/theme.spec.js
VIDEO-PERMISSIONS.md CONTRIBUTING.md .github/CODEOWNERS .github/pull_request_template.md .github/branch-protection.json
.agents/skills/kew-campaign-review/SKILL.md .agents/skills/kew-campaign-review/agents/openai.yaml
.agents/skills/kew-ux-review/SKILL.md .agents/skills/kew-ux-review/agents/openai.yaml
.agents/skills/kew-evidence-review/SKILL.md .agents/skills/kew-evidence-review/agents/openai.yaml
ANALYTICS.md tests/browser/analytics.spec.js
ENROLMENT-OUTREACH-BRIEF.md .github/scripts/build_learning.py .github/scripts/test_learning.py .github/scripts/build_case_evidence.py .github/scripts/test_case_evidence.py .github/scripts/build_checklist.py .github/scripts/build_sources.py tests/browser/sofiya.spec.js
tests/browser/videos.spec.js tests/browser/top-journeys.spec.js tests/browser/homepage.spec.js tests/browser/harness.spec.js
.github/scripts/build_lessons.py .github/scripts/test_lessons.py tests/browser/lessons.spec.js
.nojekyll .gitignore .gitattributes README.md CODEX-HANDOFF.md .github/workflows/pages.yml
.github/scripts/check_site.py .github/scripts/public_data.py
.github/scripts/test_security.py .github/scripts/test_site_structure.py
AGENTS.md CLAUDE.md TESTING.md CHANGELOG.md UX-DESIGN-DECISIONS.md package.json package-lock.json playwright.config.js
tests/browser/fixtures.js tests/browser/server.js tests/browser/mobile.spec.js
tests/browser/desktop.spec.js tests/browser/no-javascript.spec.js
tests/browser/contributions.spec.js tests/browser/evidence.spec.js tests/browser/boards.spec.js
tests/browser/visitor-journeys.spec.js tests/browser/understand.spec.js tests/browser/participation.spec.js .github/scripts/build_understand.py .github/scripts/test_understand.py
'''.split())
CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self' https://gateway.umami.is/api/send; base-uri 'none'; object-src 'none'; frame-src 'none'; form-action 'self' https://formspree.io; upgrade-insecure-requests"
SECRET_PATTERNS = [
    r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    r'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})\b',
    r'\bAKIA[0-9A-Z]{16}\b',
    r'\b(?:sk_live_|sk-proj-|sk-ant-api)[A-Za-z0-9_-]{20,}',
]

# Redirect entry points have dedicated journey tests instead of shared navigation.
REDIRECT_PAGES = frozenset({'visit/index.html'})


def require(ok, message):
    if not ok: raise ValueError(message)


class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.csp = False
        self.referrer = False
        self.inputs = {}
        self.named_inputs = {}
        self.feed(text)
        require(self.csp and self.referrer, 'Missing security or referrer policy.')

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        require(not any(k.startswith('on') or k == 'style' for k in a), 'Inline handler or style is forbidden.')
        require(tag not in {'base', 'iframe', 'object', 'embed', 'style'}, 'Unexpected active or embedded content.')
        if tag == 'meta' and a.get('http-equiv', '').lower() == 'content-security-policy':
            require(a.get('content') == CSP, 'Security policy has changed; review it explicitly.')
            self.csp = True
        if tag == 'meta' and a.get('name') == 'referrer':
            require(a.get('content') == 'strict-origin-when-cross-origin', 'Keep form domain validation compatible without leaking query strings.')
            self.referrer = True
        if tag in {'script', 'link', 'img', 'form'}:
            require(self.csp, 'Policy must precede all resources and forms.')
        if tag == 'script':
            script = urlsplit(a.get('src', ''))
            require(not script.scheme and not script.netloc and not script.fragment
                    and script.path in PUBLIC_FILES and script.path.endswith('.js')
                    and (not script.query or re.fullmatch(r'v=[0-9]+', script.query)),
                    'Only reviewed local scripts with optional numeric versions are allowed.')
        if tag in {'link', 'img'}:
            resource = a.get('href') if tag == 'link' else a.get('src')
            # Canonical/document metadata links are not loaded resources.
            if tag == 'img' or a.get('rel') in {'stylesheet', 'icon'}:
                if tag == 'link' and a.get('rel') == 'stylesheet':
                    stylesheet = urlsplit(resource or '')
                    require(not stylesheet.scheme and not stylesheet.netloc and not stylesheet.fragment
                            and stylesheet.path in PUBLIC_FILES and stylesheet.path.endswith('.css')
                            and (not stylesheet.query or re.fullmatch(r'v=[0-9]+', stylesheet.query)),
                            'Only reviewed local stylesheets with optional numeric versions are allowed.')
                else:
                    require(resource in PUBLIC_FILES, 'Unexpected external or missing resource.')
        if tag == 'a':
            url = urlsplit(a.get('href', ''))
            require(url.scheme in {'', 'https', 'mailto'}, 'Unsafe link scheme.')
        if tag == 'form' and a.get('id') != 'record-filters':
            require(a.get('action') == 'https://formspree.io/f/xnpnenzy' and a.get('method', '').lower() == 'post', 'Unexpected form destination or method.')
        if tag == 'input':
            self.inputs[a.get('id', '')] = a
            if a.get('name'):
                self.named_inputs[a['name']] = a
            if a.get('type') == 'checkbox':
                require('checked' not in a, 'Consent must not be preselected.')


def validate_site(root=ROOT):
    root = Path(root)
    files = set(subprocess.check_output(['git', 'ls-files', '--cached', '--others', '--exclude-standard'], cwd=root, text=True).splitlines())
    require(files <= PUBLIC_FILES | MAINTENANCE_FILES, 'Unexpected repository files: ' + ', '.join(sorted(files - PUBLIC_FILES - MAINTENANCE_FILES)))
    require(PUBLIC_FILES <= files, 'Missing required public files.')
    for name in files:
        p = root / name
        require(not p.is_symlink() and p.resolve().is_relative_to(root.resolve()) and p.is_file(), 'Symlink or missing file: ' + name)
        data = p.read_bytes().decode('utf-8', errors='replace')
        require(not any(re.search(pattern, data) for pattern in SECRET_PATTERNS), 'Possible credential in ' + name + ' (value withheld).')
        if name.endswith('.html'):
            page = Page(data)
            if name == 'letters.html':
                require(all('disabled' in page.inputs.get(field, {}) for field in ('council-name', 'council-postcode')), 'Council identity must be disabled before consent is checked.')
                for field, value in {
                    'notice_version': '2026-09-22-letters-v3',
                    'letter_consent': 'yes-process-my-letter-v3',
                    'allow_public': 'yes-publish-with-display-name-v3',
                    'allow_council': 'yes-share-with-richmond-council-v2',
                    'allow_quotes': 'yes-quote-published-letter-v1',
                }.items():
                    require(page.named_inputs.get(field, {}).get('value') == value, 'Letter permission or notice version has changed; review its meaning explicitly.')
                require('required' in page.named_inputs['letter_consent'], 'Letter processing consent must be required.')
                require(all('required' not in page.named_inputs[field] for field in ('allow_public', 'allow_council', 'allow_quotes')), 'Letter sharing must remain optional.')
        if name.endswith('.js'):
            require(not re.search(r'\b(?:innerHTML|outerHTML|insertAdjacentHTML|eval)\b|document\.write\s*\(', data), 'Unsafe DOM/code execution sink in ' + name)
    analytics = json.loads((root / 'analytics-config.json').read_text())
    require(set(analytics) == {'enabled', 'websiteId'} and type(analytics['enabled']) is bool, 'Invalid analytics configuration.')
    require((analytics['enabled'] and isinstance(analytics['websiteId'], str) and re.fullmatch(r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}', analytics['websiteId'])) or (analytics['enabled'] is False and analytics['websiteId'] == ''), 'Analytics must have a valid public website ID or stay disabled.')
    for kind in ('suggestions', 'letters', 'supporters'):
        validate_board(json.loads((root / (kind + '.json')).read_text()), kind)
    return len(PUBLIC_FILES)


def stage_site(output, root=ROOT):
    validate_site(root)
    output = Path(output).resolve()
    require(not output.exists(), 'Use a fresh output directory.')
    require(not output.is_relative_to(Path(root).resolve()), 'Build output must be outside the repository.')
    output.mkdir(parents=True)
    for name in sorted(PUBLIC_FILES):
        (output / name).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(Path(root) / name, output / name)
    return len(PUBLIC_FILES)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stage', type=Path)
    args = parser.parse_args()
    count = stage_site(args.stage) if args.stage else validate_site()
    print(f'Validated {count} public files; private metadata and unexpected fields rejected.')
