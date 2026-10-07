---
name: kew-ux-review
description: Review Kew Riverside website discovery and usability when navigation, homepage sections, labels, forms, mobile layouts, search or downloads change. Protect existing visitor journeys before implementation and release; skip behaviour-neutral maintenance.
---

# Kew Riverside UX and information architecture review

Find changes that make an existing task harder to discover, understand or complete, including changes whose links still technically work.

Read [the shared review workflow](../../../AGENTS.md#specialist-reviews), [the current journey register](../../../UX-DESIGN-DECISIONS.md#protected-visitor-journeys) and the relevant parts of [TESTING.md](../../../TESTING.md). Resolve paths from this skill directory in the active checkout. Start with the request, relevant diff/proposal and actual entry pages, not a remembered version of the site.

## Review the journey

- Map the new need and all affected existing tasks to journey IDs. Compare the before/after entry labels, location, visual emphasis, scroll depth, decisions and destination. A tested click after automatic scrolling does not prove that a visitor sees the link on arrival.
- Protect exposed Letters and Share ideas, the named Parent action plan shortcut, the official-response route and all six task destinations. Preserve reading letters and ideas as well as submitting them. Secondary tasks, especially children's next steps, evidence and corrections, must remain accessible.
- Prefer a useful existing destination with a short descriptive entry. Check whether a new homepage section or action group duplicates current routes, displaces the task chooser or creates too many competing invitations. Apply the register's scoped placement budget; justify exceptions with a visitor need and evidence.
- Keep global navigation predictable across pages. New local sections need visible links that describe their contents, without forcing readers to know a document title or internal page structure. Keep HTML access alongside research PDFs and clearly label downloads.
- Preserve source/research provenance and essential qualifications at the point of use. Use disclosures for optional depth, not to conceal a deadline, a consent consequence or a limitation that changes a claim.
- Check real recovery paths: no results, conflicting filters, incoming anchors hidden by filters/disclosures, browser Back, old links, returning from a PDF/external form, failed scripts and no JavaScript. Distinguish finding the upload route from successful provider receipt.
- Keep forms understandable with independent permissions, clear optional fields, readable errors and stable focus. Respect the current private-only categories and written alternatives without redesigning the consent policy incidentally.

## Evidence appropriate to the stage

For a plan, identify probable risks and concrete acceptance checks; do not report unimplemented behaviour as tested. For an implementation, inspect the relevant rendered desktop and narrow mobile states through available browser tools, plus keyboard/no-JavaScript paths as appropriate. Apply the existing 320 × 568 arrival baseline, 390-pixel mobile checks and intermediate header widths when affected; allow enlarged text to reflow. Read `TESTING.md` for native iOS requirements and distinguish simulator checks from emulation.

Check whether tests independently require protected destinations rather than merely enumerating whatever links remain. Recommend a regression for an actual changed interaction or failure; do not propose tests that simply restate wording or enforce arbitrary pixel geometry. Specialist inspection supplements the repository's required checks and does not establish user-study results or full accessibility conformance.

Return the shared finding format with a reproducible entry route/state or exact proposed placement, affected journey, consequence and smallest correction. State the device/viewport or source-only limits actually inspected. Stay read-only; do not submit real forms, edit files or spawn other reviewers.
