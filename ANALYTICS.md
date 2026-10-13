# Website statistics

## Daily browser estimate — 12 October 2026

The owner requested implementation and deployment of estimated daily visitors (unique browsers), including repeat-view verification. The chosen design uses only a browser-local UTC date under `kew-analytics-browser-day`; no unique token, IP hash, fingerprint or server deduplication set is introduced. This is our assessment under the ICO statistical-purpose exception, not approval by the regulator of this specific implementation.

Purpose and necessity: distinguish repeat page opens from the approximate daily audience when assessing whether website content and navigation are useful. Page opens alone cannot answer that question. A date marker is less intrusive than retaining per-browser identifiers or visits; it enables one fixed daily increment without connecting activity. It must never be used for campaign targeting, supporter identification or decisions about people. The existing transmission legitimate-interest assessment and provider arrangements apply; the server schema and 365-day aggregate retention remain unchanged.

Fresh visitors qualify only after the updated notice is fully visible. New explicit choices save v4; every v1–v3 scope and refusal is preserved. The daily marker is never accessed for a valid earlier non-refusing choice. Off removes it and blocks subsequent analytics access; browser privacy signals also suppress collection. No cookies are set. Local storage has no automatic physical expiry: the date becomes irrelevant after its UTC day and is replaced on a later counted day, removed by Off, or cleared with site data.

A same-origin Web Lock serializes the check/write across tabs. Eligibility, the stored choice, configuration and UTC day are rechecked inside the lock without changing the separate Umami permission/timing state. If locks or marker storage are unavailable, only the browser estimate is skipped. The marker is written before one isolated `browser_day/all` request, containing no date, page, device, referral or identifier. Delivery is never retried; interruptions can undercount. Server validation rejects combining this metric with any other row. Application logs stay disabled and IP/UA are not used or retained for deduplication; infrastructure necessarily handles connection data.

Reporting: daily unique browser storage contexts, not exact people. Multiple devices/private sessions/storage clearing/re-opt-in can overcount; shared browsers, blockers, objections, unsupported locks and failed delivery can undercount. Suppression uses device UTC; backend totals use server UTC at receipt. Incorrect device clocks and requests crossing midnight can distort daily totals. UTC day boundaries may differ from a local calendar day. Summing daily totals yields browser-days, not weekly/monthly unique visitors. No historical backfill. Do not divide other dimensions by this estimate as if they were matched visitor records. The metric does not appear in Umami; query Cloudflare D1 as documented in the backend README.

Independent privacy and UX planning reviews required conservative delivery, explicit earlier-scope status and compact notice wording. Actual-diff/rendered reviews and verification are recorded in TESTING.md and the release PR.

## Consent-free measurement audit — 12 October 2026

Decision: extend immediate aggregate counters, preserving the same database schema and private reporting. This is a purpose/necessity and implementation assessment against current ICO guidance, not a claim that every conceivable metric is permitted or a professional legal opinion.

| Measurement | Website improvement and decision | Limits |
| --- | --- | --- |
| Existing page, viewport, section, time and action totals | Retain: find difficult information routes and broken handoffs | Views/thresholds, not people, reading or submissions |
| Broad browser / OS / estimated device | Add: prioritise compatibility checks | Separate totals; no versions, models or raw UA in storage; tablets may look desktop |
| Fixed news/social/search referral categories | Add: check whether landing content makes sense for referred arrivals | Allowlist only; no raw hosts, article paths, query tags or inferred newsletter attribution; no outreach targeting |
| Public page-pair arrivals | Add: identify navigation routes needing clearer labels | Referrer-to-current public path pair immediately aggregated; private/unknown routes excluded; no sessions or chains |
| Active thresholds by public page | Add: compare page usability | Cumulative thresholds; do not sum as duration or infer reading |
| Load completion, first response (TTFB), first contentful paint | Add: find slow pages | Per-page coarse histograms; unavailable at sampling time separate (up to one second after load/collection starts); no resource URLs; once per document, exclude back-forward-cache restores |
| Daily unique estimate using IP+UA / HLL | Assessed, not implemented | New pseudonymous processing; live-key membership tests, sparse traffic and recoverable key/sketch copies need a justified design. IP+UA is not a person. Not illegal in principle, but this design is not established as anonymous |
| Geography, language/timezone, fine versions, arbitrary sources | Not added | No concrete improvement here that outweighs finer classification in a small local audience |
| LCP/CLS/INP, bounce, exits and full visit duration | Not added in this release | Load/FCP and active thresholds answer immediate speed/engagement questions. Correct lifecycle/interaction measurement needs additional validation; session-based bounce/exits require a separately assessed linking design. Do not mislabel existing samples as these metrics |
| Per-letter/form/search text, supporter/opinion profiles, advertising attribution, replay | Excluded | Unnecessary for site usability; sensitive/private data and tracking fall outside this aggregate contract |

### Necessity and balancing

The legitimate interest is maintaining a usable, accurate information website. Broad independent categories and immediate counter increments answer compatibility, speed and navigation questions without retaining individual records. Less intrusive existing counts cannot distinguish browser problems or slow pages; however finer geography/versions and identifiers are unnecessary for those tasks. A campaign visit must never be treated as evidence of political opinion, parent status or support. No decisions about individuals, campaign/recruitment targeting or contribution matching are permitted.

New categories apply to fresh visitors after the updated notice is visible, or after an explicit v3 choice. Preserve v1/v2 scope and every refusal; do not silently widen existing optional Umami payloads. The notice links to the expanded explanation and offers immediate Off. Strict finite backend labels, separate dimensions, disabled application logs, private access and 365-day aggregate retention remain. No individual data survives the aggregation in the application. Cloudflare transport/security processing and seven-day recovery copies remain disclosed. Review on a new purpose/provider, privacy complaint or proposed identifier; this assessment does not establish that unrelated jurisdictions permit all collection.

### Reading the new totals

Each browser/device/referral category counts page opens, not unique users. Page-pair arrivals use the browser-provided referrer, may include reloads, and cannot reconstruct visits. Timing buckets are <=1s, >1–2.5s, >2.5–4s, >4s, or unavailable; they are not exact averages, Core Web Vitals, or evidence of reading. Small samples and tests limit conclusions. Old saved choices mean new dimensions have a smaller denominator than overall page totals. Use each metric’s own measured total and report unavailable separately.

## Two separate collectors — original deployment, 10 October 2026

The default tier uses an aggregate-only Cloudflare Worker and D1 database. The optional tier uses Umami Cloud only after an explicit detailed choice. The backend is deployed at `https://kew-riverside-statistics.analytics-backend.workers.dev`; its D1 binding, daily retention trigger and disabled Workers Logs/Traces were verified on 10 October. The 10 October release enabled `counterEnabled`; all 117 production assets and actual native Safari receipt for both collectors were verified. The 11 October anchored-arrival correction is pending release.

The earlier claim that avoiding Umami's individual-session views makes its retained individual visit records eligible for the statistical-purpose exception was unsupported. That claim is withdrawn. Umami is now consent-only. Existing Umami page and section/action/time scope remains unchanged; no identification, replay, form capture or per-letter analytics is added.

## Default aggregate contract

- Only allowlisted root public pages; Share ideas, Corrections, next-steps and unknown routes remain excluded. Canonical hostname only. Queries/fragments never leave the page.
- New visitors see an in-flow notice with How statistics work, Review choices and Turn analytics off. The compact notice sits in the persistent page-navigation area, including anchored arrivals. Its explanation and Off control must be visible before default collection starts; never scroll or focus visitors into analytics to obtain a count.
- No opt-in is required for this tier. Saved refusal, Do Not Track, Global Privacy Control, unavailable storage and unavailable config stop both tiers.
- Daily page opens, fixed broad sources, coarse viewport groups, section reach/ten-second visibility, active-time thresholds and selected action opens, plus the reviewed v3 categories above. Independent counters, not visitor histories. Source and viewport totals are global, not crossed with pages or each other. Sections are broad editorial sections, never individual letters/questions/private inputs.
- Requests contain at most 1,024 bytes and three fixed metric/label pairs. Extra fields, unknown labels, duplicate pairs, wrong origins, privacy headers, malformed bodies and unsupported methods are rejected before storage. Parameterised atomic SQL directly increments totals. No individual event rows, IP, raw UA, cookie, identity, exact timestamp or persistent retry queue is retained by the application.
- Schema: `(day, metric, label, total)`. Daily deletion removes active totals older than 365 days. D1 Free recovery history can extend seven days beyond active deletion. Worker observability is disabled; Cloudflare operational/security processing is separate. Do not claim EU-only processing or no logs anywhere.
- Private reports through authenticated Cloudflare D1 dashboard. Views/interactions, never unique people, parents, supporters or completed provider actions. Do not sum active-time thresholds as duration.
- Sole purpose: improving this website. No outreach targeting, advertising, contribution matching or sensitive classification. The statistical-purposes exception requires clear information, free easy objection, aggregate output and purpose-limited processing. Transient personal-data processing uses legitimate interests; optional Umami uses consent.

## Saved choices

Keep the existing storage key so refusals survive. Read v1, v2, v3 and v4. New explicit choices save v4; v1/v2 choices retain earlier aggregate scope until reviewed. Existing v1 basic choices keep page totals only, without widening to interaction measurement; reviewing Basic again saves v4 with the explained aggregate breadth. Existing allow retains the unchanged Umami scope. Allow lasts 180 days; basic/deny five years. Expired allow stops Umami and requires the notice before the aggregate default starts again. No choice is written automatically. The separate date-only daily-count marker is written for eligible fresh/v4 browsers after the updated notice or choice.

## Detailed Umami contract

Only `choice === 'allow'` sends to `https://gateway.umami.is/api/send`. Payload remains fixed website ID, hostname, canonical path, reviewed title, broad referrer and optional fixed event/data. Requests omit credentials and HTTP referrers. Official website/hostname headers are included. No provider script receives DOM access. Umami derives device/location and hashed visit identifiers from the connection; its individual event retention is why it requires the optional choice.

The 8 October HTTP diagnostics appeared in the account, but ordinary browser receipt did not. Empty HTTP 204 does not prove registration. Confirm an opted-in page and named event in Overview/Events before calling receipt repaired. Do not use fake browser identities to make diagnostics appear as real traffic.

## Deployment checks

1. Backend tests (`node --test analytics-backend/worker.test.mjs`), Python privacy/security, public validation and all five browser projects.
2. Independent actual privacy/diff and rendered controls reviews; native iOS check under AGENTS.md with limitations recorded.
3. Existing Cloudflare Workers Free: D1 schema/binding, observability off, daily retention cron. No website/DNS migration.
4. Use the verified assigned hostname in JS/CSP/tests; pass exact-revision gates before publishing the enabled counter.
5. Verify actual browser counter increment and opted-in Umami receipt separately. Mock interception is not receipt evidence.

## Primary sources

Checked 9–10 October 2026: [ICO conditions](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/), [Umami sending stats](https://docs.umami.is/docs/api/sending-stats), [Umami sessions](https://docs.umami.is/docs/sessions), [Umami DPA](https://umami.is/dpa), [Cloudflare DPA](https://www.cloudflare.com/cloudflare-customer-dpa/), [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).

Engineering and source reviews, not professional legal certification.

Audit sources rechecked 12 October 2026: ICO exceptions (statistical purposes, necessary transient processing, aggregation and objections) and [consent mechanisms](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/how-do-we-manage-consent-in-practice/); [MDN navigation timing](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Navigation_and_resource_timings) and [paint timing](https://developer.mozilla.org/en-US/docs/Web/API/PerformancePaintTiming). Independent evidence/privacy and UX planning reviews informed these decisions. Implementation verification is recorded in TESTING.md.


## Hourly all-page totals — candidate, 13 October 2026

A v5 eligible page open sends one separate fixed `page_hour/all` increment. The server selects the UTC hour of receipt, and immediately updates only day/metric/hour/total in the existing private counter table. No exact receipt time, page, referral, browser identity or individual event is retained with that hour. Browser estimates remain daily only. Older v1–v4 choices retain their prior scope until renewed. The visible notice describes hourly page totals before default collection; Off/DNT/GPC/private-route gates remain.

Purpose and minimisation: identify busier website-use periods to schedule disruptive maintenance and content checks with less inconvenience. All-page volumes are sufficient; no page-by-hour or audience-by-hour breakdown, outreach timing, supporter profiling or advertising use is authorised. The ICO statistical-purpose guidance says hourly aggregation may be appropriate but requires non-identifiable datasets: https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/ . This bounded assessment is not regulator certification. Database access and 365-day aggregate retention remain.

Reporting converts UTC buckets through Europe/London (including DST). Old hours cannot be reconstructed; missing rows remain unavailable rather than being imputed as zero. Current/rollout hours and earlier saved-scope undercoverage are explicit. No hourly unique-browser claim or daily-browser sum is made.
