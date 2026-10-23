# hg-mem Paseo UI: first-iteration critique

Reviewed 2026-10-23 by the UI engineer on the running Paseo 0.12 build, web client, light theme at desktop 1280×800 and phone 390×844. Dark-theme screens came from the lead's run. All content is synthetic fixture data (three named fixtures plus thirty "Synthetic paging fixture" rows). The original database is untouched. No UI code was edited for this review.

Screenshots: `discovery/plugin-v1/light-*.png` (copied from the live run).

## Blockers

**B1. Composer chips identify memories by ID only.**
Element: the attachment chip subtitle, e.g. "Memory d41850fe-0331-4ec3-92f…" (lead's dark composer screen with two staged attachments).
Impact: the operator cannot see kind, scope, or required status before submitting. The picker sends only a query, so search spans all scopes, and a memory from another directory can be attached with no visible scope.
Fix (backend `memory.attachments` subtitle, not UI): "<kind> · <scope name> · required | not required", plus "scope not checked" when the scope is not this directory. Keep the ID in the staged text only.
Constraint: 0.12 chips cannot reopen a memory, so the subtitle is the only check before submit.

## High

**H1. Compact first screen shows about one result row.**
Element: header block (about 215 px at 390 px wide), tabs, required-summary card (about 170 px).
Evidence: `light-compact-list-default.png`.
Fix: reduce the summary to one row, "31 required instructions · Show" (about 44 px). Show operator and directory basename only in the header, and drop the workspace line that repeats the top bar. Expect three or more rows above the fold.

**H2. Compact detail keeps the full panel header above "Back to results."**
Element: the header block, about 200 px.
Evidence: `light-compact-detail-top.png`.
Fix: hide the panel header in compact detail. Keep the back row and title.

**H3. Required instructions sit behind a link.**
The required set is the most consequential content, but it is reached through "Show instructions" on a summary card. Hierarchy challenge: show the first three required rows above search results, collapsible. This is a design decision for the designer, not a defect.

**H4. The attachment preview uses enum terms with no key.**
Element: staged text, e.g. "Purpose: Operational", "temporal validity: APPLIES", "Composer applicability: not checked; selected from all scopes".
Evidence: `light-compact-attachment-text.png`, `light-wide-attachment-text.png`.
Fix: keep the exact staged text byte-identical, since it matches the API at 597 characters. Add a two-line human summary above it, e.g. "Project knowledge · not required · this directory. Scope not checked at attach time."
Constraint: the staged text cannot change.

## Medium

**M1. Applicability claims disagree.**
The detail says "Applies now" (`light-wide-list-detail-approval.png`). The attachment says "Composer applicability: not checked." Fix the copy: detail "In effect now · in scope for this directory"; attachment "Scope not checked at attach time."

**M2. Connected records expose raw relation syntax and a taxonomy node.**
Element: "Domain · … -[FILED_UNDER]-> domain:project-knowledge" and the bare ID line (`light-compact-detail-connected-records.png`). The filing topic also appears as a connected memory. Fix: remove the arrow string, drop the topic from connected records because Filed under already shows it, and move IDs under a collapsed "IDs" line.

**M3. The header repeats the workspace and shows the full path.**
"hg-mem · Build LLM skills for Cypher graph memory" duplicates the top bar. The absolute path wraps to three or four lines on a phone. Fix: remove the workspace line and show "Scope: hg-mem". The full path lives in Applies to.

**M4. The footnote may name the wrong control.**
"choose Memory in the message box attachment picker." The contract's picker title is "Attach a memory." Confirm the exact composer menu label and name it in the footnote.

## Low

- **L1.** Detail actions "Show details" and "Preview attachment text" sit 60–70 px apart. Group them into one row.
- **L2.** Fixed in source and verified live by root. A repeated pager sits above the rows when there are more than 30 instructions. Root opened the Instructions tab after the reload, and the DOM showed two Next actions (top and bottom) with 31 total. Root clicked the first Next, and page 2 read "Showing 31–31 of 31" with Previous at both top and bottom. Root captured the screenshot. The UI engineer did not capture this directly.
- **L3.** Copy: "Listed whatever you search for." becomes "Shown regardless of search." The placeholder "Words from the title or text" becomes "Search titles and text." Use one term, "required instructions": the heading says "31 required instructions" and the summary says "31 instructions."
- **L4.** Muted text in light theme (helper lines, row subtitles) looks borderline. Not measured. Check against WCAG AA before release.
- **L5.** New memory defaults to "Project knowledge," which needs a topic. Default to "About me" unless a topic is the only option.

## Platform constraints (not UI defects)

- 0.12 attachment chips cannot reopen a memory. The in-panel preview is the only pre-submit inspection.
- The picker sends only the query, so attachment search spans all scopes. Directory filtering is not possible in 0.12.
- There is no panel-to-composer staging API. The footnote has to point to the picker.
- The staged text must match the RPC output byte for byte.
- The contract has no relations or conflict data. The UI makes no "no conflicts" claim.
- Keyboard-open behavior is untested.

## Verified in the live build (light theme)

- "Filed under" reads "Project knowledge (Domain)" in wide and compact layouts. Connected records lead with the name.
- The "Source (required)" label and hint appear when the instruction toggle is on.
- The attachment preview shows the snapshot text with the footnote.
- Paging reads "Showing 1–30 of 33" and "Showing 31–31 of 31 · Previous."
- A zero-match search still shows the required summary above "No matches for…"

## Not verified

- Slash command, Command Center entry, setup-screen interactions, the save path, the delayed-response state, and contrast measurements.

## Questions

1. Lead: who owns the attachment subtitle change in `memory.attachments`, and can it ship before the next UI pass?
2. Designer: H1 and H2 hide the panel header in compact detail. Is scope visible enough without it?
3. End-User Advocate: is "all scopes" acceptable for attachments if every chip shows its scope?
