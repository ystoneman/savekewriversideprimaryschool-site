# Kew Riverside project instructions

## Specialist reviews

Use [Protected visitor journeys](UX-DESIGN-DECISIONS.md#protected-visitor-journeys) as the single current priority register. Read it before a material change to content, participation or navigation. Keep dates, campaign stage, source findings and provider details in their maintained content/records; verify the relevant current material rather than freezing it into these instructions.

| Change or planning question | Skill to read and apply |
| --- | --- |
| Campaign actions, outreach, enrolment, contribution requests, volunteer roles or campaign-stage priorities | [kew-campaign-review](.agents/skills/kew-campaign-review/SKILL.md) |
| Navigation, homepage content, labels, forms, mobile layouts, search, downloads or the visibility of existing tasks | [kew-ux-review](.agents/skills/kew-ux-review/SKILL.md) |
| Factual claims, results, inspections, comparisons, research summaries, dates or decision-process wording | [kew-evidence-review](.agents/skills/kew-evidence-review/SKILL.md) |

Apply every relevant lens, not automatically every skill. Internal tooling edits, formatting and typos that do not change meaning or behaviour need no specialist panel. A small factual correction can use the evidence criteria directly. A substantive new section, participation flow, promotion or navigation change warrants independent review.

### When and how to delegate

- Before substantive implementation, delegate bounded, read-only reviews of the proposed change to the relevant specialists. Give each the actual request, relevant skill path, active checkout, journey register and necessary source artifacts. Do useful independent work while they review; incorporate their findings before settling the affected design. For planning-only work, review the proposed plan and stop within that scope.
- Before releasing a material change, have the relevant specialists review the actual diff and evidence of the resulting behaviour. UX review should inspect rendered mobile/desktop behaviour when layout or interaction changed. A planning review does not count as a review of the implementation.
- Use separate subagents when available and when their review can run independently alongside useful work. If delegation is unavailable or offers no independent work, apply the relevant skill in the lead task and accurately identify it as a lead-agent review. Do not claim an independent review occurred.
- Reviewers do not edit, contact people, submit forms, publish, or spawn more reviewers. These instructions authorize review delegation, not external campaign activity or deployment beyond the user's request.
- The lead agent integrates findings and owns changes. Resolve disagreements against source accuracy, consent/accessibility and the protected journeys before promotional preference. Fix concrete regressions within scope; document a reason when declining a recommendation. Seek user input only for a material unresolved priority or scope decision.
- Recheck affected findings after fixes; do not restart the whole panel for routine revisions or every wording change.

### Review output

Return only actionable findings with: affected journey ID; severity (blocking regression, material concern, or optional improvement); exact file/section or proposed placement; evidence and visitor consequence; smallest useful correction; and how to verify it. Separate observations from hypotheses. If no actionable findings remain, say so and state what was actually inspected and any material limitation. Do not invent findings to fill a quota or claim to be a human specialist.

Record the relevant roles, review stage and resolution briefly in the task summary or change description. Update the journey register only when the intended priority or protected route changes; put rationale in `UX-DESIGN-DECISIONS.md` and delivery evidence in `CHANGELOG.md`. Skills and instructions are maintenance files, excluded from the Pages artifact through the existing allowlist.

## Website changes and regression coverage

- For each new or changed visitor interaction, add or extend the browser test for that journey in `tests/browser/`. For a bug fix, include a regression that fails with the old behaviour where practical.
- Keep the automatic all-page navigation, local-link, mobile-layout and no-JavaScript checks applicable to new public pages. Test new controls and states explicitly; automatic page discovery alone does not cover their behaviour.
- Run the checks in `TESTING.md` before publishing. Browser tests and privacy/security checks must pass before deployment. Never skip, weaken or remove a failing assertion to obtain a passing build without resolving or explaining its cause.
- For changes involving touch, focus, menus or mobile layouts, also test in iOS Safari using the Xcode simulator when available. Record the tested device, OS, actions and outcome; distinguish simulator checks from browser emulation.
- When changing `navigation.js`, bump its numeric `v` query value consistently on every page so visitors with a cached script receive the update.
- Tests must use fictional data and intercept external submissions. Never send automated test forms to Formspree or the council, or add private intake data to fixtures, screenshots or reports.
- Keep test dependencies and test artifacts out of `PUBLIC_FILES`. Add intended repository maintenance files explicitly to `MAINTENANCE_FILES`; stage named files and inspect the staged diff.
- Maintain `CHANGELOG.md` for changes to visitor journeys, evidence, dates, privacy, security or publishing. Start under Unreleased; record only checks actually completed and distinguish a commit from a verified deployment before dating a release.
- Update `UX-DESIGN-DECISIONS.md` when a material interaction or navigation decision changes: state the visitor need, options, rationale and verification status. Keep both documents free of private submissions and correspondence; do not claim user research or successful tests that did not occur.
