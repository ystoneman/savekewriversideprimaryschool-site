# UX design decisions

## Newest community letters first — 8 October 2026

Visitor need (J4): readers should find newly published letters at the top, as the owner requested after recent additions were hard to find below older entries. Render validated letters by descending publication date; because dates have day precision, later additions in the source list lead same-day ties. Sort a copy of the data, preserving stored records, letter IDs, full text, assessment labels and individual links. The reading/writing entries and form stay in place. Regression coverage uses mixed-date fictional entries and day ties; existing incoming-link, expansion and Back checks continue to cover older letters after sorting. Implementation and release verification are recorded with the associated pull request.

## Full school name on the site — 1 October 2026

Visitor need (J1–J9): the shared brand and appeal must identify Kew Riverside Primary School clearly, including when a page or image is shared without surrounding context. The owner's phone screenshot showed the shorter name in the header and opening appeal.

Decision: use the full name in the brand, appeal and editorial material. Break the header brand after “Riverside” to keep the existing icon, action tiles and Menu legible on narrow screens. Begin the appeal with “Keep” so the full name fits without reducing its type size. Keep the Parent action plan and official response in their protected arrival positions. Expose the full name in text-based graphics, downloads and accessible labels as well as the rendered page. Direct quotations and submitted letters retain their authors' wording.

Alternative considered: shrinking the brand and heading to retain single-line text. The two-line treatment maintains readable type and a clear hierarchy. The priority release's focused 375 × 667 and 390 × 844 iPhone WebKit arrival checks found and resolved response-button displacement; its hosted candidate checks and live asset verification are recorded in TESTING.md and CHANGELOG.md. A later, wider editorial and downloadable-asset sweep receives its own rendered review and checked deployment. No journey priority, destination or consent choice changes.

## Simple parent testimonials — 1 October 2026

The owner wanted a stressed parent to reach the main button without scrolling, understand that this is a parent testimonial for prospective families, and keep children off camera. The approved mockup places the CTA immediately after the short consent cue, then three illustrated rules: adult filming, 30 seconds–3 minutes, and no council-consultation discussion. The private-praise invitation and background-audio exclusion are removed. This refines J9's contribution route in support of J8; it does not replace J3's official response or J4's written alternative.

Keep one optional Help disclosure for prompts, process, recording guidance and full permission consequences. Expose saved-permissions upload recovery separately. Older section anchors reveal Help when scripts work; static HTML remains open if scripts fail. Remember the disclosure state only in its history entry so browser Back can restore a deep reading position. Existing scopes and independent optional choices remain visible beside the action and in the forms; no new global navigation row is added.

Independent campaign and UX reviews covered the plan and actual implementation. Rendered mobile/desktop evidence shows a complete first-screen button at 320 × 568 in light/dark and without scripts, with no horizontal overflow. Native simulator arrival was visually checked; automated and hosted results are in TESTING.md. The owner approved this mockup and requested deployment without an unfamiliar person's real-phone trial; do not describe these builder checks as that trial. Both-site publishing status is tracked in CHANGELOG.md.

Recorded: 22 September 2026. Status: implementation in progress; final verification and publication are recorded separately in [CHANGELOG.md](CHANGELOG.md). This is a design rationale, not a report of a user study or a claim that every visitor will complete these tasks successfully.

## Purpose and constraints

Help people understand the proposal, check its evidence and take useful action in support of Kew Riverside. Visitors should quickly distinguish a proposed outcome from a decision, an official council response from a contribution to this independent website, and verified figures from forecasts or unanswered questions.

The owner's feedback identified practical needs: make participation easier to find, explain the next steps for families, make the financial figures understandable, and keep navigation usable on an iPhone. The growing collection also needs clearer entry points. These inputs justify the changes below; they do not establish how representative any preference is across the wider community.

Keep the static site, working incoming links, source citations, accessible tables and separate publication permissions. The site takes no donations. A funding idea is a suggestion, not a payment or pledge.

## Protected visitor journeys

Adopted 22 September 2026 for ongoing change review. Owner: Yann Stoneman; the implementing agent maintains this register when an intentional change affects it. These priorities reflect the owner's goals and inspection of the site, not a measured ranking from a visitor study. This section is the canonical current register; the dated decisions below explain its history.

The attempted September domain cutover was rolled back after mobile visitors received an unstyled page while the new domain's HTTPS certificate was unavailable. The later checked migration established `https://savekewriverside.org/` as the canonical address; the old GitHub Pages address now forwards page routes to it. The canonical site's full-name priority release was verified on 1 October. Existing page routes and anchors remain (J1–J9). Migration and release evidence are recorded in CHANGELOG.md and TESTING.md.

Priority allocates attention; every existing task retains usable access. Visitors may start with an action, evidence or a family question. Do not require them to follow a learning sequence before reaching their destination. The ranking of campaign options on the dedicated Options page is separate from journey priority.

| ID / emphasis | Visitor outcome | Protected entry and destination |
| --- | --- | --- |
| J1 · Essential orientation | Understand the proposal, current decision status and relevant dates | Homepage status/date information, `proposal.html`, `faq.html` and directly cited official records; distinguish proposed, conditional and decided outcomes. |
| J2 · Prominent action | Find what I can usefully do now | Named Parent action plan shortcut visible on homepage arrival, plus shared navigation to `proposal.html#parent-plan`; no disclosure or familiarity with the containing page required for the shortcut. |
| J3 · Prominent action | Give my views to the decision-maker | Explicit official-response links and current verified deadline/stage; a website letter, idea or video does not replace an official response. |
| J4 · Prominent participation | Read community experience or write a letter | Exposed Community letters / Read & add yours header tile to `letters.html`, with the letters board directly after the form, reading and writing shortcuts, and independent permissions (optional quoting only on top of publication). |
| J5 · Prominent participation | Offer an idea, evidence, question or correction | Exposed Share ideas / Ask or suggest header tile to `feedback.html`, with visible category cards, contextual category links and clear private/public choices. |
| J6 · Easy to discover | Understand and check the case | All six homepage task destinations; Understand, `options.html`, Evidence navigation and findings at `evidence.html#records`, with a visible source-search shortcut to `evidence.html#source-search` (and `index.html#records` retained as a compatibility entry); the full report and readable research through the homepage shortcut, Evidence and existing proposal route. Educational evidence at `understand.html#learning-and-results`, reached through the existing comparison/visit areas and `faq.html#learning`. Preserve sources, charts/tables, filters, direct anchors and downloads. |
| J7 · Protected family task | Understand my child's practical next steps | Homepage child-next-steps card and `faq.html#school-places`; distinguish current-family contingencies from prospective-family admissions and preserve both. |
| J8 · Contextual recruitment | Decide whether to enquire about the school | `index.html#visit-school` with a direct current school enquiry route and proposal context; related `options.html#option-enrolment` route. Reading campaign strategy is not a prerequisite. |
| J9 · Contextual participation | Contribute in another format or offer further help | Existing Parent plan, letters and ideas links to `videos.html` (including the fixed shared QR address `videos.html#upload`), `supporters.html` and relevant help categories; preserve written alternatives and older shared links. |

Across all journeys, preserve About/contact, corrections/removal, privacy, the checklist, source CSV, research source register, accessible tables and source links. Lower visual emphasis does not justify hiding or removing these routes. Maintain readable text, keyboard operation, useful no-JavaScript access and recovery through Back, clear/reset and incoming anchors.

### Placement and change criteria

- Keep Letters and Share ideas outside the collapsed mobile Menu. Protect the Parent action plan shortcut's arrival visibility at the established normal-text 320 × 568 baseline and check wider layouts. Enlarged text may reflow; do not shrink it to satisfy a first-screen assertion.
- Prefer an existing destination and short contextual entry for new material. For the remaining Sofiya feedback plan, start with no additional global navigation items or standalone homepage bands. This is a scoped design budget, not an absolute ban: any exception needs a concrete visitor need, the cost to existing tasks and a tested rationale.
- Keep essential meaning, dates, consent and claim-changing limitations visible at the point of use. Disclose optional depth with descriptive labels. Keep the official response distinct from site contributions and recruitment enquiries.
- Preserve canonical URLs, anchors, remembered search terms and the original-source/site-synthesis distinction. Keeping a URL alive is insufficient if its entry point disappears or filters conceal it.
- Use the completed report-discovery release as the starting baseline for later changes. Inspect the current checkout and verified release in `CHANGELOG.md`; do not treat a dated screenshot or pre-release review as the current layout.

For each material change, record the visitor need and journey IDs; canonical destination and entry label; existing tasks potentially displaced; added space/attention/interactions and how those costs are contained; retained links/search terms/downloads; actual checks; and owner/review trigger. The specialist workflow in [AGENTS.md](AGENTS.md#specialist-reviews) supplies the relevant review lenses.

- Pages whose job is to hand visitors on to a form or upload, such as Share a video, keep one main action on the first screen at 320 × 568, 375 × 667 and 390 × 844 in both appearances, on arrival from the site’s own links and shared links, labelled with what happens next. The next screen must deliver what the label promises. Letters and Share ideas keep their accepted form layouts.
- Put safeguards beside or after the action they qualify, not in front of it. Say each thing once and link to the full notice; consent wording stays where people tick.
- Primary buttons must stand out at least 3:1 from their background in light and dark appearance, not only have readable text.
- The Menu is curated: adding an entry means removing or merging one, with the owner's agreement. A generated page label does not by itself earn a Menu row.
- For J2, J3 and J7, keep a written path record: entry points and their arrival position at 320 × 568 and 390 × 844, the taps, reading and decisions to the real action, and what sits in between. Judge it with emphasis and scroll depth rather than a universal click count. A change that adds a tap, decision, competing link or screen of scrolling needs a stated reason and the owner's agreement. Before shipping a participation change, watch one person who did not build it try it on a real phone from a realistic entry point.

### Verification and maintenance

Start journey checks at realistic entry points, not only known destination URLs. Automatic all-page/link discovery tests must be supplemented by independent expectations for protected entries: a removed link must not disappear silently from the test's own input. Review relative emphasis and scroll depth as well as clicks; avoid a universal click-count rule or pixel-perfect snapshots as the sole usability test.

Follow `TESTING.md` for changed behaviour. Inspect narrow and desktop rendering, keyboard/focus, no-results recovery, direct links, Back and no-JavaScript paths where relevant. Run native iOS checks for affected touch/focus/menu/mobile changes when available and distinguish them from browser emulation. Use fictional data and intercepted submissions. Record checks actually run; automated success is not proof that unfamiliar visitors can find something.

Review this register when user evidence changes a priority, an official process stage/date changes, a provider changes the contribution experience, or a new feature would displace an existing route. Verify date-sensitive content from its maintained sources. Update the current register deliberately and record the reason below; do not copy live dates or entire source findings into specialist skills. No new analytics or scheduled automation is required by this process.

## Options considered

| Option | Decision and reason |
| --- | --- |
| Task-based homepage routes | Implement six visible routes so visitors can start with their question instead of learning the document structure. Keep the original evidence and action sections available. |
| Dedicated FAQ with local search | Implement 12 sourced answers on a separate page. Search filters the page's existing answers; it does not generate advice. Use native disclosures for individual answers, with essential status and deadlines visible outside them. |
| Clearer participation labels and icons | Use **Community letters / Read or write** and **Share ideas / Evidence & suggestions**. The supporting words explain the destination; simple decorative icons help recognition without carrying the meaning alone. |
| Future timeline separate from historical record | Give the upcoming process a six-stage timeline, marking later stages as conditional. Put the longer historical record in a labelled native disclosure. |
| Shorter, single-column contribution form | Keep one page with six categories, a clear main message field and optional details disclosed when relevant. Keep the reviewed public board available below the form. |
| Multi-step contribution wizard | Defer. The core submission is short; extra screens would add navigation and state without an established need. Reconsider if required questions grow. |
| AI question answering | Defer. First see whether the sourced FAQ and simple filtering meet the need. Generated answers would add factual, freshness and privacy requirements. |
| Homepage tabs or a carousel | Defer. Visitors need to discover the routes together, and some need to compare them. Avoid making essential destinations depend on selecting a hidden panel. |
| Heavy generated imagery | Defer. Use readable typography, spacing, simple local icons and evidence-based charts. Decorative imagery should have a clear visitor purpose before it adds download weight or competes with facts. |
| Complete information-architecture migration | Defer. Improve entry points while retaining established pages and anchors. Consider larger restructuring only after evidence of persistent difficulty. |

These choices are design judgments to verify, not measured conversion improvements.

## Selected page and interaction design

### Shorter first reading layer — 6 October 2026

Visitor need (J1/J6/J7): the follow-up cognitive-load audit found that the research update exposed too many figures, document discrepancies and record requests before readers chose to go deeper. The owner requested the recommended simplifications. Keep current facts and claim-changing qualifications beside the conclusions; make technical depth optional.

Use the existing Evidence cards for one explanation each. Remove their three duplicate jump links while retaining all target IDs; Demand, Closure costs, historical cases and immediate source search remain discoverable. Put the detailed child-provision requests in the existing unanswered-question destination rather than add three more controls to the introduction. Original source links, private contribution routes and safeguards remain.

On Numbers & results, expose the annual forecast, accumulated endpoint, indicative status and short reserve-conflict note. The native **Year-by-year forecast and calculation** disclosure at `#budget-forecast` holds the table, reserve bridge and £1 reconciliation. This adds one activation for a reader choosing technical depth, and removes that table and calculation from the default reading layer. FAQ answers explain the measures with one annual example and link directly to this disclosure; the existing script reveals incoming targets, and the native summary works without scripts. Recovery-plan depth keeps the alternative-specific tests with less repetition and plainer funding/timing language.

Rejected: removing inconvenient evidence, hiding essential qualifications, adding new global navigation or new controls to every card, and shrinking type. Homepage priorities, forms, permissions and recruitment materials are unchanged. Independent UX/evidence planning and implementation review and measured/rendered verification are recorded in TESTING.md and CHANGELOG.md. These checks do not establish comprehension by unfamiliar visitors.

### Current Kew findings on the existing Evidence route — 5 October 2026

Visitor need (J1/J3/J5/J6/J7): people checking the current proposal should reach the most useful Kew findings before the historical comparison collection. Keep `evidence.html#records` as the canonical arrival, labelled **Current Kew findings** in the local section menu. Three visible summaries explain money, alternatives and places; optional native disclosures hold dated demand comparisons and contract/account limits. Claim-changing qualifications and supporting source links remain beside each finding. `#kew-finance`, `#kew-alternatives`, `#kew-places`, `#kew-demand` and `#kew-costs` provide direct routes. No global menu row or homepage band is added, and the six homepage destinations retain their order.

The cost is additional reading before the historical cases, now reached by the descriptive local **London cases** link at `#london-findings`. The immediate source-search shortcut, earlier case/source anchors, remembered search terms, historical report, tables and downloads remain available. Visitors need not open optional depth before responding. Contextual evidence and question links use the existing private-review form categories; they request public documents or aggregate facts without child details, and do not send a council response. The official deadline and separate family route remain prominent. Recruitment blocks and pages receive no campaign additions.

The owner requested implementation and a reviewable PR, with publication excluded. Independent campaign/evidence/UX reviews inspected the plan and actual implementation. Rendered Chromium/WebKit checks covered 320/390/1440 widths, light/dark, no scripts, keyboard disclosures, category handoff, source recovery and Back. The new section also reflows at 200% main-text enlargement; pre-existing full-page no-script overflow at 320px remains a recorded limitation. Native Simulator input was unavailable, so no successful native interaction or unfamiliar visitor trial is claimed. Automated delivery results and source-check dates belong in TESTING.md and the source records. Journey priorities are unchanged.

### Tuesday rally information — 1 October 2026

J1/J2/J3/J9: parents need one shareable event address with the schedule, location, access status and photo choices. `rally.html` is reached through one dated line after the Parent plan action shortcuts. A new homepage band or global menu item would compete with protected family and official-response entries; the contextual route contains that cost. All September event anchors remain, clearly marked as past. The tentative calendar includes the pending gathering/access status and uses UTC for 6–6.45pm London time. Map and calendar are native links; no new script, embed or collection is needed. Essential status and photo guidance stay visible. Check venue confirmations before changing the location/access claims and retire the invitation after 6 October while preserving its address. Independent planning reviews completed; rendered implementation and release checks pending.

### Video route for families choosing a school — 28 September 2026

Visitor need (J3, J8, J9): the owner confirmed that Parent Voices videos exist to help families choosing a primary school, not to argue about the proposal. Recent submissions did not fit that purpose: children appeared on camera, and a video addressed the closure. The page never named its audience. Every entry point sat inside the council-response flow, and one prompt asked what the council should understand.

Decision: name the audience at the point of use and redirect views on the proposal to the official response, without adding elements. The lead and card summary say the videos are for families choosing a school; the summary says a video “may be” posted, matching “Publication is not guaranteed”. The council line under the steps opens “Views on the closure proposal?” and keeps its single official link and date (J3). Two prompts now ask about everyday school life, and “What happens next” says videos mainly about the proposal are not posted, with another route suggested. Entry links on Letters, Share ideas and the Parent action plan describe the audience. On Share ideas the video link leaves the “Personal view?” sentence. The plan's video link moves from step 1 (Share what matters) to its own line in step 5's visible text, with “Adults only.”, and the jump link becomes “Letters”. Consent wording, the channel name and the Menu are unchanged.

Cost: the video page gains 32 words (5 above the button); plan steps 1 and 5 lose 22; no links, buttons, sections or disclosures were added. At 390 × 844 the card summary wraps to four lines, moving the button down 26 px; it stays on the first screen from both the page top and `#upload`. Reaching the video from the plan now needs more scrolling, which is intentional because the video is not part of responding.

Rejected: a “Talk about / Leave out” list in the card (about 80 px, pushing Step 2 below the first screen at 320 × 568); a longer lead (pushed the button off the first screen from the top at 390 × 844); an absolute ban on mentioning the proposal (reads as muting keep-open parents); renaming the channel (the consent wording names it). Provider pages carry the rules for every uploader; their text is edited separately by the owner.

Reviews: independent campaign and UX planning reviews, then independent implementation reviews of the diff. Verification is recorded in TESTING.md; this is not a user study.

### Owner-delegated decisions — 27 September 2026

The owner asked the implementing agent to decide the open points. Understand becomes **Numbers & results**, which covers finances, forecasts and learning results, and Options becomes **Ways to keep Kew open**, matching its homepage question. Evidence stays, being already clear. The labels change together in page identity, Menu, desktop row and homepage cards; the URLs and anchors are unchanged. “Respond to the council” gains the Parent action plan’s emphasis in the Take part group, because the official response is the campaign’s most important action (J3).

Two stated deviations are accepted. At 320 × 568 the council reminder starts just below the video permission button, because fitting both would mean shrinking text or cutting consent wording. The Proposal page keeps two response buttons for its two arrival points. The unmatched-upload rule (no viewing, one reminder, delete after 14 days) is operational and recorded in VIDEO-PERMISSIONS.md.

A live end-to-end test in native iOS Safari confirmed the full route: three taps from the homepage to the permission form, no sign-in, and a completed Dropbox upload. It also exposed a provider-side problem that no automated test could see: an unbreakable form address in the Dropbox description cut off every line on phones. The fix uses the website’s hyphenated address instead.

### Grouped, curated Menu — 27 September 2026

Visitor need (J1–J9): the owner found the 17-link Menu cluttered and confusing (“I'm getting a little lost again”). The navigation builder produced it by listing every registered page, so each new page added a row without anyone deciding the Menu's size. The owner approved the grouped rebuild in the private plan and asked for it straight after the Phase 0 release.

Decision: the Menu comes from a curated list in three labelled groups: Take part, Understand the proposal and This website. It has 13 links, including the owner-requested Unanswered questions line. “Respond to the council” leads the Take part group so website contributions are never presented as the official response; it opens the site’s own `#take-part` explanation of the council’s response routes. Lessons, Supporters, Corrections and Research citations move to every footer, which the builder now generates from `FOOTER_LINKS`, alongside Privacy and Analytics choices. Lessons keeps its homepage research shortcut and Evidence routes (J6). Menu labels match page names, except that About appears as “About & contact”, as in the footer, to keep the contact route visible; action links such as Respond, Parent action plan and Unanswered questions never claim the current page.

Rejected: nested disclosures inside the Menu (an extra tap per group); moving Letters and Share ideas out because they have header tiles (the tiles scroll away on phones, so the Menu is their only route further down a page); renaming Understand, Options and Evidence in the same release (the owner has not decided, and a rename must reach page labels, homepage cards, footers and tests together).

Cost: at 375 × 667, Home and About need a short scroll inside the open Menu; at 320 × 568 Evidence and below do. These are the least-used entries, and the brand link also leads home. The Menu stays scrollable on short landscape screens.

An independent UX implementation review (headless Chromium, 320 to 1440 px, light and dark, keyboard, no JavaScript, 200% text) found one real problem: the longer footer ran off landscape phones and tablets on FAQ and Understand, which don’t load `community.css`. The footer wrap rules now live in the shared `orientation.css`, and a test checks every page at 667 × 375 for no horizontal overflow. Whether “Respond to the council” should also get the bold Parent action plan styling is left to the owner. Verification is recorded in TESTING.md; this is not a user study.

### Video route, dark-mode buttons and top journeys — 27 September 2026

Visitor need (J2, J3, J7, J9): on 26 September a first-time visitor tapped three times and still could not find where to submit a video. The owner also found the Menu, which had grown from 7 to 17 links in two days, hard to use. The owner approved the analysis and plan (kept privately in the parent workspace) and asked for this release on 27 September. The private monitor recorded no permission forms or uploads between 22 and 26 September; low traffic may also contribute, so this is not a measured cause.

Diagnosis: “Start your video submission” opened a permissions-only form of about 800 words with no upload field; the upload followed on Dropbox. On the video page the button came after 124 words and three competing links, and in dark mode it matched its card (1.0:1). Every safeguard had been added in front of the action, and the Menu builder listed every page. Tests intercepted the handoff, checked text contrast only, and pinned both the reminder-before-button order and the “Parent Voices” label, so none caught the problem.

Decisions:

- **Share a video.** The page label and Menu entry say what the page is for; Parent Voices stays the YouTube channel name. The card shows two numbered steps: the main button says “Give permission”, and step 2 says the upload link follows Submit. The council reminder moves from in front of the button to directly after the steps, with its date and official link, and stays in view on arrival at `#upload` at 375 × 667 and 390 × 844. At 320 × 568 the permission step fits and the reminder starts just below it; fitting both would have meant shrinking text or cutting consent wording. This is a stated deviation from the approved plan, raised with the owner. The Menu and every in-site video link now open `videos.html#upload`, as the flyer QR code does, because from the top of the page the permission step was still a screen down on common phones. The returning-visitor Dropbox link moves below the reminder so the main path stays permission-first. The short page drops its “On this page” list.
- **Menu order.** Participation routes follow the Parent action plan, so Share a video is visible without scrolling the Menu at 320 × 568. This is an interim step before the grouped Menu rebuild. It pushes FAQ below the first screen of the open Menu at 320 × 568; FAQ stays in the Menu, the homepage cards and the footer.
- **Dark-mode primary buttons** use the existing dark teal with dark text, matching the Options response button. Lime is left for the Parent action plan spotlight and the Share ideas tile so their hierarchy is kept.
- **Top journeys.** The owner confirmed this focus for the response period: J3 (respond by 16 October), J1, J7, J2 with J6's unanswered questions, then J4/J9/J5, J6 depth and J8. “My child’s next steps” now leads the six homepage routes. The homepage hero lost its duplicate label and some phone spacing so the response button fits the first screen at 375 × 667 and 390 × 844, with text sizes unchanged. The Parent action plan's opening sentence gains its own response button, because visitors arrive at `#parent-plan` below the page-top deadline panel. That panel stays for page-top arrivals, so the page now has two response buttons about two screens apart; the owner is asked to confirm this. The homepage’s no-JavaScript saved-search note moved below the hero so the response button also fits without scripts. Dated plan steps change by normal release after 29 September, not by script. After 16 October, a normal release must also update the three new dated lines: the video card’s council reminder (keep “not an official response” and link `proposal.html#take-part`), the plan’s opening sentence and the homepage response button.
- **Providers.** The permission form's title and first line say there is no upload on that page, and its confirmation leads with the upload link. The Dropbox description starts with a link back to step 1. The optional filming prompts stay where they are; moving them needs a reliable editor drag, which is left for manual editing. Consent wording and notice versions are unchanged.

Rejected: moving the page-top Proposal deadline panel into the plan (it would push the response down for page-top arrivals); exposing the Dropbox upload as a second button (it invites uploads before explicit consent); shrinking headings to meet first-screen targets; a runtime reorder of the plan steps (stale text without JavaScript and moved sections after arrival).

Verification and review status are recorded in TESTING.md. Automated first-screen and contrast checks are not a usability study. The owner asked for release before the observed attempts, so this release ships ahead of the new rule’s real-phone check: the owner’s own end-to-end upload and an unaided parent attempt from a WhatsApp link follow it and are recorded when done.

### Optional paid-ads permission for videos — 26 September 2026

Visitor need (J9): contributors should decide separately whether their video may appear in paid ads, which reach people who did not choose to watch and can remain in public ad libraries. Options: fold ads into YouTube permission (rejected: changes an agreed scope); two checkboxes for recruitment and consultation ads (rejected for now: a fourth permission adds friction for a small, local pool); one optional checkbox naming both purposes and excluding fundraising (chosen). Placement: after news-media on both forms and in the existing video-choices disclosure; no new navigation, homepage content or required step. Earlier records keep their scope; paid ads for an earlier video need a private, dated agreement to the full wording. Verification: browser assertions in `videos.spec.js`; live forms checked in preview without submitting.

### Prioritised unanswered questions — 25 September 2026

Visitor need (J1, J3, J6–J8): the newly exposed Unanswered questions menu route should explain which answers matter, rather than require parents to infer them from document titles. The owner approved eight questions in this order: conditions for keeping Kew open; children’s outcomes; why Kew was selected; net closure costs and site use; costed alternatives; recruitment support; pupil and housing forecasts; and written answers. This is an editorial priority, not a measured parent ranking or an agreed school/PTA meeting script.

Keep the existing `evidence.html#gaps` destination and five named question anchors. Use the existing single-column native disclosures, with all question titles and status labels visible; distinguish Known from Still unanswered inside. Separate resolved inspection evidence and future/background record tracking below the eight unresolved questions, retaining their source routes. Link to maintained financial, options and family explanations rather than duplicating their full answers. No new homepage band or global menu entry is needed.

The overview stays collapsed when scripts run, while a direct question link opens only its own record. A repeated same-fragment link reopens a question after it has been closed; modified clicks retain their normal behaviour. Static-open HTML remains readable when scripts fail or are disabled. The existing local navigator follows the new priority order and includes resolved/background destinations. Dates describe only the requests actually sent; new questions are not represented as dispatched. Responding to the council remains possible without waiting for answers.

Independent planning review identified the overview-expansion and repeated-link issues before implementation. Evidence/campaign implementation review confirmed capacity qualifications, council commitments, family choice, privacy and the distinction between requests and answers. Rendered review and completed checks are recorded in TESTING.md; deployment is verified separately.

### Unanswered questions menu shortcut — 25 September 2026

Visitor need (J6): parents want a direct way to find the questions and evidence gaps that remain unresolved. The owner approved exposing this destination through the main menu. Add **Unanswered questions** as a visible, indented link immediately after Evidence once Menu is open, targeting the existing `evidence.html#gaps` section. Use the same label for the section heading, its local navigator entry and its introductory shortcut.

The placement adds one row within the existing scrollable menu. An additional nested disclosure would add an unnecessary interaction, while another exposed header control would compete with existing participation routes. Keep the native anchor, existing section URL and all question content, and preserve the exposed Community letters and Share ideas tiles and Parent action plan. This is a navigation judgment, not a measured usability result.

Independent UX planning review supported the direct sub-item and consistent wording. Before release, verify rendered desktop/mobile menu access, visible heading arrival, repeated same-page activation, keyboard and no-JavaScript navigation, and protected routes. Implementation verification and publication are recorded in TESTING.md and CHANGELOG.md.

### Page and section orientation; plain Proposal questions — 24 September 2026

Visitor need (J1–J9): the owner wants to know which page and subsection they are reading while scrolling, distinguish homepage shortcuts from a second menu, and make Proposal questions manageable for a busy parent. The approved navigation plan, including the full verbatim Proposal suggestions, is retained privately in the parent workspace. These changes preserve the protected journey priorities.

Decision: render a stable page name, one full Menu and a curated On this page navigator on every applicable page. The large arrival header scrolls away; one compact bar remains. Page identity is static HTML; current-section tracking is a progressive enhancement. Full Menu includes Options and Lessons at all widths, with About immediately after Home and Parent action plan retained as a separate shortcut. FAQ is the visible h1. All six homepage question cards now name their exact menu destination and any relevant section.

The section list is a popup at all widths, retaining reading/chart width and the same controls across devices. Its current location includes a parent section where useful; passive scrolling changes neither the URL/history nor focus and makes no live announcements. Explicit section links open their destination, preserve native history and move focus to it. Filtered or closed content cannot become the active section. One copy-link control inside the section navigator shares the current section, with a selectable URL fallback if clipboard access fails; repeated buttons beside every heading would add clutter. At enlarged text, page identity takes a full row and the secondary trail yields to the section control. Menu height follows the actual remaining viewport; main headings may wrap long words.

Content ownership: future schedules belong on Proposal & dates. Evidence keeps its earlier public record and existing #timeline address, now a short handoff to the canonical timetable and family guidance. Brief contextual date/action reminders elsewhere remain appropriate. The six Proposal questions keep their IDs but put children first, remove repeated fold-outs and explain the council claim, missing information and useful request in one short block. Primary citations stay beside claims and each question has one explanatory route. The Proposal research PDF opens normally and is labelled optional; existing checklist/report download routes elsewhere remain.

Accuracy refinements to the supplied suggestions: acknowledge the council FAQ’s sibling-together commitment; distinguish the dated revenue reserve and accumulated projected deficit from annual spending and closure savings; label the existing forecast check as one Kew-area period; do not imply alternatives are already funded or workable. The request note names the verified sender, recipients and channels without private contact details. About’s AI disclosure accurately covers research and writing and retains the owner’s responsibility.

Review: independent evidence, campaign and rendered UX implementation reviews found no remaining actionable findings after fixing short-screen menu bounds, enlarged page labels, Letters heading wrapping and section-list layout. Rendered review covered 320/390/1440 px, light/dark, keyboard, selected deep/filter links and no JavaScript. Automated regression and release evidence is maintained in TESTING.md and CHANGELOG.md; this is not a user study or a claim of full accessibility conformance.

Arrival and return behavior: final styles must be applied before measuring the persistent bar or revealing incoming fragments. The existing pre-paint theme script supplies that stylesheet barrier, followed by navigation and then page-specific initializers. A reproduced WebKit external-return reset also needs a bounded fallback: preserve native restoration whenever it produces a nonzero position, recover a saved departure only at zero, and cancel for changed state, navigation, manual form recovery or new user input. Coordinates stay in the current browser history entry and are consumed after one assessment; there is no persistent reading history or passive URL rewriting. Independent UX review identified stale-marker and accessibility-input cancellation risks, addressed in the final design. This does not promise pixel-identical native Back restoration on every browser. Verification details and publication status are in TESTING.md and CHANGELOG.md.

Maintenance: `.github/scripts/build_navigation.py` owns the shared static navigation and its curated landmark registry. Run it after shared navigation changes; Lessons and Understand generators call the same renderer. Keep the script version consistent across all normal pages. The `/visit/` handoff remains a separate lightweight redirect.

### Permanent flyer enquiry link — 24 September 2026

J8: a family scanning a printed flyer should reach the school's current enquiry route while the printed address stays useful when bookings move. Use the human-readable `/visit/` address, initially pointing directly to the school contact page. A future registration destination must be verified before changing it. No homepage space, menu item, campaign reading or extra choice is added; existing proposal context and enquiry routes remain in place, as does the separate video QR.

An immediate HTML refresh and descriptive native link provide the handoff without scripts or analytics. A commercial dynamic-QR provider adds an unnecessary dependency; a JavaScript-only redirect would exclude visitors with scripts disabled. A second `/qr/` alias is unnecessary. Maintain matching refresh/link destinations with regression coverage and instructions in README. The route is an explicit exception to shared menus, with its own Back, narrow-screen, keyboard/touch, no-JavaScript and disabled-refresh checks; all public pages retain automatic link/security validation. Independent campaign and UX reviews covered planning and implementation, with no remaining actionable findings. Rendered fallback, no-JavaScript, keyboard and Back checks passed. Published as `f171ded` after both hosted suites passed; the live redirect matched the committed file and passed eight live handoff/Back checks. Verification is recorded in CHANGELOG.

Update, 27 September 2026 (J8/J9): open-day flyer organisers need the image, not just the address. `qr/kew-riverside-visit-qr.png` and `.svg` encode `https://ystoneman.github.io/kew-riverside-website/visit/` with its trailing slash, avoiding GitHub's extra redirect. They sit in their own `#visit-qr` paragraph beside the homepage QR in the Parent action plan's "More ways to help" disclosure, not on the homepage visit card, so enquiring families gain no extra choice. Link names start "Homepage" or "Visit" so each is distinct out of context. The visit paragraph says a future registration destination is planned, not promised, and asks makers to keep closure campaigning off open-day flyers and to agree wording with the school or PTA when using their branding; the own-name caveat stays with the campaign homepage QR. Organisers are sent the direct file URLs, because an incoming fragment does not reliably open the closed disclosure.

### Evidence and numbers: findings before navigation — 24 September 2026

Visitor need (J6): the owner's follow-up clarified that a directory of links still made readers do the work. They want findings such as how many nearby schools changed a proposed closure and how. The earlier navigation-led Evidence design below is superseded by this decision; the optional-detail approach remains.

Decision: `evidence.html#records` now opens with four selected London schools, visibly split into three schools whose proposals were rejected in two adjudications and one that continued as an academy. Three short accounts give the reason and outcome directly, with named case and primary-source links. The selected-sample limit and absence of a verified Richmond case in this collection are visible beside the counts. A separate Kew takeaway explains which questions these cases suggest, including the limits of transferring legal/governance routes. Understand opens with three dated, substantive findings on pupils, finances and the forecast check before its topic links.

Rationale: put the answer before the choice. Headings communicate conclusions, related numbers stay together, and each case follows the same outcome/reason/source pattern. This gives readers a small number of meaningful chunks without hiding scope-changing qualifications. Charts, underlying tables and the full source catalogue remain optional depth. This is an editorial/design judgment responding to the owner's feedback, not a measured psychological benefit.

Cost and recovery: the findings add reading space above the source controls. A visible “Looking for a source?” shortcut bypasses them; saved filter URLs retain their query parameters and normalize an initial empty or `#records` fragment to `#source-search`. Existing incoming URLs remain compatible; native and scripted fragment recovery then agree on the search destination. Direct source, chart and case links still reveal their destination. Ordinary “Key findings” clicks continue to return to the findings even with filters active. No global navigation, participation priorities, source records or exports were removed.

Review and verification: independent evidence, campaign and rendered UX reviews found the final copy and hierarchy appropriate after the Kew-area forecast wording was clarified. The first saved-search scroll fix passed macOS checks but failed hosted Linux WebKit; canonicalizing the initial search anchor replaces that competing-scroll approach. The reviewer approved this deliberate URL-contract correction, retaining incoming compatibility and one-step Back. UX inspected 320/390/1440 px, light/dark appearance, enlarged text, source escape, Back, no-JavaScript access and repeated saved-search arrivals in Chromium/WebKit. The final revision was published as `0cdd563` after the corrected PR and main full suites passed. Live desktop/mobile checks and the native Safari saved-query arrival passed; native taps and Back remain unverified. Delivery evidence is recorded in CHANGELOG.md.

### Earlier iteration: short answers before detail — 24 September 2026

Visitor need (J6, with J1/J5/J7 access retained): the owner reports that the improved homepage is easier to follow but the evidence and numbers pages remain overwhelming. This is direct feedback, not a representative usability study. The protected journey priorities and global navigation remain unchanged.

Decision: keep a brief answer, date, claim-changing limitations and source access visible for every Understand topic. Put charts, long explanation and supporting tables in descriptive native disclosures. On Evidence, keep explanation routes and search exposed, with advanced filters and the full 57-record library optional. Reunite the original records in one container so searches do not scatter matches among unrelated charts. Keep the historical research separately labelled, with its HTML/PDF/source routes. Unanswered questions become a scannable list whose resolved inspection status is visible before opening it.

Rationale: use progressive disclosure, meaningful chunks, clear typographic hierarchy, familiar question labels and predictable controls to reduce competing demands on attention. This follows the principles described in [Nielsen Norman Group's progressive disclosure guidance](https://www.nngroup.com/articles/progressive-disclosure/) and [recognition rather than recall](https://www.nngroup.com/articles/recognition-and-recall/). The design does not claim a measured psychological benefit. At this stage a repeated overview band and a mandatory wizard were rejected. The owner subsequently clarified the need for substantive arrival findings; that part of the decision is superseded above. A mandatory wizard remains unnecessary.

Cost and recovery: optional details require an extra activation, so their labels name the content and all previous anchors remain. Dates, scope, reserve/forecast distinctions, small-cohort cautions and capacity/admissions limits stay next to the claims. Initial source search, active saved filters and source links open the library as needed. The report's own link does not expand unrelated originals. Repeated council-chart links reopen their chart. New outer wrappers are statically open and close only when scripts run; no-JavaScript and failed-script visitors keep the full content. Existing inner native disclosures remain operable. No content is fetched on demand or removed from exports.

Review and verification: independent UX/evidence planning and implementation reviews; rendered desktop and 320/390 px checks, keyboard/touch emulation, no-JavaScript recovery, source search/reset, repeated/deep links and browser history. Enlarged-text review prompted wrapping/minimum-width fixes in the Understand hero. The iPhone 17 / iOS 26.5 simulator rendered the pages, but its web-view inputs were unresponsive, so native touch and Back remain unverified. Delivery/check counts are maintained in CHANGELOG.md. The canonical destinations remain `understand.html`, `evidence.html#records` and all existing topic/source fragments.

### Current case research: finances, forecasts and source discovery — 23 September 2026

Visitor need: a family or resident should be able to see the financial starting point, understand what the council projects, assess the limited forecast check, and reach the original records without knowing the research file names. This serves J6 while retaining J2–J5's exposed participation routes and J7–J8's direct family and school-enquiry routes.

The canonical financial and forecast explanations belong on Understand at `#budget` and `#forecast-checks`; closure-cost definitions sit at `#closure-costs`. Options retains the legal and delivery questions; FAQ holds short practical answers; Proposal holds questions to consider in an official response; Evidence retains original records and explicitly unresolved gaps. The homepage keeps its six task destinations. Evidence has short, unfiltered links to the explanations beside its source search, while the historical report stays separately findable through the existing shortcut and source/research navigation. Source search continues to cover indexed records and research reports only; FAQ search covers answers only.

Alternatives considered: another homepage band, a new report page, a global search, and copying full finance tables into the FAQ. Each would add another choice or duplicate the canonical answer without evidence that the extra interface is needed. The selected change adds two local Understand links and replaces part of Evidence's stacked introduction, with no new global navigation item or public form. Existing anchors, saved search terms, source counts and historical report routes remain protected. Request progress is kept as dated text in the relevant Evidence gaps; an acknowledgement is distinct from reviewed evidence.

Verification status: the integrated branch passed the full browser suite and a later affected-journey run after final source/date edits, plus source/export and public-file validation. The UX review inspected 320 × 568, 390 × 844 and desktop layouts, protected actions, Evidence arrival, links and no-JavaScript reading. Native iPhone 17 / iOS 26.5 Safari screenshots showed the changed pages in portrait and a budget view in landscape; simulator taps and Safari Back could not be verified. The implementation was published and all 91 live public files matched its commit byte for byte. Details and counts are in TESTING.md. These checks are not a claim of user research.

### Longer community letters — 22 September 2026

The owner requested room for 30,000-character letters and a way to expand longer stories (J4). Keep the existing reading/writing entry points, letter IDs and independent permissions. Increasing the input limit alone would make the public board difficult to scan; shortening stored text would lose the contributor's words. Instead, retain the full letter and display a roughly 360-character opening for stories over 1,200 characters, followed by a native “Read full letter” disclosure. Short letters stay fully visible.

Expanding hides the preview and reveals the exact full body with its paragraph spacing. Provide “Show less” at both ends so readers need not scroll back through a long story; collapsing brings the summary into view and the bottom control returns focus to it. Direct letter links, later hash changes and Back reveal the target story. Keep names, review labels and reporting/removal links visible outside the disclosure. No new page or navigation item is needed; existing journey priorities remain unchanged.

Independent UX review before implementation identified the bottom-collapse and direct-link requirements. Final rendered desktop and 320/390-pixel mobile review found that collapse could leave the summary offscreen; the corrected focus/scroll behaviour and shorter preview passed reinspection. All 628 browser checks passed, including exact full text, keyboard controls, narrow layouts, link/history recovery, 30,000-character limits and no-JavaScript form bounds. Native iPhone Air / iOS 26.5 Safari separately verified touch expansion, top/bottom collapse and portrait/landscape rendering with fictional near-limit text. These checks are implementation verification, not user research; publication evidence is recorded in the changelog.

### Homepage: a clear starting point

Place **Find what you need** near the top, with six routes:

1. **Could the school stay open?** — alternatives and their necessary conditions.
2. **What happens when?** — the meeting, response deadline and possible later stages.
3. **Make sense of the numbers** — the sourced Richmond comparisons.
4. **Check the evidence** — the original documents.
5. **I have something to add** — evidence, ideas and meeting questions.
6. **My child's next steps** — practical answers about school places and admissions.

The persistent Community letters action provides the reading/writing route alongside these cards. A compact upcoming-date strip links to the school meeting and the official council response, with the proposal's current status visible. Review this strip whenever a date passes or the council changes the process. It must not continue advertising an expired action.

Maintain semantic landmarks, descriptive headings and meaningful link text. The [W3C page-structure guidance](https://www.w3.org/WAI/tutorials/page-structure/) explains how these support orientation and navigation, including with assistive technology. Cards and icons supplement this structure rather than replacing it.

### FAQ: direct answers with traceable limits

Provide 12 practical questions covering the decision, consultation, school places, deadlines, finances and participation. Each answer should cite an official source or clearly identify the site's own policy. Explain where the public documents do not yet answer a question; do not invent a transfer deadline, an automatic allocation policy or an annual deficit from a cumulative projection.

The local search needs a visible label, result count, clear/reset action and a useful no-results message. Filtering must preserve accessible question headings and links to individual answers. Without JavaScript, all questions and their native disclosures remain usable. A link to a particular answer should reveal its content, including when it arrives from another page.

The [GOV.UK details guidance](https://design-system.service.gov.uk/components/details/) supports disclosing information only some users need and warns against hiding information most users need. That is why current status, urgent dates and the official-response action stay visible. The [GOV.UK accordion guidance](https://design-system.service.gov.uk/components/accordion/) also warns that people may miss hidden content and calls for evidence that an accordion helps. It does not establish that a FAQ accordion is right for this audience. Our native-disclosure choice remains a hypothesis to check with real tasks; expand or flatten answers if people overlook them.

### Timeline: distinguish dates from decisions

Present six stages: initial consultation, the school meeting, the committee's permission stage, a possible statutory notice and representation period, determination, and possible implementation. The meeting happens within consultation; it is not a separate statutory prerequisite. Show concrete published dates where available and label later stages as planned or conditional.

Keep the official response deadline prominent. Show the representation window relative to publication of a notice until exact dates exist. Separate the historical evidence record from what is coming next, preserving its existing anchor and records. Neither a proposed implementation date nor a forecast pupil series implies that closure has been approved.

### Participation: describe the action before asking for information

Keep Community letters and Share ideas visible in the shared navigation. Use the same wording, destinations and current-page state on every page and at each breakpoint. The envelope and idea icons are decorative; adjacent text supplies the accessible meaning.

The contribution form shows four categories as visible cards, with two more under “More options”:

- A question for the meeting (first until the 29 September meeting; afterwards “A question about the proposal”, last)
- An idea or suggestion (the default)
- Evidence or a source
- A factual correction
- More options: a funding idea (no payment or pledge), and a privacy or removal request

Use a single reading order on desktop and mobile. Ask for the main contribution first; make optional contact or display details clear. Reveal publication choices progressively, keep consent explicit and unchecked, and retain the private-only treatment of funding and privacy requests. Explain review before publication and keep the reviewed public board visually separate from the act of submitting. A website suggestion or community letter must not be mistaken for an official consultation response.

### Community letters: routine publication with clear permission

The owner wants ordinary community letters to appear with less manual delay and contributors to receive a publication link with a way to request changes. We considered human approval for every letter and automated publication after screening. Choose automated screening for routine, relevant letters with new explicit processing and publication permissions, while holding specific content, authorship or permission concerns for human review. Treat supportive and critical views equally; an ordinary parent mention of a child's first name alone is not a reason to hold a testimonial.

Keep publication optional and separate from council sharing. The v3 notice explains that a person may not review a letter before publication; submissions under earlier notices retain their human-review requirement. Labels describe the assessment actually used. Only after a letter is confirmed live, send one publication email if the contributor supplied a reply address, with the public link, displayed name and an invitation to request edits or removal. Keep that address private. Check periodically without promising immediate publication. Firm submission guidelines remain visible, and the public explanation must match the workflow.

Verification: 81 focused browser checks passed across Chromium, WebKit and JavaScript-disabled projects, including independent permissions, private-field exclusion, notice wording, mixed review labels and invalid-label failure. Eleven security/schema checks and the 40-asset public-site validation passed. Tests use fictional data. Full integration checks and verified deployment are recorded separately in CHANGELOG.md.

### Why not tabs on the homepage?

The [GOV.UK tabs guidance](https://design-system.service.gov.uk/components/tabs/) cautions against tabs as page navigation or when users need to read or compare content across panels. Visible route cards and ordinary page links fit the current task better. This does not prohibit tabs everywhere; a future use needs a specific task and verification.

## Verification and review

Follow [TESTING.md](TESTING.md). Before publication, verify the new routes, FAQ search and no-results recovery, direct answer links, native disclosures, conditional form states and public-board navigation. Include keyboard, no-JavaScript, narrow mobile layouts and iOS Safari simulator checks where available. Automated browser checks and a simulator session are distinct forms of evidence; record what actually ran.

Check financial and admissions wording against its cited source, including dates and any missing detail. Recheck future-stage labels when the official process changes. Keep data visualisations, accessible tables and downloads consistent.

After release, useful task checks include finding the official response deadline, finding a child's next-step answer, explaining what the deficit figure means, locating an original source, and sharing an idea without expecting a payment. Observe confusion and completion directly if participants are available. Do not claim these checks occurred until they have, or introduce tracking merely to maintain this document.

## Maintaining this record

For a material change, record the visitor problem, options considered, chosen behaviour, source or evidence, and verification status. Update the affected decision when it changes rather than leaving contradictory current guidance. Record the dated delivery in [CHANGELOG.md](CHANGELOG.md); keep private messages, submission content and personal data out of both files.

## Meeting invitation — 22 September 2026

Parents need to notice the imminent face-to-face meeting before reading the longer evidence guide. Put a compact, high-contrast invitation above the homepage hero, showing Tuesday 29 September 2026, 3.30pm and the school location. Use the parent-led site’s own invitation and link the council’s published meeting details. Avoid staff quotations or personal attribution that could imply staff involvement in or endorsement of this initiative. Encourage attendance across families, classes and the PTA community without implying that turnout determines the decision.

The absolute date remains readable without JavaScript. A small local script uses London calendar dates for “Next week”, “Tomorrow” and “Today”, and removes the invitation from 30 September; the full timetable remains available. This avoids an out-of-date relative invitation without a countdown or tracking. Regression coverage includes the London midnight boundary, no-JavaScript fallback, source/details links and placement before the introduction.


## Optional historical research — 22 September 2026

Visitor need: understand what can be learned from other school closure decisions without making the proposal timetable harder to find. Considered placing all eight graphics on the proposal page, a separate document-only download, and a concise summary linking to an optional research page. Selected the third: it preserves discoverability and lets readers choose their depth without forcing a long graphic wall or a PDF download.

The research page starts with three paired lessons, explicitly distinguishing recorded outcomes from editorial implications. Question-led native disclosures expose the eight graphics on demand; readable HTML data, full-size SVG and high-resolution PNG are available for each. The most relevant decision, funding, work-plan and closure-comparison graphics come first. Essential selection limits remain visible. Search and outcome filters narrow the 16-case catalogue; cases and native disclosures remain available without JavaScript. Deep links open their target and recover filtered cases. The complete source register and claim ledger sit on a separate citations page.

Graphic decisions: use a shared zero baseline for the Fletching forecasts, separate raised money from promised support, show the third-year range as pupil scenarios, group suggested actions by timing rather than implied efficacy, and retain the extra transition term among the closure comparisons. Use vector charts in the report and website, with 4800 × 3000 exports for reuse. These are clarity improvements, not measured engagement or persuasion gains.

Verification: 496 browser checks and 29 Python checks passed. Native iPhone 17 / iOS 26.5 Safari checked the entry, menu, disclosures, search, outcome filter, reset and orientation. The test suite caught and now guards the table overflow; the simulator review caught and now guards missing mobile heading spaces. PDF pages and desktop/mobile previews were inspected visually. Publication is recorded separately in the changelog.

## 22 September 2026 — a dedicated video route

Visitor need: share a natural spoken testimonial without getting lost in the written contribution form or mistaking upload for public posting.

Options considered: add a file input to Formspree (current free plan has no upload; paid limit 25 MB per file); embed another form in the existing page; or use a short dedicated page and an external Google upload form. Choose the dedicated page, linked from letters and ideas, without another global navigation item. The page leads with a single upload action and puts recording/permission/troubleshooting details in native disclosures.

Google Forms provides private Drive storage and phone-sized files but requires Google sign-in. State this before the handoff and retain private contact and written-letter alternatives. The website does not load a Google or YouTube embed. Start with adults recording themselves. Keep private review consent and optional publication independent; the owner manually reviews and posts only authorised videos. No AI video moderation or YouTube automation is introduced.

The owner explicitly approved the Google Forms/private Drive collection and the form was published. All 528 browser checks and 29 Python checks passed. Native iPhone 17 / iOS 26.5 Safari covered navigation, portrait/landscape layout, a permission disclosure, the privacy anchor and the Google sign-in handoff. The upload picker and empty-form validation were checked; a completed upload remains unverified because the extension blocked the synthetic file transfer. No interviews or usability study are claimed.

## 22 September 2026 — prepare and participate together

Visitor need: understand the next useful action, coordinate with other parents and see that closure remains a proposal, while retaining honest answers for families thinking about contingencies.

Considered a ten-item homepage campaign list, an image containing all instructions, and a compact sequence linking to a fuller guide. Choose the compact sequence within the existing meeting invitation, with the detailed plan on Proposal & dates and additional actions in a native disclosure. This avoids another homepage section, image-only text, a carousel or a new navigation item. The formal council timeline remains separately labelled and directly linked. The existing dated meeting invitation expires after 29 September; the plan remains reachable from the FAQ, homepage quick answers and proposal navigation.

The guide distinguishes PTA preparation sessions, the council meeting, the response deadline and the conditional final decision. Family participation is voluntary; videos retain independent permission, children’s letters stay in appropriate official channels, and a proposed petition is not shown as available until its wording and link are verified. Encourage preparing a response using meeting answers, while making clear that people can respond now and must not miss the deadline waiting for more information.

Move school-place answers below participation, decisions and money; put continued applications first within that group. Keep the original anchors, search synonyms, topic shortcut, source citations and normal admissions/SEND instructions. Lead with conditional wording and reassurance without discouraging practical questions or telling families to postpone decisions regardless of their circumstances.

Add short in-page links for session times, letters/videos, the council meeting, the response and additional actions. Proposal and FAQ anchors jump immediately: long animated scrolling proved unreliable in the JavaScript-disabled WebKit journey. Preserve native links and all test assertions.

Verification: all 545 browser checks and 29 Python checks passed; 64 public assets validated. The previously failing native path passed three repetitions, and a one-off existing source-filter failure passed eight unchanged repetitions and the final full suite. Native iPhone 17 / iOS 26.5 Safari verified the homepage route, prep-session shortcut, native disclosure, menu and conditional school-place answer; portrait and landscape were visually inspected. Publication is tracked in CHANGELOG.md.

## Video uploads without an account — 22 September 2026

The owner reported that the Google upload sign-in requirement blocked participation and requested Dropbox while preserving links already circulated. Use a copy of the styled form for permissions, with a required typed email and an optional filename, followed by an account-free private Dropbox file request. The original Google file-upload form remains live and separately labelled. A direct Dropbox request alone cannot capture the existing independent publication choice; the two-step route retains it. The confirmation page explicitly says the video still needs uploading. The website offers a continuation link for someone who has already saved permissions and explains matching by email and upload details, no automatic publication and what to do if storage is full. Keep the providers as external links, without embedded scripts or local private data fields. Verification and deployment are recorded in the changelog; this is a design choice, not a measured conversion improvement.

A phone photo picker may hide the filename. Do not make finding it a prerequisite: the filename question is optional, email is required in both steps, and only one video should accompany each permission form. Yann must resolve an ambiguous match privately before publication.

Contribution forms use immediate scrolling so a native validation focus change does not move the next click target. The Linux WebKit trace showed the email-help paragraph briefly intercepting a consent-label click during the scroll. The regression retains all three independent consent and blocked-submission checks, and also requires the focused checkbox to be in view.

## Parent action plan discovery - 22 September 2026

The owner could not readily find the action plan from the homepage. Its main button was labelled “Our next steps & prep sessions”, while the explicit plan link was inside a disclosure and the shared navigation labelled its containing page “Proposal & dates”.

Keep the existing plan address. Add a named, always-visible shortcut above the meeting invitation, rename that invitation's button “Parent action plan”, and include the plan in both shared navigation variants. This gives the parent task its own clear entry without requiring familiarity with the proposal page or opening an answer. Keep the longer plan on its current page and preserve the official-response action. Allow the desktop link group to wrap rather than crowding the existing participation actions.

Verification: a regression first demonstrated that the named, immediately visible homepage shortcut was missing. All 562 browser checks and 29 Python checks passed, including no-JavaScript access and 320px arrival/1101px intermediate navigation layouts. Native iPhone 17 / iOS 26.5 Safari verified the visible shortcut, its destination, Back, the mobile-menu entry and portrait/landscape layouts. Desktop layout was visually reviewed. These checks demonstrate access and layout, not measured user discoverability.


## Lightweight action feedback

The owner requested a little contemporary motion, especially on Parent action plan. Use a single 900ms decorative-arrow cue after arrival, 180–200ms hover/keyboard feedback and an 80ms press response. The spotlight's text and clickable area stay still; action-link buttons lift just 2px on interaction. Keep navigation links and form controls out of this treatment.

A CSS-only treatment fits the static site and adds no script or third-party dependency. All new transforms, transitions and animation live inside `prefers-reduced-motion: no-preference`, so reduced-motion visitors get the existing static controls, underlines and focus indication. The arrow does not loop and no content is hidden while it animates. This is a design choice, not a measured improvement in discovery or engagement.

This adapts the emphasis on intentional, distinctive interactions in [Webflow's 2026 design review](https://webflow.com/blog/web-design-trends-2026), using the transform and reduced-motion guidance in [web.dev's CSS transitions reference](https://web.dev/learn/css/transitions). Verification and publication are recorded in CHANGELOG.md.

## Other-schools report discovery — 22 September 2026

Visitor need: find the previously published 44-page PDF without knowing which proposal section contains it. A compact strip beside the homepage task routes offers direct PDF and web links, plus a stable Evidence reference. The existing proposal route and file URLs remain intact.

The Evidence search includes a separate Site research card, with remembered search terms and its own count. Adding the synthesis to the original-source dataset was considered but would blur its provenance and change the source export. Keeping it outside search would preserve the discovery problem. The chosen design shares the search/filter controls, identifies the item as Synthesis, and leaves all 46 original records and their CSV unchanged. Empty-state messaging considers both collections; direct anchors recover from incompatible filters. The static card and links work without JavaScript. A small dedicated stylesheet avoids stale cached styles for the new route, and the updated Evidence script URL is versioned.

Verification: all 587 browser checks, 29 Python checks and 67-asset validation passed. Native iPhone Air / iOS 26.5 Safari checked both report formats, Back, the Evidence route and portrait/landscape layout on the local preview. Publication is recorded separately in CHANGELOG.md.

## Sofiya feedback: learning within the existing hierarchy

Visitor needs: find the retrieved inspection, understand educational provision/results, contribute evidence and enquire about a school visit (J5–J9), without displacing J1–J4 or current-family school-place guidance.

Keep the canonical priorities above. Add learning/results after the existing substantive Understand sections and before methodology, with a local jump and short links inside the existing comparison preview and visit card. No new global navigation item or homepage band is introduced. The six homepage task cards retain their destinations; Letters, Share ideas and the Parent plan keep their arrival positions. The visit card grows modestly to expose educational context and current official admissions alongside direct enquiry and the closure caveat. It does not require reading campaign strategy.

An always-expanded results appendix would lengthen every visit. Instead, keep the conclusion, small-cohort and attainment/progress limits, sources and newer Darell context visible, with optional labelled tables and method. Responsive chart facets share a zero-to-100 scale, direct value labels and accessible descriptions; they stack on phones. Tables scroll within keyboard-focusable labelled regions. A chart link opens the relevant disclosure with JavaScript, including direct/history/repeated anchors; without JavaScript its descriptive jump reaches the native summary. Underlying CSV/JSON remain downloadable in both cases.

Append a learning FAQ group after the original four topics and preserve all 12 previous answer IDs. Its four answers use the same search/hash/reset controller. The mixed-age account distinguishes school curriculum, inspection observations, family experience and mixed research. Leave only the unresolved class count and unverified 2024 eligible counts unasserted, rather than deferring verified material.

Keep evidence gap 7 in its familiar position, visibly resolved and linked to the full inspection source. The separate research report stays distinct from the original-source library. Broaden the existing enrolment option’s title and visible channel list together; operational ownership and measurement belong in the maintenance outreach brief. Contribution edits reuse existing evidence/video forms and permission boundaries.

Independent planning reviews supported these placements. Implementation reviews corrected the chart disclosure link and source details; campaign and rendered UX reviews found no further actionable issues. Rendered review covered 320/390px and desktop, retained arrival routes, keyboard tables and FAQ recovery. Regression checks and native Safari outcomes are recorded in `TESTING.md` and release evidence in `CHANGELOG.md`; this rationale is not user-research evidence.


## System-aware appearance — 22 September 2026

Visitors can read in their preferred light or dark appearance without a new decision on arrival. Use CSS system preference as the default, including without JavaScript. A native labelled System / Light / Dark select in the footer provides an override without competing with J1–J4 or changing J5–J9 routes. A forced dark theme would ignore light preferences; a prominent header toggle would consume space needed by campaign and evidence routes. Store only an explicit light/dark choice locally, remove it for System, and recover saved choices on restored pages and across tabs.

Use semantic screen colours rather than image inversion. Preserve the bright participation accents, direct chart labels, separate series, forecast dashes/hollow markers, source notes and consent boundaries. PDF/SVG image downloads remain unchanged and print stays light. A small CSS arrow allows the native select to retain a 44px target in WebKit. The theme script runs after styles in the head, before body paint; default system matching itself requires no script.

Independent UX review inspected the diff and lead-provided mobile/desktop/native screenshots; its browser connection was unavailable, so interaction testing remains the lead agent’s responsibility. No protected journey priorities changed. Delivery checks are recorded in TESTING.md and CHANGELOG.md.

## Short homepage and dedicated reference pages — 22 September 2026

The owner asked to move directly to a shorter homepage after feedback that scrolling through the site felt excessive. This supersedes earlier choices to keep complete options and the source library on the homepage. Preserving a destination alone does not establish comfortable discovery. The intended hierarchy remains J1–J9.

The homepage now provides the prominent Parent action plan, a concise conditional-status introduction and direct official response/deadline, a compact meeting invitation, all six task routes, the report's PDF/HTML shortcuts, three optional quick answers and direct prospective-family enquiry with proposal context. The family account has a short entry linking to its full About story. These are the default reading path; deeper research is a deliberate choice.

`evidence.html` contains the complete source library, separate site synthesis, charts/tables and context, history, unanswered questions and method. Evidence navigation still means the document library (`#records`), with local section links visible at that arrival. `options.html` contains the complete eight strategies, a local contents list and an introduction distinguishing exploratory work from immediate participation. No global navigation item is added. Complete units preserve essential qualifications and original-source versus site-research provenance.

All 86 relocated homepage IDs retain native, targeted Continue links. With JavaScript, old fragments and query-only evidence searches use replacement navigation, keeping filters and allowing Back to reach the real previous page. Without scripts, the targeted link is visible and the complete destination remains readable; a saved-search note leads to the full library. Maintained callers and generators use canonical destinations. Every original homepage ID remains valid. The exact video QR URL `https://ystoneman.github.io/kew-riverside-website/videos.html#upload` is unchanged.

The measured desktop homepage changed from 19,794 to 2,205 CSS pixels at 1280×720 (about 89% shorter). This is a rendering measurement, not a user-study result. At 320×568, the Parent plan and exposed participation actions remain in the arrival viewport without reducing text size. Final verification and any publication are recorded in the changelog. Independent pre-implementation campaign, UX and evidence reviews informed compatibility routing, visible official-response distinctions and local contents. Final campaign/evidence source reviews found no outstanding issue; rendered UX verification is recorded separately.

## Video submissions for publication — 22 September 2026

J9: new video submissions are intended for possible public YouTube publication. Require explicit YouTube permission, retain separate storage/review consent, and offer optional unchecked news-media permission. A private-only video option would introduce a second intake purpose and later permission follow-up; instead, provide private contact before the handoff. Explain this inside the upload card for direct arrivals and in provider introductions. Earlier saved permissions remain valid even when upload is delayed. Keep existing provider URLs and unmatched uploads private. Version rules are in VIDEO-PERMISSIONS.md; verification is recorded in CHANGELOG.md.

Direct `#upload` arrival uses immediate scrolling so the private-contact link stays still for JavaScript-disabled Safari. A recurring existing chart-link failure was addressed with the same narrow rule at `#learning-and-results`; neither change alters layout or destinations. The earlier video decisions above describe the v1 intake and are superseded by this v2 consent model for new submissions only.

## Research page arrival — 22 September 2026

J6: a visitor following a shared or in-page link to a research graphic, case or source claim should land on it and be able to open it at once. Site-wide smooth scrolling animated these jumps after load, by up to 33,693 px on the source register, and in hosted testing it moved the first graphic beneath a click. Options were a narrow `#visual-guide:target` rule, which fixes only the reported arrival, or immediate scrolling on both research pages. Choose the page-level rule. Every direct and in-page research anchor has the same long jump, including source-register links and arrivals without JavaScript, and the FAQ and parent-plan decisions already make long reference jumps immediate. Destinations, header offsets, disclosure behaviour and layout are unchanged; reduced-motion visitors already had immediate scrolling. Verification is recorded in TESTING.md and CHANGELOG.md.

## Video page scrolling — 23 September 2026

J9: a visitor opening upload help or following an in-page video link should be able to use the link they can see. Smooth scrolling after focusing the help summary moved the original-form link beneath a click in hosted testing. Options were more `:target` rules for individual anchors, or immediate scrolling for the whole contribution page. Choose the page-level rule, matching the contribution forms and research pages; it also keeps the exact QR arrival at `videos.html#upload` immediate. URL, providers, permission wording and layout are unchanged. This is a lead-agent review applying the kew-ux-review criteria. The same page-level choice for the research pages had an independent review with no actionable findings.

## Research shortcut wording — 23 September 2026

J6: the owner judged that “Looking for the 44-page report?” means nothing to visitors who have not heard of the report. The homepage shortcut now leads with its subject, “What happened to other schools proposed for closure?”, under a “Historical research” label. The Evidence jump link uses the destination card's name, “Find lessons from other schools”. The page count stays on the download button, where it helps people choose between the PDF and the web version. Placement, links, destinations and the research description are unchanged. This is a lead-agent review; verification is recorded in CHANGELOG.md.


## Website analytics — 23 September 2026

Need: learn which existing journeys people reach, without treating counts as named supporters, completed responses or enrolments. Applies across all protected journeys; no priority, destination or arrival position changes, and no public dashboard is added.

Options: opt-in for everything behind a banner (the unpublished 22 September candidate), opt-in without a banner, or basic page counts by default with detailed usage opt-in. The owner chose the last: an opt-in-only design would undercount heavily, and a banner competes with the Parent action plan, Letters and Share ideas on arrival. Basic counts set no cookie and store nothing; detailed usage keeps consent. The choice stays one tap away in every footer, with three equal options and the current one marked. Browser privacy signals and private routes send nothing.

Verification status is recorded in TESTING.md and CHANGELOG.md. This rationale is not user research. Revisit if the provider, data fields, ICO guidance or the interaction changes.

## Analytics: detailed usage on by default — 25 September 2026

Need: the 23 September design left detailed usage opt-in, and the Events report showed zero events for the week to 25 September while the provider accepted a live test event. The owner wants usable evidence on section reach and key-link opens (such as the official form) to improve the site, and accepted changing the privacy notice. Applies across all journeys; no page content, destination, order or arrival position changes.

Options: keep opt-in (no data at current traffic); add a banner asking for opt-in (competes with the Parent action plan, Letters and Share ideas on arrival, and still undercounts); or make detailed usage part of the default under the ICO statistical-purposes exception with a simple objection. The owner chose the last. Saved “Basic counts only” and off choices keep their meaning, browser privacy signals and private routes still send nothing, and the “allow” button is relabelled “Include detailed usage” because it no longer grants consent. The three choices now come before the longer panel text, so all three fit a 320 × 568 screen without scrolling.

Section labels follow each page's own “On this page” list, adding Evidence, Options, Videos and Understand's newer sections and removing stale homepage IDs. The letter-writing and video-sharing areas are measured as whole areas only, never fields. A nested section's own area is taken out of its parent's, so Evidence's source library can be the section in view.

Deferred: an “Analytics choices” entry in the header menu, which the ICO suggests is more prominent than a footer on long pages. The footer link is on every page, the Evidence method notes and privacy page link to it, and the mobile menu reaches Privacy; a menu change also alters navigation on every page. Revisit with the next navigation change or if the ICO or the owner asks.

Verification status is recorded in TESTING.md and CHANGELOG.md. This rationale is not user research.

## Participation invitation — 23 September 2026

Need (J4, J5; guards J2, J3 and J9): make Community letters and Share ideas noticeable and inviting for busy parents with little attention to spare, and make writing, asking and suggesting as easy as possible, without competing with the official response or the Parent action plan.

**Why the letters wall exists.** The owner's purpose, recorded here because it shapes the page: letters are not only for the council. Parents gain strength from reading what others have written; the wall lets parents be heard by their community, not just by the council; one parent said she cried reading a letter on the site. Reading is therefore a first-class outcome, not a by-product of writing. The board now sits directly after the form (at 390 × 844 its top moved from 5,130 px to 2,557 px), the hero links to it, and the thank-you page links back to it. Its caveats stay: opinions, not a representative survey, petition or count of responses.

Design:

- **Header tiles.** One warm colour family used nowhere else in the header, a decorative medallion and a plain second line: “Read & add yours” and “Ask or suggest”. One short cue on the first page of a visit from another site (icons only, about a second, never looping, none with reduced motion, none on the homepage where the Parent action plan has its own cue, none on the page itself, and none on a shared fragment link whose target must stay in view). Nothing is stored for it.
- **Letters: write first.** A question heading (“What does Kew Riverside mean to you?”), the one-line official-response route in the hero, then the letter box. Starters, a dictation tip and “What could I write about?” help people begin. The choices and Send follow “Next” with scripts; everything is visible without them, after a restored draft and for links to later fields. The counter appears only near the limit.
- **Drafts and returning.** The letter and public name are kept on this device for seven days and never the email or council details. A shared-device notice appears before writing. On Send the draft is marked pending. Coming back without the next-steps page shows “Did your letter arrive?”, focused and in view, with the official-form step until 16 October. A Send click does not prove delivery. Clear draft resets the full form and sharing choices; explicit clearing on the next-steps page removes both stored copies and uses a fingerprint only to clear a browser-restored form on Back.
- **Share ideas.** Visible category cards replace the dropdown. The static meeting card is date-neutral for visitors without scripts; scripts add its date until the meeting's 3.30pm London-time start on 29 September and make it a general question afterwards. The extra category disclosure stays open without scripts so privacy/removal routes remain visible.
- **Next-steps page (`sent.html`).** Neutral unless this tab records a recent letter or idea, and conditional on the provider's own result instead of claiming receipt from a Send click. After a letter: “Make it official” first (copy, open the form, calendar reminder until 12 October), then sharing with another parent, then reading others' letters. The official form has distinct questions; visitors answer those in their own words and use relevant excerpts, or use the council's email/post route for a full letter. Dated asks retire after 16 October. It needs the form service's redirect, which requires a paid Formspree plan; until then the letters page's return panel carries the official step.
- **Link previews.** Four 1200 × 630 images and Open Graph tags for WhatsApp and other previews. Letter text is never used in previews or share messages.
- **Optional quotes.** Quoting was the owner's request, so writers can agree now rather than being asked later. It is offered only on top of Publish (“from my published letter”), starts unticked, is dropped if Publish is unticked, and without scripts counts only with publication. The scope is closed: Yann's own posts, parent-group messages, leaflets, posters and talks, until 30 September 2028; not paid adverts, fundraising, the council, news organisations or school/PTA materials. “Independent permissions” still holds: no choice implies another. The value (`yes-quote-published-letter-v1`) is self-versioned under letter notice v3, so the private publication automation is unchanged.

Costs and how they are contained: the header grows by 33 px at 320 × 568 and 38 px at 390 × 844 (unchanged on desktop); the Parent action plan's bottom edge moves from 330 to 363 px at 320 × 568 and stays fully visible (J2). The letter box moves up from 2,091 to 739 px at 320 and from 1,228 to 379 px on desktop. The full official-response panel and the supporters note move below the board; the one-line official route stays above the box and the inline official note stays before Send (J3). Share ideas' message box moves down (803 → 1,316 px at 320, 760 → 1,136 px at 390) because the categories are now visible; that is the accepted cost of not hiding choices in a dropdown. Measured in Chromium and WebKit with reduced motion and no letters loaded.

Retained: every URL and anchor, `letters.html#letters`, `feedback.html?kind=…` deep links, `videos.html#upload`, the private request routes, all consent wording and values, and no-JavaScript submission.

Owner and review triggers: after 16 October, check the next official process stage and update dated copy; decide the Formspree plan (the redirect address is `https://ystoneman.github.io/kew-riverside-website/sent.html`); keep quote permissions recorded within 30 days (private operations notes). Verification is recorded in TESTING.md and CHANGELOG.md.


**Post-release review, 27 September 2026.** Share ideas had no route to the official response once the next-steps page proved unreachable without a paid redirect, so a personal view now meets the official form above the categories (J3 before J5), retiring with the other dated asks. The 13 October calendar reminder moved to letters step 3 for the same reason. In dark appearance, chosen cards now use the appearance palette so they read as chosen. No priority, destination or arrival position changed.

## 24 September 2026 — Findings before depth on Options, Lessons and Proposal

Visitor need (J1–J3, J5–J8): understand the implications before choosing among a directory of topics. The owner approved the detailed three-page plan and requested implementation. Keep the shared journey register and global navigation priorities unchanged.

Options puts three connected priorities at the existing `#options` arrival, followed by all eight retained option anchors. It shows each option's purpose, first useful step and essential limitation; the ranking explanation and funding-question bank become optional depth. Static funding questions stay open without the enhancement, and incoming/repeated links reveal their target. The immediate official-response/Parent-plan routes live within `#options` so older links do not skip them. Funding remains exploratory and school enquiries remain direct.

Lessons refines the existing three comparisons instead of duplicating Evidence's London introduction. Each pairs outcomes with their recorded basis, a visible limitation and an editorial question for Kew. Named-case links remove the need to traverse graphics to reach an example. All research cases, charts, data, methods and downloads remain. Case-link handling respects modified clicks and supports filter-hidden/repeated targets and Back.

Proposal makes participation optional and the official response immediately visible, keeps practical family guidance exposed and compresses the single six-stage timetable. Optional stage explanations, committee detail and dated decision records are readable native disclosures. Existing stage headings, dates and targets stay outside closed wrappers. Questions precede the fuller institutional explanation.

Rejected alternatives: adding another table of contents above unchanged prose; hiding claim-changing qualifications; collapsing the entire timetable and making old links depend on new recovery code; compressing text by reducing type size. Reading length alone is not the success measure: Lessons adds explicit outcomes/qualifications while reaching them sooner. Options and Proposal remove repetition.

Review: independent evidence and campaign implementation review passed; rendered UX review covered 320/390/1440, light/dark, 200% text, keyboard, filters, incoming/repeated links, Back and no-JavaScript. Resolved findings: duplicated Options purpose text, action links above the `#options` arrival, enlarged-text overflow and redundant timeline counters overlapping stage labels. Native Safari and automated verification are recorded in TESTING.md; no user-study outcome is claimed. Preserve the private plan and screenshots outside the public asset list.

Publication verification: the three-page release was published on 24 September 2026 as `4bb25f0`. The live desktop/mobile browser checks passed, preserved source/download routes matched, and all 94 public files matched the deployed commit. Full release evidence is recorded in CHANGELOG.md and TESTING.md.

## 24 September 2026 — A manageable Options page aligned with parent information

Visitor need (J1–J3, J5–J9): the owner found Options still demanding for a stressed parent, supplied a detailed reduction plan and then asked implementation to align with the PTA information-session flyer. The approved refinement prioritises the official response, optional preparation together and bounded contributions. Shared navigation and the journey register remain unchanged.

Decision: the existing `#options` landing now includes the page title and promoted response block (`#option-7`). A short answer explains the budget/delivery dependency before seven compact native-disclosure rows. Each reveals a manageable contribution and the essential limit before deeper explanation and sources. The named Parent action plan, school enquiry, source access and checklist stay available. The flyer’s supportive invitation informs the tone; attendance stays optional and separate from giving an official response. Session dates/rooms live in the canonical Proposal section, corrected against the newly supplied flyer, without implying the independent website is PTA-endorsed.

Keep the seven substantive options in their existing relative order; update the public structured data accordingly. Avoid a second selection step through time/skill chips, a countdown, a sticky response bar or unmeasured completion-time promises. Keep useful findings before choices so the page does not return to a table of contents. A fixed caveat quota is rejected: qualifications stay where they affect a visible claim or invitation. No parent is assigned responsibility for delivering a full budget or legal assessment.

Interaction cost and recovery: optional reading takes an extra disclosure activation, while meaningful row summaries stay visible. New outer disclosures and funding-question helpers are statically open, closing only when enhancement runs. Incoming links open both their ancestors and a target’s own direct disclosure; repeated links and Back recover the intended section. No filter state is introduced. All old IDs, sources, downloads and question-specific contribution URLs remain. The always-exposed enquiry avoids making recruitment reading a prerequisite for a prospective family.

Independent evidence, campaign and rendered UX implementation reviews passed. A Lighthouse contrast finding was fixed with the stronger existing body-text colour for secondary copy; the final accessibility score is 100, not a claim of conformance. Default visible main content measures about 320 words, down from 1,099; no measured psychological or comprehension benefit is claimed. Verification and native-simulator limitations are recorded in TESTING.md. Published through PR #22 as `3463007` on 24 September 2026 after both required hosted checks passed. All 94 live assets matched the release. Live desktop Chromium and mobile WebKit confirmed the compact reading layer, first-screen response, retained links/history and exact PTA session pairs without overflow; all four screenshots were inspected. Detailed publication evidence is recorded in CHANGELOG.md.

## Stable initial section position — 24 September 2026

J1/J2/J6: a linked section must be settled before a parent taps. Hosted and local traces found that WebKit could run deferred navigation while the final stylesheet was still pending, then change the measured header and scroll offsets after arrival. Preserve the stylesheet cascade, place the existing synchronous pre-paint theme initializer after every stylesheet, and initialize navigation before page-specific section reveals. This uses existing resource loading rather than delayed corrective scrolling. A delayed-stylesheet regression checks the initial offsets and unchanged 600ms scroll stability assertion. The incomplete deferred-only fix demonstrably failed that regression; the final stylesheet barrier passed 12 repeated checks. Full-suite, rendered specialist recheck and publication evidence are maintained in TESTING.md and CHANGELOG.md.


### Fundraising role briefs shared by direct link — 25 September 2026

Visitor need: trustees and the authorised account administrator need a short, readable request that can be shared as a web link. The owner specifically requested publication without incoming navigation. The two canonical destinations are `fundraising-trustees.html` and `fundraising-admin.html`; `#reply` links directly to each initial response request.

Keep the standard outgoing site shell, named role label, reading width, light/dark appearance and native links. Register the role labels separately from the menu's page list, so generating shared navigation cannot add incoming routes. Do not add homepage bands, menu entries, source-search records or links from other public pages. J1/J9 gain a bounded direct-sharing route; J2–J8 lose no entry or space. Essential proposal/no-donations status stays visible outside disclosures. Publishing the brief does not authorise the fundraiser.

Alternative considered: PDF attachments or publishing the full working checklist. Direct web pages meet the requested sharing need without publishing the wider draft pack. The short briefs need no additional local navigation. They include primary source links and ask readers to reply to the sender, with no collection form or named private contacts. Noindex discourages search indexing but is not access control.

Verification: independent campaign/evidence reviews of the actual text; independent Chromium/WebKit visual review at 320, 390 and 1440 px in both appearances, with doubled text at 390 px. No horizontal overflow or obscured direct reply headings remained. Automated direct-link, navigation, appearance, privacy and no-JavaScript checks are included; see TESTING.md for results and native Safari limitations. Existing visitor priorities are unchanged.


### Direct-link brief sharing previews — 25 September 2026

Recipients need to recognise why they were sent a trustee or account-setup brief before opening the link (J1/J9). Add distinct role-first titles and descriptions, plus small original green/cream preview cards. Both cards carry proposed-fund and donations-closed wording; essential status is not left only to a description that a messaging client may truncate. Use centrally placed text so square crops preserve role and status. Absolute canonical and image URLs support script-free crawlers; preserve noindex and add no incoming navigation. Visible page bodies and all existing journeys are unchanged. Actual client cropping and cached previews remain under the sharing service's control; metadata validation does not certify WhatsApp rendering.


### Independent new-domain verification — 28 September 2026

After the failed custom-domain cutover, visitors need the original GitHub Pages address to stay functional while the new domain is verified independently. Prepare the same protected J1–J9 journeys as a separate deployment, with no redirect from the original repository. New-domain shares and downloads use its own address; existing printed QR links continue to use the original site. The original site’s Formspree project and browser choices remain usable; the candidate uses a separate new-domain form endpoint. Analytics on the new origin starts off until explicitly chosen, and its draft notice links to the original Letters page for recovery in the same browser.

The alternative of setting the original repository’s custom domain again would redirect existing visitors before the destination is proven. It is excluded during verification. Every source update, especially a correction or removal, needs promotion to both deployments during overlap. Independent campaign/UX planning review identified provider intake integration and live styled HTTPS checks as release conditions. Independent campaign/UX source review of the candidate diff found no additional code blocker after the draft-recovery wording was clarified. The new endpoint is pinned in all five forms and in the private-state handler and validation/tests. Full browser, rendered and live checks remain pending; this record is not a claim of successful publication.

## Legacy address forwarding — 30 September 2026 (J1–J9)

The user authorized forwarding the old GitHub website after verified HTTPS launch
of the separate custom-domain deployment. Deep links preserve their page, query
and section with replace navigation so Back does not bounce between sites.
Moving the custom domain onto the original repository would prevent old-origin
draft recovery, so that Pages field remains empty.

The old artifact keeps complete original HTML and a visible manual new-address
link for visitors without JavaScript. Letters and Sent retain valid seven-day
drafts, unfinished words, pending thirty-minute returns and explicit recovery
arrivals. Inaccessible storage keeps the old recovery form usable. Drafts and
consent are never migrated, and retained drafts do not establish receipt. The
notice sits inside the Letters form so the `#letter-form` arrival sees it. A
new-domain referrer bridges the existing recovery link until an explicit recovery
query is promoted. Old downloads, public boards and `/visit/` are retained.

The source remains complete; only the original Pages upload is transformed.
Separate-domain promotion excludes maintenance/redirect tooling and preserves
the new host's provider and analytics settings. Generated old HTML omits analytics
without changing saved choices. Planning campaign and UX review accepted these
conditions; implementation, hosted gates and live verification are still pending.


## Primary School address migration — preparation, 3 October 2026

The owner requests a permanent redirect only after trusted TLS and complete site readiness. The new address is prepared as a separate deployment, with a restricted form project and the latest authoritative content. Existing printed QR images and PDF links retain their previous addresses during preparation; the eventual redirect must preserve their paths and anchors. All J1–J9 routes remain available.

Saved Letters drafts and unfinished provider returns belong to the origin that stored them. The new form therefore links to both `savekewriverside.org` and the earlier GitHub Letters page in the same browser. The old Letters and Sent routes must retain origin-local recovery and working restricted form endpoints. A blanket server redirect would bypass this recovery, so those routes require explicit exceptions or a tested storage-aware gateway. Privacy choices start independently on the new origin.

Independent UX planning review identified these recovery and readiness requirements. Source and rendered review, complete browser tests, provider intake integration and old-domain redirect edge certificate verification remain release conditions. No redirect is enabled by this source candidate.
## Final domain redirect — 5 October 2026

J1–J9: direct both previous website addresses to the matching Primary School domain page while preserving old shared links and J4 saved-letter recovery. Reuse the browser artifact transformation with replace navigation and query/fragment retention. Complete recovery and no-script pages retain their origin-specific form endpoints; downloads, JSON boards and the school visit handoff remain unchanged. Legacy artifacts omit analytics initialization. DNS migration is unnecessary for this browser redirect. Independent UX planning review requires dual-origin recovery, history and narrow-layout checks; implementation results are recorded in TESTING.md.


## Legacy compatibility consolidation — 7 October 2026

J4/J5 and incoming routes across J1–J9: maintain one full website. Legacy addresses use small forwarding pages and origin-bound Copy/Clear/Continue recovery instead of duplicate forms. Preserve distinct draft/pending copies, unconfirmed receipt wording, blocked-storage recovery, expiry and Back. Without JavaScript, offer corresponding current-page and protected-section links; storage recovery requires scripts. Direct downloads and JSON remain real automatically generated files. Removal is not complete until every retained copy is verified. Independent planning UX concerns were incorporated; rendered implementation review and release checks remain pending.
