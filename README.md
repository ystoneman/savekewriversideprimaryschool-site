# Kew Riverside: parent-led evidence and action

A static website with no runtime dependencies, created and maintained by Yann Stoneman, a Kew Riverside parent seeking to keep the school open. It does not claim a mandate from all parents or operate on behalf of the school, council or PTA. Factual sources and editorial positions remain distinct.

## Contributing

School-community developers are welcome to contribute through fork-based pull requests. Start with [CONTRIBUTING.md](CONTRIBUTING.md) for setup, tests, privacy rules and review requirements. Yann is the code owner; contributors do not need repository write access or access to private submissions. The guide explains the protected `main` branch and the current owner-administrator exception.

## Publishing on GitHub Pages

This repository maintains and directly deploys the complete source to https://savekewriversideprimaryschool.org/. Main publishes only after privacy/security validation and every browser project passes. See [CONSOLIDATION.md](CONSOLIDATION.md) for automatic legacy compatibility updates, verification and recovery.

Edit content here. Domain-candidate branches, hand-copied public directories and manual promotion manifests are no longer part of publishing. Existing legacy addresses retain small redirect/recovery sites and automatically generated download/data compatibility files.

## Permanent flyer QR link

Ready-made QR images linked from the Parent action plan use the new domain: `qr/savekewriverside-visit-qr.png` and `.svg` encode the `/visit/` address below (with its trailing slash) for open-day and visit flyers; `qr/savekewriverside-home-qr.png` and `.svg` encode the homepage. The earlier `qr/kew-riverside-visit-qr.*` and `qr/kew-riverside-website-qr.*` files encode the old GitHub Pages address and stay published for existing flyers. Keep all eight paths permanent. Changing the `/visit/` destination never requires new QR images.

New flyers can print or encode **https://savekewriversideprimaryschool.org/visit/**. Existing QR images encode **https://ystoneman.github.io/kew-riverside-website/visit/**; keep that old GitHub Pages address working for the lifetime of those flyers. Keep `visit/index.html` in place. The current destination is the [school contact page](https://www.kewriverside.richmond.sch.uk/page/?pid=525&title=Contact+Us), verified on 24 September 2026. The redirect works without JavaScript and includes a normal link if automatic refresh is disabled. It adds no tracking or subscription.

To point existing flyers to a future, verified school registration page:

1. Update both destination URLs in `visit/index.html` (the refresh and fallback link), using `&amp;` for ampersands. Update the title and short fallback description to match.
2. Update the intended destination in `tests/browser/qr.spec.js` and `.github/scripts/test_site_structure.py`. Keep the tests for Back, no JavaScript, the native fallback, and ignored incoming parameters.
3. Follow `TESTING.md`, then merge and verify the Pages deployment. Test the same printed address before distributing more flyers. Previously printed QR codes stay unchanged.

The redirect belongs to this GitHub Pages account and repository. Renaming or removing either can break printed links. GitHub Pages can briefly cache an older destination after an update; verify it live rather than assuming a commit is already published. The existing video QR at `videos.html#upload` has a separate purpose and is unchanged.

## Content and provenance

- Original historical research cut-off: **21 September 2026**. School comparison datasets were checked on **22 September 2026**; current Kew findings, the indicative budget and selected primary records were rechecked on **5 October 2026**. Individual source access dates remain recorded; this is not a fresh check of every historical source.
- 59 source entries: 55 reviewed, 2 listed in a reviewed index without individual review, and 2 routes not retrieved.
- Sources: school website, Richmond Council and Schools Forum, Achieving for Children, Ofsted, Department for Education.
- The school-specific consultation page, leaflet, general FAQ and council-linked form were retrieved. The form states a 16 October 2026 response deadline. Closure effective 1 September 2027 is proposed; November 2026 and April 2027 committee stages are planned, not completed decisions. Wording differences between timetable documents remain explicit.
- The eight numbered approaches are editorial priorities, not probabilities or demonstrated school-specific solutions.
- Forecasts and pupil counts keep their dates and geographical definitions.
- `sources.csv` is the visitor download: all 59 source records, with readable column headings, source URLs and coverage caveats. It uses UTF-8 with a BOM for Excel.
- `sources.json` retains the structured source index, chart values and option rankings for maintenance.
- `applications.csv` provides the borough application series.
- `response-checklist.pdf` is the visitor download: a two-page A4 checklist with selectable text, tick boxes and clickable links.
- `response-checklist.md` is the editable source for the PDF.

This collection is not exhaustive. Original documents remain with their publishers. It contains no private correspondence, family records or reproduced pupil photographs.

## Files

| File | Purpose |
| --- | --- |
| about.html | Named owner, supplied family account, position, update history and private contact form |
| supporters.html / supporters.js / supporters.json | Specific supporter statement, separate consents, manual confirmation and human-approved public names only |
| community.css | Parent introduction, contribution routes and supporter styles |
| index.html | Homepage with six visitor task routes and the school enquiry; works without JavaScript |
| evidence.html | Current Kew findings, historical cases, original-source cards, evidence gaps and search; works without JavaScript |
| understand.html / case-evidence-data.json / case-evidence.csv | Generated explanation and reviewed aggregate case figures with a visitor CSV export |
| proposal.html / proposal.css | Dated proposal, conditional timetable, institutional roles, factual profiles, questions and decision record; no JavaScript required |
| corrections.html / corrections.js | Private corrections and objections, always kind=privacy, no publication option |
| styles.css / insights.css | Responsive screen/print styles, practical FAQ and school-specific pupil chart |
| app.js | Search, filters, shareable filter URLs and anchor handling |
| navigation.js / participation.css | Shared participation navigation, letter shortcuts and optional mobile menu dismissal |
| favicon.svg | Original code-drawn site mark |
| sources.csv | Spreadsheet-friendly source index for visitors |
| sources.json | Structured provenance and data for maintenance |
| applications.csv | Chart values with source attribution |
| response-checklist.pdf | Printable evidence checklist for visitors |
| response-checklist.md | Editable checklist source |
| feedback.html / feedback.js | Ideas, evidence, meeting questions and corrections; optional publication and reviewed suggestions |
| faq.html / discovery.js / discovery.css | Sourced practical answers, local FAQ search, homepage discovery routes and shared action styling |
| letters.html / letters.js | Community letters written first, device drafts, separate public, quote and council permissions, private optional council identity fields |
| contribute.css | Letters, Share ideas and thank-you page layout: invitation hero, choice cards, steps and returning-visitor panel |
| sent.html / sent.js | Thank-you page for the form service's redirect: neutral by default, official-response step after a letter |
| respond-reminder.ics | Calendar reminder for the official response (13 October, London time) |
| voice.css / voice.js | Header tiles for Community letters and Share ideas, with a one-time arrival cue |
| og-home.png / og-letters.png / og-ideas.png / og-videos.png | Link-preview images (1200 × 630) |
| feedback.css | Shared form and public-board styles |
| privacy.html | Versioned privacy and moderation notice |
| suggestions.json | Approved website suggestions only |
| letters.json | Consented, AI-screened or human-reviewed letters; no council identity fields or reply emails |
| .nojekyll | Disables Jekyll processing for branch-based Pages |

## Maintenance

Project review guidance is in [AGENTS.md](AGENTS.md#specialist-reviews), with the single current [journey register](UX-DESIGN-DECISIONS.md#protected-visitor-journeys) and three repository skills under `.agents/skills/`: `kew-campaign-review`, `kew-ux-review` and `kew-evidence-review`. Relevant substantial changes receive planning and implementation reviews; routine corrections use the criteria directly. The lead integrates findings and retains the normal required checks. These files are repository maintenance material and are excluded from the website deployment artifact. Project skills are discoverable when working in this checkout; tasks started in the surrounding school workspace use its `AGENTS.md` to load the same skills directly.

For a source addition or correction, retain a stable ID, publisher, document date (or explicitly unknown), URL, summary, location and collection coverage. Update both `sources.json` and the static cards in `evidence.html`, then run `python3 .github/scripts/build_sources.py` to regenerate `sources.csv`; use `--check` to detect a stale export. When `response-checklist.md` changes, run `python3 .github/scripts/build_checklist.py` with ReportLab available, then render and inspect every page of `response-checklist.pdf`. The builder reads and writes this checkout and derives its checked date and total page count. Update counts when coverage changes. Recheck the guidance edition and official notice before changing any process or deadline statement.

Recheck the proposal, deadline, current public roles and meeting records before updates and after relevant committee meetings. Do not infer a position from office or a vote from attendance. Only add exact motions and individual votes from verified official records. Text-only profiles are deliberate; portraits need separately verified reuse rights. The private public-role assessment is held outside this repository. Corrections are human-reviewed and never auto-published.

When updating charts, retain the complete data table and specify geography, measure, units and date. Do not silently turn a projection into an actual observation.

Page counts and detailed usage use a local Umami collector and stay off on the new domain until a visitor chooses a level in the footer’s Analytics choices panel (see `ANALYTICS.md`); there are no advertising scripts or remote fonts. Forms post to Formspree, which runs a hosted security check; see `privacy.html`. The letters and suggestions boards render approved data as text, never visitor HTML. Council sharing requires separate, recorded consent and an operator check of the official receiving requirements; it is not an official consultation submission service. Outgoing links open the publisher's site. Search parameters remain in the page URL so a filtered view can be shared.

## Verification in this environment

See [TESTING.md](TESTING.md) for the automated browser suite, coverage matrix, local commands and manual Xcode iOS Simulator checklist. [AGENTS.md](AGENTS.md) requires future interaction changes to extend the relevant tests. Playwright is a development-only dependency. Both browser regression tests and privacy/security validation must pass before Pages deployment.

JavaScript syntax, internal anchor references, local asset references, source IDs, record counts, chart arithmetic and filtering behaviour are checked during preparation. Browser checks cover desktop/mobile forms, independent permission choices, excluded private fields, plain-text previews and empty public boards. Two harmless CAPTCHA-protected setup submissions were delivered and verified in the private inbox on 21 September 2026. The separate hourly suggestion moderation remains paused; its earlier delivery verification did not authorise starting it.

## Named support and contact

Feedback is the entry point for named support, letters/testimonials and site suggestions. Routine kind=letter contributions may now be automatically screened and published with the v3 processing and publication permissions described below. The separate kind=suggestion/accessibility workflow is unchanged. kind=supporter always needs contributor confirmation of the exact name/statement and explicit human approval; kind=contact stays private. The supporter notice is 2026-09-21-supporters-v1, statement keep-open-2026-09-21; feedback consent tokens remain unchanged. Never infer endorsement from another kind of contribution. The private helper and operating procedure live outside this public repository. Do not publish emails, private references, confirmation replies or unapproved names.

## Community letter publication

The current notice is `2026-09-22-letters-v3`, with required processing consent `yes-process-my-letter-v3` and optional publication consent `yes-publish-with-display-name-v3`. The independent council-sharing value remains `yes-share-with-richmond-council-v2`; its meaning has not changed. Earlier letters retain their original permissions and require human review before publication.

Routine, relevant letters with the new explicit permissions may publish after automated screening, whether supportive or critical. Specific content, authorship and permission concerns are held for human review. An ordinary parent mention of their child’s first name is not by itself a hold. The public review value is exactly `AI screened` or `Human reviewed`; public data allowlists and private-field exclusions still apply. The private workflow checks periodically and sends one publication email to a supplied reply address only after confirming the letter is live, including the link, displayed name and edit/removal route. Do not promise immediate publication or reuse this permission for marketing, council forwarding or supporter listing.

## Exploratory community funding

Option 02 (`index.html#option-crowdfunding`) is linked to the costed recovery plan. The £400,000 figure is the council’s forecast deficit by 2028/29, not a campaign target. Eight fixed question links route to `feedback.html?kind=crowdfunding&question=...#feedback-form`. Funding feedback stays private for human review even if publication permission is submitted; it is never eligible for the automatic board. There are no donations, pledges, donor lists or recipient agreements. Category selection also works without JavaScript. Do not interpret submitted ideas as permission to publish, forward, contact third parties or make financial commitments.

## Security checks and deployment

Run `python3 .github/scripts/check_site.py` **before committing** and `python3 -m unittest discover -s .github/scripts -p 'test_*.py'` after changing security or public-data handling. A public Git commit already exposes its contents; a later deployment check cannot undo that. Stage named files and inspect the staged diff. Never add inbox exports, private ledgers, confirmation correspondence, council drafts, credentials or fixtures derived from private submissions. Committed browser fixtures must contain only fictional test data. Ignore rules are only a convenience, not a confidentiality boundary.

Every push and pull request runs privacy/schema checks, JavaScript syntax checks, asset validation and browser regression tests. The source repository’s workflow deploys only a passing `main` build to the original address. A separate deployment must use the validated public artifact from an explicitly recorded source revision; this candidate branch must not be merged into the original `main` merely to test the new domain. GitHub Actions are pinned to exact commits, checkout credentials are not retained, and the separate deployment job has only Pages and deployment-identity permissions. The workflow packages an explicit asset list and excludes repository maintenance files. New intended assets must be deliberately added to the list in `.github/scripts/check_site.py`.

All HTML pages declare a restrictive Content Security Policy before resources: local scripts/styles/data only, no inline scripts or handlers, no embedded frames/plugins or base-URL changes, and form submissions restricted to this origin and Formspree. External source links still work. Formspree remains responsible for CAPTCHA, spam filtering, intake validation and private storage. The new-domain deployment uses the separate Formspree endpoint `https://formspree.io/f/xjykjyrk` in a project restricted to `savekewriverside.org`; the original site keeps its existing project restricted to `ystoneman.github.io`. Check the receiving inbox, permissions, success/error recovery and private intake workflow for both projects before announcing the new domain. Localhost and file previews should not submit to the live inbox. Keep `strict-origin-when-cross-origin` so the domain check works without sending page query strings.

Public boards have exact field allowlists, bounds, valid dates and unique IDs checked **before deployment**; browser validation also fails closed and renders only text. These checks do not establish real identity, consent or the suitability of free text. Private moderation and each category's human-review requirements remain in force. Council identity inputs are disabled in the initial HTML and require an explicit council-sharing choice and working JavaScript to be enabled.

GitHub Pages does not give this project control over custom HTTP response headers. The HTML policy cannot enforce `frame-ancestors` or `X-Frame-Options`, so full anti-framing protection would require a host or proxy with custom headers. Bot controls reduce spam but cannot eliminate it or guarantee availability within provider quotas. No automatic security scan can guarantee an absence of vulnerabilities.

## School-specific evidence and practical answers

The homepage leads its numbers section with the consultation leaflet’s full eleven-year Kew Riverside pupil series. Five reported years (2021/22–2025/26) use a solid line and filled points; six forecasts (2026/27–2031/32) use a dashed line and hollow points. The zero-based chart, accessible table and sources.json/charts/schoolRoll must stay in agreement. Forecasts are not a verified present headcount, an assurance the school remains open, or an enrolment target sufficient for financial viability. No percentage from the leaflet’s inconsistent prose is copied into this chart.

Five practical FAQ answers reuse the existing current-proposal panel, including the council’s statement that applications and admissions can continue during pre-statutory consultation. Keep that answer stage-specific and recheck the council FAQ when the process changes. Every answer cites its source or the site’s own contribution policy. The existing borough application chart, occupancy comparison and housing context remain available in a collapsed native disclosure. The chart, FAQ and data table work without JavaScript. No source-library count or contribution permissions changed.

## Shared navigation and letter entry points

All ten pages share the same header: research links including FAQ, Community letters / Read or write, and a pale-green Share ideas / Evidence & suggestions action. The council response remains the dark primary homepage action. Below 1,101px, research navigation uses native details; Community letters and Share ideas remain visible. Below 701px, the action pair spans its own row. The compact header scrolls away rather than covering content. Keep the duplicated desktop/mobile research links in agreement when editing them. Only the visible navigation is exposed to keyboard users; the current destination has aria-current="page".

Navigation JavaScript only adds dismissal on link selection, outside click, Escape, focus arriving outside the menu and transition to desktop; native disclosure still works without it. Letters has direct writing/reading shortcuts, a writing link at the board and concise consent lead-ins. Full consent wording, separate unchecked permissions and disabled private fields are preserved.

The participation styles use a separate asset URL so the new shared header cannot pick up a cached pre-header version of styles.css. Keep participation.css loaded after the existing page styles.

## Enrolment campaign option — 22 September 2026

Option 04 (#option-enrolment) proposes school-coordinated local outreach, authentic adult parent stories and a measured enquiries → visits → applications → enrolments journey. YouTube, TikTok and Instagram are labelled suggested channels, drawn as local SVG icons with adjacent text; they are not links to campaign accounts. There are now eight numbered approaches; later numbers and the formal-participation cross-reference were updated. No campaign was launched, third parties contacted or pupil target invented.

The compact #visit-school card links to the school’s Contact Us page so prospective families can ask what visits and places are currently available. It does not promise a tour while the reported restriction remains unconfirmed. The council FAQ’s stage-specific admissions statement is kept separate from whether a visit is available. Older admissions criteria or dates on the school page are not reproduced. enrolment.css is loaded only on the homepage and is in the public deployment allowlist. No new JavaScript, embeds, trackers or intake form was added.

## Understand the situation — September 2026 comparisons

`understand.html` is linked from the shared Understand navigation and a compact homepage preview. It shows the three Kew planning-area schools first, with count/percentage trend controls and native disclosures for all 45 Richmond primary-phase schools. Capacity is a matched May 2025 snapshot; year groups are January 2026 headcounts excluding nursery. The existing council-leaflet series and borough applications remain on the homepage, separately labelled.

`understand-data.json` holds only reviewed school-level aggregates and provenance, including source hashes, split-site aggregation and changed school reference numbers. It does not include the national download’s pupil demographic breakdowns. `richmond-schools.csv` is the spreadsheet-friendly download. These files and `understand.css` / `understand.js` are explicitly published. The Python builder and tests are maintenance-only.

To update the comparisons, check the source definitions, dates and raw records; update the reviewed JSON, then run `python3 .github/scripts/build_understand.py`. Its `--check` mode detects stale HTML or CSV and runs through the data test suite. Do not hand-edit generated `understand.html` or `richmond-schools.csv`. Finance and forecast observations live separately in `case-evidence-data.json` and are checked by `test_case_evidence.py`; the same builder writes their public CSV and Understand sections. Unknown annual budget values remain null. Review the source links and visible qualifications when updating an edition. Run all checks in TESTING.md. Reconcile source-library changes across `sources.json`, `sources.csv` and the cards in `evidence.html`.

Charts are rendered as HTML/SVG, with no third-party chart package, embeds, tracking, live requests or extra visitor data collection. The small local script only switches between already-rendered trend views. Tables and disclosures remain usable without it.

## Change history and design rationale

[CHANGELOG.md](CHANGELOG.md) records visitor-facing changes and significant evidence, privacy, security and publishing changes. Add work under Unreleased, then record the checks actually completed and the publication outcome before moving it into a dated release. Historical commit dates are not proof of deployment dates. Keep references verifiable and private submission contents out of the log.

[UX-DESIGN-DECISIONS.md](UX-DESIGN-DECISIONS.md) records the visitor need, alternatives considered and rationale for material navigation and interaction choices. Update it when those choices change; distinguish a proposed design, observed feedback and completed verification. [TESTING.md](TESTING.md) remains the operational guide for checks. These documentation files are repository maintenance material, not public Pages assets.

## Finding the other-schools report

The homepage research shortcut and the separate Site research entry in Evidence link to the existing `lessons-report.pdf`, `lessons.html` and source appendix. Evidence search includes remembered terms such as other schools, saved schools and 44-page PDF. Research filtering uses the same controls but keeps a separate count and Synthesis label; the 57 original-source records keep their own HTML/JSON/CSV contract. Keep the report outside `.source-card` unless the original-source data contract is deliberately revised. Preserve `#source-lessons-report` for shared links; anchor recovery must reveal it even when filters exclude it. `research-discovery.css` styles these entry points and is included in the public asset allowlist.


## Learning and attainment maintenance

`attainment-data.json` contains only reviewed aggregate results, cohort counts and source provenance. Rebuild the educational section and `attainment.csv` through `python3 .github/scripts/build_understand.py`; `.github/scripts/build_learning.py` supplies its renderer. Keep final DfE results, the inspection’s older subject table and the school-reported/provisional 2026 update distinct. Null is missing/unverified, never zero. Any update needs the independent source-sentinel review in `test_learning.py`, not just regeneration. The inspection remains an original record in `sources.json`/CSV/HTML; the four learning FAQs preserve existing question IDs.

The proposed `ENROLMENT-OUTREACH-BRIEF.md` is maintenance-only coordination material. It does not authorize outreach or commit partners, money or volunteers. No tracking was added.


## Homepage and reference routes

The homepage is a short overview. The complete evidence library, charts, history, gaps and method live in `evidence.html`; the eight strategies live in `options.html`. Keep their local contents and the six homepage task links useful. The video flyer QR address is a fixed route: `videos.html#upload`.

The homepage retains each former fragment as a `.legacy-route` with an explicit destination and native Continue link. `homepage.js` uses replacement navigation and preserves query strings, including evidence searches without a fragment. Do not remove these compatibility targets when shortening copy. Update canonical citations in the builders as well as generated pages. The source-library integrity and legacy-route tests live in `test_site_structure.py`; browser interactions and saved searches are checked in `homepage.spec.js` and `evidence.spec.js`.

## Video publication permissions

New Parent Voices submissions require explicit YouTube publication permission and offer separate optional unchecked news-media permission. Receipt/storage/personal review remains a separate required consent. Earlier saved permissions, including delayed uploads, keep their original scope. Use [the permission-version rules](VIDEO-PERMISSIONS.md) before manual publication or media disclosure; store actual records privately outside this repository. Both Google form routes and the Dropbox request retain their existing public URLs.

## Legacy address compatibility

See [CONSOLIDATION.md](CONSOLIDATION.md). Both previous addresses forward ordinary HTML to this site, retain browser-origin saved-word recovery and preserve direct download/data files. Legacy pages have no submission forms or analytics. Printed `/visit/` addresses still hand off directly to the school.
