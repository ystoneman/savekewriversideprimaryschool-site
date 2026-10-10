# Campaign SEO implementation plan

Prepared 10 October 2026 for member review. Repository baseline: `daa26e5` on `ystoneman/savekewriversideprimaryschool-site`.

The goal is to help people searching about Kew Riverside Primary School's proposed closure find reliable answers, understand the current process and reach the appropriate next step. Deliver the discovery and metadata work first, then improve the pages and links that actual search evidence shows are useful.

This is an implementation plan, not a record of completed SEO work. The current change adds this document and registers it as maintenance documentation. Website implementation, account changes, outreach and release are subsequent tasks. A pushed planning branch does not publish a website change.

## Scope and success

Campaign search targets cover the proposal, consultation, decision process, evidence, finances, alternatives and community experience. Recruitment marketing remains completely separate: admissions, open days, school visits and prospective-family testimonials are not campaign SEO targets or campaign conversion measures. Existing family-information and direct school-enquiry routes remain usable.

Preserve the priorities and entry points in [Protected visitor journeys](UX-DESIGN-DECISIONS.md#protected-visitor-journeys). In particular, keep the Parent action plan and current official response prominent, Letters and Share ideas exposed, and all six homepage task destinations available. New SEO work should improve existing destinations without adding competing homepage bands or global navigation rows.

Success has three levels:

1. **Delivery:** the selected canonical pages are discoverable, their metadata is accurate, the sitemap is accepted for processing and important URLs have been inspected in Search Console.
2. **Search visibility:** relevant queries produce impressions and clicks to the appropriate current-domain pages. Establish the baseline before setting growth targets; no search volume, ranking or traffic uplift is assumed.
3. **Visitor usefulness:** existing aggregate, consented analytics show which broad actions visitors open. Opening the official form does not establish a submitted response. Website contributions and consultation responses remain distinct outcomes.

## Verified starting point

| Observation on 10 October 2026 | Implementation implication |
| --- | --- |
| The live homepage, Proposal, FAQ, Evidence, Numbers and About pages return HTTP 200, identify the independent campaign and have self-referencing canonical tags on `https://savekewriversideprimaryschool.org/`. | Retain this foundation. Do not schedule already-completed identity or canonical work as missing. |
| The root `sitemap.xml` and `robots.txt` URLs return HTTP 404. | Add a small public sitemap and a robots file referencing it. Their absence is not, by itself, an indexing block. |
| Sampled old-domain and original GitHub Pages URLs return HTTP 200 compatibility HTML with current-domain canonicals. The compatibility script forwards ordinary routes and preserves recovery on Letters/Sent. | Audit search consolidation. Any later HTTP redirect work must preserve origin-local recovery and old shared links. |
| Public search results included the current homepage and an old-domain Proposal result. | Investigate in Search Console. This sample is not a Google ranking report or complete index audit. |
| Search Console account status, chosen canonicals and query performance have not been inspected. | Account access and a baseline are the first measurement dependency. |
| The latest source already generates campaign identity, metadata and a journalist route at `about.html#press`. | Extend the maintained generator and existing press section rather than creating competing versions. |
| The official council page describes a pre-statutory proposal; its linked response form states 16 October 2026 as the response deadline. | Recheck the official position when implementing. Prepare a stage-change update for visible copy and metadata; do not infer a closing time or a final closure decision. |

Use [CONSOLIDATION.md](CONSOLIDATION.md), current deployment configuration and live checks for the active domain. The journey register contains a historical paragraph naming the previous domain; its protected journey priorities remain authoritative. Correct that stale domain reference in the later documentation maintenance task without changing journey priorities.

## Delivery sequence and responsibilities

Responsibilities below are proposed functions, not newly assigned volunteers. The site maintainer owns the technical changes; an authorised account operator handles Search Console; the campaign owner approves priorities and assigns any outreach. Specialist reviews follow [AGENTS.md](AGENTS.md).

| Work package | Priority and timing | Dependency | Completion evidence |
| --- | --- | --- | --- |
| A. Search baseline | First working session | Owner access to the relevant properties | Dated private baseline and URL inspection results |
| B. Sitemap and crawl checks | First code change; target the next 48 hours if implementation is commissioned | Latest main and agreed URL inclusion list | Valid generated assets, packaging checks, live HTTP checks and sitemap submission result |
| C. Search-facing titles and descriptions | Next small code change | A/B where available; no need to wait for query history to correct unclear titles | Reviewed source/output changes and generated-file checks |
| D. Answer quality and internal links | Following content change, ordered by need | Source verification and search/user evidence | Reviewed landing-page answers and preserved mobile journeys |
| E. Local links and press usefulness | After destinations are ready; can run alongside D | Campaign owner assigns outreach | Relevant live links or correction requests, with private contact records |
| F. Consultation stage refresh | Prepare before 16 October; publish when the official status is verified | Current official source and approved next action | Consistent visible status, metadata, historical records and response routes |
| G. Weekly review and domain follow-up | Weekly during active campaign stages | Meaningful Search Console data | Short decision log; targeted improvements or a documented decision to wait |

The dates above are intended sequencing, not promises about Google's crawl or ranking times. Keep immediate campaign communications active while search changes are processed. No automation or reminder is created by this plan.

## A. Establish the search baseline

- [ ] Inspect existing Search Console properties before creating duplicates. Verify the current domain property using the owner's existing access; use a URL-prefix property if domain verification is unavailable and document its narrower scope. Keep verification/account records in private operations storage.
- [ ] Inspect the old custom domain and original GitHub Pages property where owner access exists. Record access gaps without blocking unrelated current-site work.
- [ ] Inspect `/`, `/proposal.html`, `/faq.html`, `/evidence.html`, `/understand.html`, `/options.html` and `/lessons.html`. Record indexed/not indexed, Google-selected canonical, last crawl, fetch problems and any excluded-page reason. A successful live test or indexing request is not proof of indexing.
- [ ] Save an initial 28-day report, or the available history for the new property, with dates and domain-move context. Include search clicks, impressions, CTR, queries, landing pages, country and device where available. Treat low counts and omitted queries cautiously.
- [ ] Compare important indexed old URLs with their new counterparts. Separate normal recrawl lag from broken redirects, failed fetches or competing canonicals.

**Done when:** the operator can identify the actual indexing state of priority pages and the available query baseline. Account access failures are documented as dependencies; they do not justify inventing data or delaying local sitemap work.

## B. Add the sitemap and verify crawlability

### Sitemap contents

Use a deliberately curated list, not every file or navigation item. Start with these existing pages:

| Include in the initial sitemap | Reason |
| --- | --- |
| `/` | Campaign identity and main entry |
| `/proposal.html` | Proposal, dates, official process and Parent action plan |
| `/faq.html` | Practical questions and short answers |
| `/understand.html` | Finances, pupil data and results with qualifications |
| `/evidence.html` | Source-backed findings and original documents |
| `/options.html` | Alternatives and what would make them viable |
| `/lessons.html` | Selected historical school cases |
| `/lessons-sources.html` | Research provenance |
| `/about.html` | Publisher responsibility, contact and journalists |
| `/letters.html` | Existing reviewed public community letters |

Keep `/sent.html` and the two fundraising briefs excluded, preserving their existing `noindex` treatment. Do not add `/visit/`, recruitment video routes, form-focused pages, raw JSON/CSV exports, assets, individual letter fragments, query/filter variants or legacy-domain URLs to the initial campaign sitemap. Privacy, corrections and other existing routes remain linked and accessible; sitemap omission is not a request to deindex them. Retain the archived rally URL and historical links, without promoting that past event in the initial sitemap. Do not change indexing or publication permissions for contributions as part of this task.

### Source and artifact changes

- [ ] Add a small deterministic standard-library builder, proposed as `.github/scripts/build_seo.py`, and focused checks in `.github/scripts/test_seo.py`. Both belong in `MAINTENANCE_FILES`.
- [ ] Generate `sitemap.xml` with the current absolute HTTPS canonical URLs. Use `/` for the homepage, omit fragments/query strings, reject duplicates and include only verified public HTML destinations.
- [ ] Omit `lastmod` initially unless a reliable significant-content date can be maintained for each page. Never insert the build time as an invented content update date. Do not spend effort on `priority` or `changefreq` fields.
- [ ] Generate a minimal `robots.txt` that permits public crawling and points to the current-domain sitemap. Do not block CSS or JavaScript needed for rendering. Keep `noindex` pages crawlable so their directives can be read; robots rules are not access control.
- [ ] Add only `sitemap.xml` and `robots.txt` to `PUBLIC_FILES`. Keep this plan and SEO scripts/tests in `MAINTENANCE_FILES`.
- [ ] Check `.github/scripts/build_old_site_redirect.py` and its tests when extending the public allowlist. Ensure the new canonical-site SEO files are not copied to legacy origins accidentally. The legacy builder consumes the canonical allowlist but deliberately produces a smaller compatibility bundle.
- [ ] Add meaningful checks for XML parsing, exact intended URL membership, canonical-host consistency, excluded routes, robots sitemap location, generated-file freshness and absence of maintenance files from the staged artifact. Preserve the full existing privacy/security checks.
- [ ] After release, verify actual HTTP status and content for both files and each sitemap destination. Submit the sitemap once through Search Console and record the processing result. Request indexing of changed priority pages where useful; repeated submissions are not a substitute for resolving an error.

**Done when:** the staged and live files contain the agreed canonical URLs, tests reject inclusion mistakes, and Search Console submission is recorded accurately. Search indexing and ranking remain separate observations.

## C. Improve titles and descriptions at their source

The shared identity renderer in `.github/scripts/build_navigation.py` controls titles, canonical links and campaign metadata. Several research builders call it. It currently prefixes descriptions with campaign identity. Editing generated HTML alone will be overwritten; change the responsible generator or maintained source and regenerate all affected outputs.

The titles below are proposed subject phrases. Retain a clear campaign suffix where helpful, and assess the complete rendered title rather than enforcing an arbitrary character count. Use one coherent description per page, with the useful answer/purpose first and independent campaign identity stated clearly.

| Existing destination | Primary search intent | Proposed title direction | Required answer or next route |
| --- | --- | --- | --- |
| Home | Save Kew Riverside; campaign | Retain `Save Kew Riverside Primary School Campaign` | Current status, Parent action plan and official response |
| Proposal | School closure proposal; consultation dates | `Kew Riverside Primary School closure proposal: consultation and dates` | What is proposed, current stage and official participation routes |
| FAQ | Is the school closing; what happens to pupils | `Kew Riverside closure proposal: answers for families` | Direct answers, practical family guidance and fuller sources |
| Numbers | School finances; pupil forecasts | `Kew Riverside Primary School finances and pupil numbers` | Clear definitions, dated figures and limitations |
| Evidence | Evidence behind the proposal | `Kew Riverside closure proposal: evidence and sources` | Findings, original records and unanswered questions |
| Options | Alternatives to closure | `Alternatives to closing Kew Riverside Primary School` | Conditions, uncertainties and useful current actions |
| Lessons | Schools saved from closure | `School closure reprieves: selected cases and lessons for Kew` | Selected-case limits, comparisons and source register |

- [ ] Draft the complete title and meta description for each priority page. Treat the query examples as hypotheses until Search Console supports them.
- [ ] Preserve the publisher identity already shipped in the masthead, footer, About and page metadata. Avoid titles implying this campaign is the school, council or an officially endorsed body.
- [ ] Keep time-sensitive deadlines in maintained descriptions only where useful and covered by work package F. Do not put an unverified time or a forecast outcome in a title.
- [ ] Maintain consistent Open Graph/Twitter metadata where present. Search engines and messaging clients may choose different displayed text or retain cached previews.
- [ ] Keep existing `.html` routes and anchors. Renaming URLs for keywords adds migration work without an established visitor need.
- [ ] Make metadata edits within the document head; preserve accessible SVG titles, source tables and body headings. Confirm a second generator run is clean and that research builders do not restore older descriptions.
- [ ] Extend existing structure/identity checks for one head title, one canonical, the intended host and coherent page-specific descriptions. Do not enforce keyword repetition or exact text merely to mirror implementation.

**Done when:** priority pages have accurate, distinct search-facing descriptions that survive regeneration, preserve independent campaign identity and match the actual landing-page answer.

## D. Strengthen answers and internal links

Start with Proposal and FAQ, then the financial explanation and alternatives. Make the existing answer clearer before adding a new section or page.

- [ ] For each priority question, provide a concise visible answer, the essential qualification and a source or fuller explanation nearby. Optional detail may remain in accessible disclosures; dates and qualifications that change the answer must not be hidden.
- [ ] Distinguish a proposal, consultation, possible later stage and final decision. The current deadline is a response deadline, not a closure decision date.
- [ ] Keep annual deficits, cumulative forecasts, reserves and avoidable closure costs distinct. Preserve unresolved source inconsistencies and dated assumptions. A forecast deficit is not automatically a fundraising target.
- [ ] Keep historical school research explicitly about selected cases; do not turn it into a representative success rate or proof of a viable Kew alternative.
- [ ] Link between existing relevant answers with descriptive text, such as the financial forecast or official response routes. Do not create repetitive keyword links, a second menu or duplicate articles competing for the same question.
- [ ] Preserve HTML summaries alongside PDFs and clearly label downloads. Maintain source-search, filters, old anchors and the difference between original records and campaign analysis.
- [ ] Check search arrivals to the page top and relevant anchors. The answer must remain findable with JavaScript disabled, disclosures closed initially, a filter active or after Back navigation.
- [ ] Keep recruitment materials and communications separate. Do not add consultation participation requests to admissions or open-day promotion, or repurpose Parent Voices recruitment videos as campaign content.

**Acceptance checks:** independent evidence/campaign review as relevant; rendered desktop and 320 × 568 / 390 × 844 mobile checks in both appearances; keyboard and no-JavaScript checks; preserved J2/J3 arrival prominence, exposed J4/J5 tiles and all six task destinations. Reuse and extend the appropriate tests in `tests/browser/`; perform native iOS checks when the changed behaviour requires them under [TESTING.md](TESTING.md).

When a later D/F change affects participation behaviour, retain the register's written J2/J3/J7 before/after path record: entry position, taps, reading, intervening decisions and next action. Record an unfamiliar person's real-phone attempt before release, or an explicitly accepted and documented owner exception. Metadata/sitemap-only changes do not require a new participation trial.

## E. Make relevant local links easier to earn

The existing `about.html#press` section and source library provide the starting point. Campaign outreach should give editors and community groups something accurate and useful to cite.

- [ ] Review the existing journalist section for current campaign identity, an ordinary contact route and links to the strongest explanations. Keep source dates and research limitations visible.
- [ ] Prepare a short list of relevant local publications, residents' associations and community organisations already covering or discussing the proposal. The campaign owner assigns the sender and approves the outreach scope before messages are sent.
- [ ] Prioritise correcting links that already point to a previous campaign domain. Give the corresponding current page or section, not always the homepage.
- [ ] For new coverage, offer a specific sourced update or explanation. Request editorial links where useful; no paid links, bulk directory submissions, link exchanges or claims that a link implies endorsement.
- [ ] Keep contact details, correspondence and outreach logs in private operations storage. Only public source URLs and verified coverage belong in public documentation.
- [ ] Record which links became live and where they lead. Existing analytics groups most outside referrers into a generic bucket, so do not promise publication-level referral attribution or add tracking merely to obtain it.

**Done when:** useful destinations and reviewable outreach material are ready, and any subsequently authorised outreach has accurate private records. This plan does not send messages or promise coverage.

## F. Refresh the site when the consultation stage changes

Prepare this task before the currently stated 16 October 2026 deadline. Execute it when the official status can be verified, including any extension or changed route. If no subsequent stage has been confirmed, say that clearly rather than promoting a conditional timetable as a completed decision.

- [ ] Recheck the council page, its linked response form and relevant papers. Record what was checked and when; do not infer that an accessible form is still accepting timely responses.
- [ ] Search maintained HTML, content data, builders, metadata, calendar files, checklists and downloads for active deadline wording. The initial file checklist is Home, Proposal, FAQ, Options, Evidence, Letters, Share ideas and archived Rally; inspect actual matches rather than assuming this list is exhaustive.
- [ ] Update the current-action text and metadata together. Preserve historic dates, event URLs and decision records with explicit past/current/conditional context.
- [ ] Keep the Parent action plan, family next steps and official information route available. If the next participation route is unconfirmed, link to the verified status information and provide a bounded current action without suggesting submissions are still timely.
- [ ] Update relevant generated outputs and regression expectations after the official source changes. Preserve the distinction between a campaign contribution and an official response.
- [ ] Record the change under Unreleased in `CHANGELOG.md`; update `UX-DESIGN-DECISIONS.md` only if a material interaction or priority changes. Follow the required reviews and release checks.
- [ ] Request recrawling of changed priority pages after publication where useful. Record the submitted request separately from any observed updated result; Google controls when snippets refresh.

**Done when:** every current invitation agrees with the verified process, historical records remain readable, and search-facing copy no longer invites a superseded action.

## G. Review results and assess remaining domain work

### Weekly review

Use a short aggregate review, with one accountable maintainer and an agreed backup if available. Compare the latest complete week with the previous week, and use a longer window when the sample is small. Record release dates, campaign events and domain changes that affect interpretation.

| Signal | Question | Decision it can support |
| --- | --- | --- |
| Indexing and chosen canonicals | Are the intended pages represented on the current domain? | Fix crawl failures or conflicting signals before rewriting content |
| Queries and landing pages | Which relevant questions actually bring people in? | Improve the existing answer or correct a mismatch |
| Impressions and clicks | Is relevant visibility increasing or shifting? | Prioritise demonstrated demand; do not assume causation from a small change |
| CTR with query/position context | Does the snippet match the searcher's likely question? | Test clearer, accurate metadata after enough data accumulates |
| Existing aggregate action opens | Which broad next steps are opened by measured visits? | Inspect the relevant journey; never count opens as completed responses |
| Verified public links | Are credible local sources pointing to useful current pages? | Correct obsolete URLs and improve reference material |

Search Console and consented onsite analytics cover different populations and definitions. Do not combine them into a precise end-to-end conversion rate, identify contributors or inspect individual sessions. Do not add search terms, letter IDs, form contents or sensitive topic classifications to the site's event payloads. Apply [ANALYTICS.md](ANALYTICS.md), including the existing exclusions and consent controls.

After the first useful baseline, agree realistic directional targets. Prefer relevant clicks and answer usefulness over total traffic or a promised ranking. Low use alone is not a reason to remove a protected family or evidence route.

### Conditional HTTP redirect work

Assess permanent HTTP redirects only if indexing evidence and hosting feasibility justify the effort. Google's preference for HTTP permanent redirects does not override the site's recovery requirements.

- [ ] Inventory both legacy origins, HTML paths, old homepage fragments, downloads, query/filter routes and Letters/Sent recovery. Use the existing compatibility manifests and tests.
- [ ] Establish whether the current hosting can supply path-specific 301/308 responses without moving the production site or redirecting recovery pages before their browser storage can be read. Do not assume GitHub Pages supports arbitrary redirect rules.
- [ ] For any proposed change, map ordinary old URLs directly to their corresponding final destinations. Preserve query strings and fragments through browser tests; fragments are not sent in HTTP requests. Avoid redirect chains and blanket homepage redirects.
- [ ] Keep Letters/Sent recovery at each old origin, including blocked storage, saved and pending words, Copy/Clear/Continue, Back and no-script onward links. Preserve directly shared files and current withdrawal/removal propagation.
- [ ] If host changes are needed, prepare a separate reviewed migration plan with TLS, route checks and rollback before requesting release. Otherwise retain the working compatibility route and canonical signals.
- [ ] Use Search Console's Change of Address only if the migration and property setup meet its then-current requirements. Do not treat filing that request as a prerequisite for this plan or a substitute for working redirects.

**Done when:** there is either a separately verified redirect improvement or a documented decision to retain the current setup. No urgent hosting migration is required to deliver packages A–F.

## Validation and release checklist

Each implementation PR should name the relevant work package, changed files, affected journeys, sources and acceptance evidence. Use an isolated `codex/` branch from current main and stage named files. Keep this plan, account exports and review tooling out of the Pages artifact; account exports and correspondence also stay out of the public Git repository.

Run the applicable checks from [TESTING.md](TESTING.md), including the repository's required release gates:

```sh
python3 -m unittest discover -s .github/scripts -p 'test_*.py' -v
python3 .github/scripts/check_site.py
npm test
git diff --check
```

Use the pinned Node/Playwright environment described there. Run generated-file freshness and JavaScript syntax checks as required. Stage the public artifact into a fresh directory outside the checkout and inspect its membership. Automated browser checks must intercept external submissions and use fictional data.

Before a material release, obtain the relevant specialists' review of the actual diff and resulting behaviour; a planning review does not substitute for this. The current revision must pass the hosted `validate` and `browser-tests` requirements before merge/deployment. Record native iOS and other verification limits accurately. Preserve the existing compatibility deployment gates.

After a requested release, verify the live assets, selected pages, metadata, sitemap and protected routes against the intended commit. Only then record publication as verified. If there is a regression, revert the specific SEO change through the normal checked pipeline without restoring obsolete content or withdrawn contributions. A missing sitemap entry can be corrected without changing visitor URLs; revert problematic metadata to the latest accurate version.

For this documentation-only change, run the Python validation suite and artifact staging checks, confirm the public asset bytes are unchanged from the baseline, and review the diff. No visitor interaction is changed, so no new browser test is warranted. Existing PR automation remains enabled; this task does not merge or deploy the plan branch.

## Review record

The preceding strategy received independent campaign, UX and evidence planning reviews. Their refinements are incorporated here: stage-change maintenance includes metadata as well as visible actions; short answers retain financial and research qualifications; legacy recovery is protected; and Search Console findings are distinguished from public-search samples and action opens.

Independent campaign, UX and evidence review of this implementation plan completed on 10 October 2026. The reviewers read the actual draft, applicable instructions, protected journeys and relevant current source files. No blocking or material findings remained. The UX reviewer recommended making the conditional written-path and unfamiliar-person checks explicit; that addition is included in package D and applies to participation changes in D/F. These were read-only planning reviews, not implementation, live indexing or user-study verification.

Documentation validation passed: 71 Python privacy/security/data/structure tests, local Markdown link checks and public artifact staging. All 117 staged public files were byte-identical to baseline `daa26e5`; this plan was absent from the staged website. Implementation tasks remain unchecked until delivered and verified. Hosted checks are reported on the pull request separately.

## Reference guidance

- [Google SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide): useful content, discovery and realistic update times.
- [Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap): canonical URLs, submission, meaningful modification dates and limitations.
- [Google site migration guidance](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes): URL mapping, redirect continuity and monitoring.
- [Google redirects guidance](https://developers.google.com/search/docs/crawling-indexing/301-redirects): permanent redirects and browser-rendering dependencies.
- [Search Console performance guidance](https://support.google.com/webmasters/answer/17010961?hl=en): queries, pages, impressions, clicks and interpretation.
- [Richmond Council Kew Riverside consultation](https://www.richmond.gov.uk/services/children_and_family_care/schools_and_colleges/school_organisation_consultations/kew_riverside_consultation): verify the current process and follow its response-form link for current deadline wording.

Public guidance and the council deadline were checked during the 10 October strategy review. Recheck provider requirements and official process information when the corresponding task is implemented.
