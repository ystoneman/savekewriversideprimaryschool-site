# Contributing to the Kew Riverside website

Developers in the school community are welcome to suggest fixes and improvements. This is a parent-led project maintained by Yann Stoneman, not an official school, council or PTA website. You do not need access to the private submission inbox or permission to push to this repository to contribute.

## Start with a small pull request

1. For a substantial feature, open a GitHub issue describing the visitor need and proposed change before building it. Small fixes can go straight to a PR. Keep discussions respectful, specific and about the work.
2. Fork this repository into your own GitHub account, clone your fork and create a descriptive branch from the latest upstream `main`.
3. Make one focused change. Read [AGENTS.md](AGENTS.md), the [protected visitor journeys](UX-DESIGN-DECISIONS.md#protected-visitor-journeys) and the relevant maintenance notes in [README.md](README.md). Follow the relevant review criteria; contributors do not need access to Codex or private services to propose a PR. The maintainer coordinates any additional specialist review.
4. Run the relevant checks below, inspect your diff for private information, then push your branch to your fork.
5. Open a pull request targeting `ystoneman/savekewriversideprimaryschool-site:main`. Describe the problem, resulting behaviour and checks actually run. A draft PR is welcome if you want early feedback. State any checks you could not run.

Useful first contributions include accessibility fixes, reproducible bug fixes, test improvements and sourced corrections. Discuss major redesigns, new dependencies, trackers, hosting changes or changes to contribution permissions first. Contribute code and assets you have the right to share; retain attribution and do not assume a publicly accessible image or document is licensed for reuse.

## Local checks

Use Node.js 24, Python 3 and OpenSSL. From your checkout:

```sh
npm ci --ignore-scripts
npx playwright install chromium webkit
python3 -m unittest discover -s .github/scripts -p 'test_*.py' -v
python3 .github/scripts/check_site.py
npm test
```

On Linux, use `npx playwright install --with-deps chromium webkit`. See [TESTING.md](TESTING.md) for the local harness, test coverage and native iPhone checks. The harness intercepts external form submissions. Do not send test messages, uploads or consultation responses to real services. Touch/focus changes need native iOS verification when available; the maintainer can help if you do not have a Mac.

Add regression coverage for changed visitor interactions. Keep existing assertions and security checks meaningful; do not skip them to obtain a passing run. Factual changes need primary sources with dates, context and uncertainty preserved. Update the changelog and design rationale when required by the project instructions.

## Keep private information out of GitHub

Issues, PRs, branches, comments, screenshots, logs and commit history are public. Use fictional test data. Never commit submission exports, correspondence, children's personal information, private contact details, credentials, council drafts or moderation records. Published community contributions are not general-purpose test fixtures; adding or editing them requires the separate private moderation and consent process.

The Pages artifact contains only the explicit `PUBLIC_FILES` allowlist in `.github/scripts/check_site.py`. Add repository-only documentation and tools to `MAINTENANCE_FILES`, not the deployed asset list. Excluding a file from Pages does not make it private: a committed file is still public on GitHub.

For a vulnerability or suspected private-data exposure, use the [private contact form](https://savekewriverside.org/about.html#contact) with a brief description and reply address. Do not post exploit details, secrets or personal records in a public issue or upload them through the contact form. For removal or correction of personal content, use the [private correction route](https://savekewriverside.org/corrections.html).

## Review and merging

`main` is protected for contributors:

- A pull request needs one approving review, including the code owner (`@ystoneman`). New changes dismiss stale approvals, and review conversations must be resolved.
- The GitHub Actions `validate` and `browser-tests` checks must pass, and the branch must be up to date with `main`.
- Force-pushes and deletion of `main` are disabled.
- Workflows from external contributors require maintainer approval before running. Approval to run CI is not approval to merge: the maintainer inspects workflow and executable-code changes first. Fork PRs do not deploy the site.

Yann is currently the only maintainer and code owner. Administrator enforcement is deliberately off: the owner retains an override for owner-authored work and the existing letter-publication workflow, since GitHub does not allow self-approval. This is an exception, not a guarantee that every administrator change has independent review. Owner updates should use PRs and passing checks where practical; the deployment workflow still requires validation and browser tests before publishing. Revisit this exception when another trusted maintainer joins.

The desired settings are recorded in [.github/branch-protection.json](.github/branch-protection.json). Editing that file does not change GitHub settings automatically. A repository administrator must apply and verify changes. School contributors should use forks; write or administrator access is not required or automatically granted.
