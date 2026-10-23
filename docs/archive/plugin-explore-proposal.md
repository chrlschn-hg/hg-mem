# Explore connections: UI proposal (planning only)

Owner: UI engineer (client). Status: implemented in `client/**` against the frozen `shared/contracts.ts`; typecheck clean; awaiting root's browser review. Nothing here writes to the demo store, settings, or the user's browser tab.

Superseded by the frozen contract and review, so do not read the older asks below as current:
- No scope explorer, no APPLIES_TO traversal, no hubs. Scope is a readable attribute (kind, name, full root), and "Applies to" is inside the purpose line in rows.
- Explore has three channels only: Filed under, About, Replacement history. No Parent or Children endpoint and no counts for them.
- Member headings are "Filed under <name>" and "About <name>", with the description "Related memories in this workspace". "Memories filed here" and "Current related memories" are retired.
- Related items show no per-row reason and do not render the contract's `via` strings. "Same filing" and "About same person" labels are gone.
- Explore from a memory defaults to filing (subject when unfiled). Replacement history is separate, and "Replaced by" never reads as current.
- Results clears the pane stack and keeps the anchor highlight. Query, page, and scroll survive, and each explore pane keeps its own page.
- Timing is display-only. Future starts read "Not yet in effect", ended records "No longer active", withdrawn stays "Withdrawn as mistaken", and an unknown start reads "May apply".

Inputs: designer graph UX spec, advocate graph acceptance notes, `server/queries.ts` (`recordJson`, `NAVIGATE_ITEMS`),
`skill/hg-mem-recall/references/navigate.md`, and the current `client/memory-detail.tsx`, `memory-rows.tsx`, `memory-panel.tsx`.

## 1. What the user sees

**Rows (list pane).** Keep title, excerpt, badges, and the existing `Purpose · scope` line. Add one line only:
- `Filed under: Software › Storage › SQLite` when filed. Full Domain › Area › Topic chain; no placeholder for a missing level.
- Else `About: Demo operator` when an ABOUT subject exists. Never labeled "Asserted by".
- Else nothing. Tail-truncated to one line. Full paths live under Explore connections.

**Detail (memory pane).** Visible outside Advanced:
- `Filed under` breadcrumb, `About` (operator subject), and `Applies to` (scope kind and name).
- One secondary `Explore connections` action in the action row, beside `Preview attachment text`.
- Historical memories show a banner before title and content: "Historical record · Withdrawn. Kept as evidence, not current guidance." or "No longer active · Ended <date>." No current-instruction styling.
- `Connected records` leaves Advanced. Advanced keeps only ID-level rows.

**Explorer (same detail pane, no new screen).**
- Trail row at top: `Results › Concise answers › SQLite`. Every crumb except the last is clickable.
- `Results` returns to the list with query, page, selection, and scroll unchanged.
- Back label: "Back to results" when the previous step is the list, "Back to memory" when it is a memory, otherwise "Back to <name>". Each Back pops one step.
- Header: named current node, type, and origin, e.g. `SQLite · Topic · Reached from Concise answers`.
- Grouped, full-width rows. Each relation appears once. Rows reuse `MemoryRow` for memories.
- Each group shows 5 rows, then `Show all (N)`, which pages inside the same pane.
- Empty copy: "No related memories available here." (not "no relations exist", since limits can hide them). "No replacement links recorded." when history is empty.

**Why-reached label.** Each related memory shows why it is here: "Same filing: SQLite", "About same operator", or "Same declared scope: hg-mem". The label comes from the group the user walked through, so the backend does not return a reason per row. Related memories also keep their required, status, and validity badges. A shared relation is not source verification, and the copy never says a source was checked.

## 2. Groups per focus (one hop only)

| Focus | Groups |
| --- | --- |
| Memory | Filed under · Applies to · About · Replacement history |
| Topic, Area, Domain | Parent or children · Current related memories |
| Scope | Current related memories |
| Operator | Current related memories (ABOUT only) |

Rules:
- Filing never implies applicability. "Applies to" lists APPLIES_TO only.
- A memory has no current-related group. Siblings are reached by clicking its filed-under node, which lists that node's current memories.
- Current related lists use the same eligibility as browse and stay scoped to the current workspace. Ineligible memories appear only under Replacement history.
- Replacement history is exact evidence: retired, retracted, and superseded records keep their own state.
- Replaces (older) and Replaced by (newer) are separate. "Replaced by" does not mean the successor applies now; each row shows its own validity. No "Current" label unless validity supports it.
- No new Source or author edges. `source_ref` and `asserted_by` stay evidence fields. ABOUT is the operator subject only.

## 3. Client state (MemoryPanel)

- Unchanged: `mode`, `searchText`, `query`, `offset`, `selectedId` (the list row the user started from), `creating`, `draft`.
- Added: `focus: Focus | null` (the node being explored) and `trail: Focus[]` (earlier steps).
  `Focus = { kind: 'Memory' | 'Domain' | 'Area' | 'Topic' | 'Scope' | 'Operator'; id; name; origin }`.
- Walk pushes the current focus to `trail` and sets the target. Back pops. A crumb truncates `trail`. `Results` clears both.
- A relation never rewrites `searchText` or `query`. Related lists use focus queries, not the search query.
- The list stays mounted in both layouts already. Scroll restore on return needs a check: narrow hides the list with `display: none`.
- Narrow: the explorer replaces the list in the single pane (existing rule). Crumbs collapse to `… › parent › current` when short on width.

## 4. Backend asks (UI requirements, not a contract)

Root owns the shape. The UI needs these facts, typed, with no `via` strings:

1. **Filing chain**: `filingPath: { id, name, kind: 'Domain' | 'Area' | 'Topic' }[]`, top-down along CHILD_OF. Empty when unfiled. Today `recordJson` returns one `filing` topic.
2. **About subject**: `subject: { id, name, kind: 'Operator' } | null`. Today only `subjectId` (no name).
3. **Explore query per focus** (one call): node header (name, kind, status); groups with counts and bounded lists for filedUnder, parentOrChildren, appliesTo, about; `members` (current eligible memories, paged, workspace-scoped) for taxonomy, scope, and operator focus; `replacementHistory` (replaces, replacedBy) for memory focus, with status, validTo, and validity. History is exact and not eligibility-filtered.
4. **Traversal** must include APPLIES_TO. The navigate recipe omits it today. SUPERSEDES records must not be dropped as ineligible for history.
5. **Paging**: `offset`, `limit`, and `total` on every list.
6. **Scope rows**: kind and name. Root path is optional and belongs in Advanced.
7. **Truncation signal**: `total` plus a limit-reached flag, so the UI can tell "none" from "not shown".

Gaps today, from the code: `navigate` omits APPLIES_TO and returns only `via` strings. Revision nodes are skipped as ineligible, so history cannot surface. `recordJson` has one filing topic and no operator name. `memoryBrowse` cannot filter by node.

## 5. Client work after freeze

- `types.ts`, `hooks.ts`: add `Focus` and `TrailStep`. Replace `useMemoryNavigate` with `useMemoryExplore(focus)` and a paged members hook.
- New `memory-explore.tsx`: header, trail, groups, and history block.
- `parts.tsx`: `Breadcrumb`, crumbs at control height, 14px text, `›` separator.
- `memory-detail.tsx`: visible Filed under, About, and Applies to; `Explore connections` action; historical banner; `Connected records` removed from Advanced.
- `memory-rows.tsx`: the single filing or About line.
- `memory-panel.tsx`: focus and trail state, with open, back, and crumb handlers.
- `labels.ts`: filing path, About, why-reached, and history labels.
- Layout unchanged: 36px desktop and 44px compact controls, 12px inner padding, reserved rail.
- No store, settings, or demo writes.

## 6. Verification (after build)

- Typecheck.
- Root tests the explore RPC against a scratch database. The live demo has 3 memories and likely no revision nodes, so history needs fixtures.
- Captures at compact 390, narrow 700, and desktop 1280. Cover: row filing line, detail with Explore connections, explorer for memory, topic, scope, and operator, history block, historical banner, and empty states. Read-only on the demo.
- Round trip: explore, then a related memory, then Results. Query, page, selection, and scroll must all survive.

## 7. Open questions

1. Rows: the designer asks for an `Applies to:` label on scope text. Proposed: keep the existing `Purpose · scope` line for now.
2. Group cap of 5 rows and page size.
3. Long filing paths on compact: tail truncation (proposed) or keep the leaf visible.
4. Action label: `Explore connections` (designer spec) or `Explore related` (lead wording). Proposed: `Explore connections`.
