# Website statistics

## Two separate collectors — candidate, 10 October 2026

The default tier uses an aggregate-only Cloudflare Worker and D1 database. The optional tier uses Umami Cloud only after an explicit detailed choice. The backend is deployed at `https://kew-riverside-statistics.analytics-backend.workers.dev`; its D1 binding, daily retention trigger and disabled Workers Logs/Traces were verified on 10 October. The candidate enables `counterEnabled`. **Website release and actual browser receipt are pending.**

The earlier claim that avoiding Umami's individual-session views makes its retained individual visit records eligible for the statistical-purpose exception was unsupported. That claim is withdrawn. Umami is now consent-only. Existing Umami page and section/action/time scope remains unchanged; no identification, replay, form capture or per-letter analytics is added.

## Default aggregate contract

- Only allowlisted root public pages; Share ideas, Corrections, next-steps and unknown routes remain excluded. Canonical hostname only. Queries/fragments never leave the page.
- New visitors see an in-flow notice with How statistics work, Review choices and Turn analytics off. At least half of the explanation must enter the viewport before default collection starts. Anchors or restored Back positions can skip it: never scroll or focus visitors into analytics to obtain a count.
- No opt-in is required for this tier. Saved refusal, Do Not Track, Global Privacy Control, unavailable storage and unavailable config stop both tiers.
- Daily page opens, fixed broad sources, coarse viewport groups, section reach/ten-second visibility, active-time thresholds and selected action opens. Independent counters, not visitor histories. Source and viewport totals are global, not crossed with pages or each other. Sections are broad editorial sections, never individual letters/questions/private inputs.
- Requests contain at most 1,024 bytes and three fixed metric/label pairs. Extra fields, unknown labels, duplicate pairs, wrong origins, privacy headers, malformed bodies and unsupported methods are rejected before storage. Parameterised atomic SQL directly increments totals. No individual event rows, IP, UA, cookie, identity, exact timestamp or persistent retry queue is retained by the application.
- Schema: `(day, metric, label, total)`. Daily deletion removes active totals older than 365 days. D1 Free recovery history can extend seven days beyond active deletion. Worker observability is disabled; Cloudflare operational/security processing is separate. Do not claim EU-only processing or no logs anywhere.
- Private reports through authenticated Cloudflare D1 dashboard. Views/interactions, never unique people, parents, supporters or completed provider actions. Do not sum active-time thresholds as duration.
- Sole purpose: improving this website. No outreach targeting, advertising, contribution matching or sensitive classification. The statistical-purposes exception requires clear information, free easy objection, aggregate output and purpose-limited processing. Transient personal-data processing uses legitimate interests; optional Umami uses consent.

## Saved choices

Keep the existing storage key so refusals survive. Read v1 and v2. Existing v1 basic choices keep page totals only, without widening to interaction measurement; reviewing Basic again saves v2 with the explained aggregate breadth. Existing allow retains the unchanged Umami scope. Allow lasts 180 days; basic/deny five years. Expired allow stops Umami and requires the notice before the aggregate default starts again. No choice is written automatically.

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
