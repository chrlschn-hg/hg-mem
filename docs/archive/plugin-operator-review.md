# Memory plugin: operator acceptance review

Date: 2026-10-23. Reviewer: End-User Customer Advocate.

This is an independent acceptance review for the first iteration, begun while
the plugin was a scaffold. Later sections distinguish live observations from
planned checks and teammate reports. The lead now operates the installed plugin
with disposable fixtures. This reviewer has not changed a memory database,
plugin installation, or host setting.

For the latest product critique and fix status, see
[Ranked critique](#ranked-critique-of-the-running-first-iteration) below. Earlier
passes cover specific observed states, not an overall usability endorsement.

The operator should be able to save something worth remembering, understand what
it means and where it applies, then choose what context to give an agent. Ordinary
flows should not require graph terminology, internal IDs, SQL, or runtime paths.

## Four acceptance scenarios

Use a disposable test store with a named operator and two named projects. Do not
write these examples to the operator's real memories. Saving is intentional only
where a step explicitly says **Save**. Before testing, confirm the UI points at the
disposable store; otherwise exercise the form without submitting it.

| Scenario | Exact operator steps | Pass condition | Failure that matters |
| --- | --- | --- | --- |
| Remember a personal preference | Open Memory from the workspace. Choose **Add memory**, then **Preference**. Enter “I prefer concise answers with commands I can copy.” Review the named operator and **Applies to**. Choose **All projects** explicitly if offered, then **Save**. Return to the list and reopen the item. | Text and scope survive reopening. The item is visibly a preference. It is not a required instruction unless the operator chose that separately. Feedback says it was saved. | Hidden global scope; provider/agent mistaken for the person; a preference automatically becomes required; “agents will now follow this” asserted on save. |
| Record a correction | In the test project, add **Correction** with “Do not run migrations without my approval.” Choose **Required instruction** explicitly, review scope, record the instruction source, and **Save**. Search an unrelated word, then open **Instructions**. | The saved instruction is in the complete applicable instructions view regardless of the search words. Its detail distinguishes who said it, supporting source, and required status. A correction without that explicit required choice remains distinguishable. | Correction category alone confers authority; lexical search hides required instructions; one loaded page looks like the complete inventory. |
| Find project knowledge and why it was saved | Search for a fixture titled “Test command for the API,” summarized as “The API test command is documented in the contributor guide,” with its source locator. Open the result, inspect its content, context and source, then return to results. Repeat in the other test project. | Detail explains what was worth retaining, where it applies, who supplied it or whether it was inferred, and where supporting material can be checked. Back preserves the query. The other project does not receive this project-only note. | Filing category treated as applicability; source locator presented as verified content; absent source silently treated as proof; returning loses the search. |
| Give selected memory context to an agent | From an existing test-agent composer, open the native attachment picker, select two eligible memories, inspect the staged context, remove one, and cancel once. Repeat and submit only when that test explicitly authorizes an agent turn. | Selecting or cancelling starts no agent turn. The operator can identify and remove the staged item. Sent text contains the chosen content, public ID, scope, authority, source and snapshot time. Bounded content is visibly truncated when necessary. | Attachment silently sends; stale/retired items appear current; actual prompt contains more than the selected context; selecting a summary implies the full source document was attached. |

“Inspect the staged context” can be a detail view or another clearly reachable
preview; it does not require a custom attachment UI. Use Paseo's native picker,
selected pills, draft state, and submission behavior wherever the installed
0.12.0 surface supports them. The minimum is that operators can tell which memory
will be sent and remove it before submission.

## Highest-priority friction risks

1. **Scope and person are hidden.** Show **Applies to: [project name]** and the
   selected operator before save and in detail. Do not label a directory scope
   “This project” if it excludes other worktrees. With no project binding, explain
   what context is missing and provide a setup action; do not silently use global.
2. **Purpose is mistaken for authority.** Use human labels such as Preference,
   Correction, and Project knowledge. Keep **Required instruction** independent.
   Existing inferred corrections must say they were inferred rather than imply a
   human ordered them. Do not require an extra confirmation for ordinary saves;
   the explicit field and save action should make the choice reviewable.
3. **A saved record is mistaken for agent adoption.** Say **Saved** or **Added to
   message** for those events. A saved item, search hit, selected pill or attachment
   receipt does not establish that an agent read it or will comply.
4. **A source locator is mistaken for checked evidence.** Display a source label
   or path separately from the memory summary. A document summary helps locate
   information; it cannot substitute for checking the source before answering.
   Missing sources should read **No source recorded**. Failed source access should
   preserve the summary and offer a usable next step without implying verification.
5. **Failures discard effort or invite duplicate writes.** Keep the draft and show
   inline recovery after a rejected save. Distinguish a confirmed failure from
   **Save outcome unknown**; the latter should offer a way to inspect whether the
   item exists before retrying. Disable repeat submission while a save is pending.

## Secondary walkthrough checks

- Empty store: explain that nothing is saved yet and offer **Add memory**. Empty
  search: preserve the query and offer **Clear search**. Missing setup or unavailable
  host: state the problem and a next action instead of rendering an empty list.
- Instructions: distinguish **None apply here** from loading, failed, partially
  loaded, or unknown coverage. Include required preferences and required project
  knowledge, not only corrections. Keep the inventory independent of search.
- Historical records: retired, retracted, replaced, future-effective and uncertain
  validity must not look like ordinary current instructions. If the first iteration
  omits management of history, it must still label history that it exposes.
- Conflicting records: do not silently choose one based on filing, specificity or
  recency. If conflict detection is out of scope, do not advertise a conflict-free
  or authoritative merged answer.
- Drafts: navigating to detail and back preserves useful state. Closing an edited
  form should not silently erase meaningful input when the available host controls
  can preserve it or warn. A reload must not show an unsaved draft as committed.
- Compact layout and keyboard: title, scope, text, required choice, source and save
  must be reachable without horizontal scrolling. Focus order follows the form;
  errors identify the affected field; keyboard access works for primary actions.
- Selected context: a snapshot has a capture time and does not claim live refresh.
  If project context is unavailable in the native picker, disclose and constrain
  the available scope instead of silently searching all projects.

## Review evidence and next step

Read the integration proposal, memory schema, plugin reference sections for
workspace panels, attachments, command center, slash commands and host UI. The
reference includes post-0.12 APIs; implementation must use installed-version
evidence. Product design owns exact layout and version compatibility.

Early scenarios and risks were sent to the lead, UI engineer and designer through
Paseo. Browser tools are not injected into this reviewer's tool list, but the lead
provided a development helper that calls the existing native Paseo MCP endpoint.
Read-only access was verified: browser `1d6809c7-32db-4521-a0d8-0ccf3c789eed`
returned a successful snapshot at `http://127.0.0.1:6767/`, with an empty document
and zero nodes. The plugin was not yet installed. This verifies access only; no
operator flow has passed. The lead owns navigation and interaction, with plugin
screenshots and coordinated walkthrough still pending.

For each live finding, record: scenario and step, exact observed result, expected
result, screenshot location when available, severity, and smallest useful fix.
Use **blocker** for wrong scope/authority, lost or unintended writes, unintended
agent submission, or an unusable primary flow; **major** for a misleading result
or material workflow friction; **minor** for a localized clarity or layout issue.

## First UI evidence: setup state

The UI engineer supplied a desktop screenshot of the Memory workspace tab at
`http://127.0.0.1:6818/h/srv_mpbwHwXzHyp-/workspace/wks_3ba37677426b1d8e`.
I inspected that image and read the shared browser snapshot after the lead had
opened Memory setup. I did not navigate, click, save settings, or create a store.

Screenshot:
`/Users/charles.chen/.claude/projects/-Users-charles-chen-code-hg-sandbox-2026-hg-mem/53e3aa9e-c5c5-406b-87dd-af9587f822a8/tool-results/mcp-paseo-blob-1792776552838-mjpy4f.png`.

| Check | Observed result | Assessment |
| --- | --- | --- |
| Unconfigured Memory tab | “Connect a memory store,” prominent “Open memory settings,” secondary “Check setup,” and host-local storage explanation. | Partial pass: a visible next action and native layout. The action itself was not exercised by this reviewer. |
| Main-tab setup explanation | First body sentence is “Choose the SQLite CLI path. Homebrew SQLite 3.53 or newer is required.” | Major first-run friction: engine details lead the ordinary entry flow. Smallest fix: use “Finish memory setup on this host to save and find memories” on the tab, retaining exact diagnostic and runtime paths in settings. |
| Settings with missing runtime | Snapshot reports a missing GraphQLite library path; the extension field says “Blank uses the suggested extension.” No usable default is established in the visible state. | Major recovery friction if this remains after installation: a suggested value can still be missing. Smallest fix: identify that the default is unavailable and point to the exact setup documentation or working local-path selection. Do not imply that saving blank fields repairs it. This is an in-progress setup observation, not a final install failure. |
| Setup versus store creation | Settings feedback says “Setup saved. Saving does not create or change the memory store.” | Pass for copy clarity in the observed state. No storage behavior tested. |
| Agent adoption | Settings states that skills are not installed and the memory workflow is unavailable to agents. | Pass for visible distinction between UI setup and agent readiness in this state. No adoption behavior tested. |

All four primary workflows remain untested end to end. Compact layout, keyboard
access, data-entry behavior, saved scope/authority, search results and attachment
submission still need coordinated evidence after the lead finishes setup.

## Live saved-correction review

The lead subsequently completed setup and reported saving two fixtures through
the real UI: **Concise answers** as a non-required global preference, and
**Approval before migrations** as a required directory correction with a source.
The lead reports exact-record RPC confirmation of content, operator, purpose,
scope and the preference's operator relationship. These writes used
`operator:plugin-test` and a disposable store; the lead reports the original store
was untouched. This reviewer did not perform or independently verify those writes.

I independently read the live native-browser snapshots of the correction's save
receipt, Instructions inventory and detail, then inspected the lead's preserved
desktop screenshot at
`discovery/plugin-v1/instruction-detail-dark.png` (1462 × 1242).

**No blocking UX issue was observed in this desktop instruction-detail state.**

- The instruction's full text is readable: “[UI test fixture] Do not run migrations
  without my approval.” **Required instruction** and **Correction or prevention**
  are separate labels.
- The detail shows **Applies to**, the name `hg-mem`, the full directory path, and
  **Applies now**. The panel header explicitly calls the scope a directory.
- **Asserted by** names **Plugin test operator** and shows **Explicit**.
- The source locator `paseo:fixture:operator-review` is visible with **Source not
  checked**. The panel does not claim the source was opened or validated.
- Instructions shows **1 required instruction for this directory** and **Showing
  1–1 of 1**. Copy distinguishes listing from agent readership. Its independence
  from unrelated search was not exercised by this reviewer.
- The save receipt says **Saved**, names the record and operator, and offers
  **View memory**. It does not claim agent adoption.
- Detail explains how to use the native attachment picker and that adding does
  not send the message. Attachment behavior remains with the lead for testing.

The observed state meets the correction-detail comprehension portion of scenario
2. Preference detail, project-knowledge discovery, cross-project isolation,
unrelated-search behavior, actual attachments and compact navigation are not
passed by this evidence. The UI engineer is preparing a separate compact browser
view; this reviewer has not clicked, navigated, resized or submitted anything in
the lead's browser.

## Compact screenshot review

The UI engineer used a separate browser tab and requested a 390 × 844 viewport.
Its image output is 427 × 925 pixels; these are the reported viewport and actual
artifact dimensions, respectively. The engineer reports no typing, saves or
settings changes, and reports navigating back and scrolling to the form actions.
I independently inspected five supplied screenshots from this folder:

`/Users/charles.chen/.claude/projects/-Users-charles-chen-code-hg-sandbox-2026-hg-mem/53e3aa9e-c5c5-406b-87dd-af9587f822a8/tool-results/`

| Screenshot | Independent observation |
| --- | --- |
| `mcp-paseo-blob-1792776800167-l5xgol.png` | List entry shows operator, directory context, search, New memory, and a separate required-instruction summary. |
| `mcp-paseo-blob-1792776814000-xp80wv.png` | Saved preference appears as About me · Global without a Required instruction badge. Correction has that badge. Project knowledge is separately labeled. Pager shows 1–3 of 3. |
| `mcp-paseo-blob-1792776827881-7zw9ek.png` | Compact correction detail has Back to results, separate required/purpose badges, full correction text, directory path, current applicability and named operator. The screenshot does not show the source lower down; source availability is supported by the engineer's snapshot report and earlier desktop evidence. |
| `mcp-paseo-blob-1792776851253-f9j51e.png` | Create form keeps the content/title inputs and wrapping purpose choices within the visible width. |
| `mcp-paseo-blob-1792776860801-eqrbzv.png` | The scrolled form exposes Save memory · This directory, Cancel and Clear draft, with explicit copy that saving does not send to an agent. |

**No blocking UX issue was observed in these compact screenshots.** The visible
list, detail and form content stays within the available width. Saved preference
and required correction are distinguishable. The engineer reports that Back to
results restored approximately the prior scroll position; a separate screenshot
of that state was supplied but this reviewer did not independently exercise it.

The pinned context header consumes roughly one third of the phone view, adding
scrolling. This is a nonblocking density improvement: preserve the scope kind and
directory name in the compact header while keeping the full path available in
detail and the save form. The screenshots also contain old **Domain** filing and
**Source (optional)** copy; the engineer reports source fixes awaiting reload.
Those fixes are not passed by these older screenshots.

Keyboard-open behavior, assistive-technology interaction, actual form submission,
unrelated searches, multi-page instructions and attachment delivery remain outside
this compact screenshot pass. The lead continues attachment testing.

## Ranked critique of the running first iteration

The user requested a broader critique after the initial blocker-only checks.
This assessment uses the actual running-plugin dark and light desktop and compact
captures, the lead's attachment parity artifact, and read-only DOM inspection.
All shown records are synthetic fixtures. No screenshots demonstrate an unintended
write, unintended send, or silent scope escalation. **No such blocker is proven.**
The first iteration is understandable once a record is open, but finding a record
and reviewing context for an agent takes more navigation and scrolling than it
should. The priorities below address that daily effort.

Paths in this table are relative to `discovery/plugin-v1/`. **Major** means
material workflow friction to fix before broad use; **follow-up** means useful
iteration work without evidence that the core flow is unusable. Already assigned
work is recorded for severity and verification, not as a request to implement it
again.

| Priority / status | Screenshot and element | Operator impact | Smallest useful fix |
| --- | --- | --- | --- |
| **1 · Major baseline issue · resolved in observed aftershots** | `instruction-detail-dark.png`: Close and Show details; `instructions-page2.png`: Previous. | Dark green navigation resembled disabled text. Read-only DOM inspection also found no `aria-selected` on the two tabs in the loaded baseline. | Aftershot `after-dark-compact-detail-action.png` has clearly readable foreground navigation. Independent post-reload DOM inspection now reports Memories `aria-selected=true` and Instructions `false`. This closes the observed issue, while full screen-reader navigation remains untested. |
| **2 · Major baseline issue · resolved in observed aftershots** | `light-compact-list-default.png`: repeated workspace/context header and large instructions card pushed the first record to the bottom. | The user had to scroll before browsing meaningful content. Headings and help text outranked actual memories. | `after-light-compact-list-default.png` and `after-dark-compact-list-default.png` now show three complete result rows with a short context header and inline Instructions (31). The remaining duplicate Memories heading is minor; no additional density work is required to close the material issue. |
| **3 · Major baseline issue · resolved in observed aftershots** | `attachment-preview.png`: preview below source/details. `attachments-staged.png`: truncated UUID in each staged chip. | Review was difficult to discover, and chips did not communicate authority or scope. | `after-light-compact-detail-preview.png` and `after-light-wide-detail-preview.png` place the preview directly after the body. `attachments-after-critique.png` shows Preference · Global and Instruction · hg-mem. These changes close the demonstrated discoverability and chip-identity problems. Snapshot semantics remain a separate follow-up below. |
| **4 · Major baseline issue · resolved with live interaction report and final aftershot** | `instructions-page2.png` showed the old bottom-only pager. The lead's final attached Instructions page-2 aftershot shows Showing 31–31 of 31 and Previous both above and below the single final row. | The old layout required scrolling through a long first page to find Next. | The lead reports opening Instructions after reload, finding two Next controls, clicking the first, and reaching page 2. I independently inspected the supplied final image and confirmed the range and Previous at both positions. This closes the rendered pager evidence gap; I did not repeat the interaction. |
| **5 · Follow-up · preview meaning** | `light-compact-attachment-text.png` and `light-wide-attachment-text.png`: Attachment text and platform note; `attachment-preview-parity.json`: exact match for one 597-character fixture. | The panel previews the current record. An already-staged attachment is a snapshot. The UI does not make that distinction clear, so a user could read the panel and assume it is inspecting the existing chip. No stale-content mismatch was exercised or observed. | Above the preview, say “Text for a new attachment.” Add “Existing message attachments keep their saved text; remove and add again after a memory changes.” Keep the exact payload selectable and unchanged. Do not label created-at time as snapshot capture time. |
| **6 · Follow-up · scope language** | `instruction-detail-dark.png`: header Scope: directory; earlier compact list shows an About me · Global item. `attachments-after-critique.png`: Instruction · hg-mem. | The header describes directory context, while recall also includes global records and the native picker searches all scopes. The same `hg-mem` name can look like a project binding or a directory boundary. | Use “Viewing: this directory + global” for list context and retain “Applies to” for each memory. Prefer “Directory: hg-mem” in a chip and explain global as “All workspaces on this host.” Keep the full path in detail and save review. |
| **7 · Follow-up · evidence handoff** | `light-compact-detail-top.png`: source `docs/paseo-plugin-integration.md` is plain text followed by Source not checked. | The source distinction is honest, but checking why a memory was retained requires manually selecting a path, leaving the panel and locating the file. | Add a compact Copy source action next to the locator using the supported native clipboard capability. Retain source-not-checked wording. Opening workspace sources can remain a later capability; no fake URL or source verification is needed. |
| **8 · Minor · technical detail hierarchy** | `light-compact-detail-connected-records.png` and `light-compact-attachment-text.png`: Scope IDs, asserted-by ID, Domain and FILED_UNDER path text above the expanded preview. | A user looking for background encounters storage vocabulary and long IDs. The useful filing name is mixed with diagnostics. This is in an expanded section, so it does not block the basic flow. | Keep useful filing and dates under Details; move raw IDs and graph paths into a nested Advanced details disclosure. Keep the exact agent payload available separately, since it intentionally carries technical provenance. |

### What the screenshots establish about scope and authority

The required badge is separate from purpose, the full correction text is readable,
and the detail provides an exact directory path and a named human operator. The
source is explicitly unverified. Those choices should survive visual cleanup.
Do not use a stronger badge to imply the agent has already read or will obey the
memory. The improved native chips distinguish the two demonstrated cases without
requiring the operator to interpret a UUID.

The user can understand the memory's content and evidence from these views. The
next improvement is consistency: use the same plain scope vocabulary in the list,
detail, save action and attachment choice. “Context being viewed” and “where this
memory applies” are related but different concepts.

### Platform limits and remaining evidence

- Paseo 0.12 owns the attachment chips and their open behavior. The known inability
  to reopen a local memory from a chip remains a platform constraint. A visible
  panel preview and meaningful native identifiers are acceptable accommodations
  for this iteration. A fabricated HTTP link would create a misleading action.
- The native sidebar, workspace tabs and composer layout are host-owned. The
  plugin should fix its repeated header, large summary card and low-contrast
  actions without redesigning those host surfaces.
- Matching the preview and attachment API for one unchanged fixture establishes
  payload parity for that fixture. It does not establish that an older chip updates
  live, that another workspace is applicable, or that an agent has followed it.
- Keyboard-open behavior and actual screen-reader navigation are still untested.
  The tab-selected finding came from read-only DOM inspection, not a screen-reader
  session. The engineer's source-level fix needs rendered verification.
- The aftershots independently close contrast, compact density, preview placement
  and chip-identity findings. Selected-tab DOM state was also verified after reload.
  The lead subsequently supplied live Instructions top-pager interaction evidence
  and the final page-2 image; that finding is also closed.

### Current verdict after the fix batch

The shown first iteration is usable for browsing, reading and preparing memory
context, with **no observed blocking UX issue**. This is not an end-to-end adoption
or accessibility certification. The material visual issues above are closed in
the provided states. Preserve the separate required/purpose labels, visible
operator and exact per-record scope, and the source-not-checked disclosure.

Remaining operator priorities, in order:

1. **Scope wording:** make the context-versus-applicability distinction consistent,
   and say directory versus host-wide scope explicitly. The compact aftershot's
   “Scope: hg-mem” is shorter but loses the boundary kind. This is a nonblocking
   copy follow-up, not evidence that the stored scope changed.
2. **Snapshot wording:** state that the panel previews text for a new attachment
   and existing message attachments keep their saved text. No stale snapshot
   mismatch was observed; the known chip limitation remains acceptable for v1.
3. **Evidence convenience:** add Copy source and move graph identifiers into
   Advanced details when that work is prioritized. Both are lower priority than
   the scope and snapshot wording.

The UI engineer reports compact aftershots at a requested 390 × 844 viewport,
default zoom, and wide aftershots at 1280 × 800. They restored Appearance to
System afterward. This reviewer inspected the images and read tab attributes
without clicking, changing settings or submitting a message. The final pager image
was supplied by the lead as attachment
`ed24026547a6ee1c31bd112c6805ceda162aa2a1c5a750e74ea6f7d2d34855e3.png`.
The lead additionally reports Instructions `aria-selected=true` and Memories
`false` in that state. No further UI reads or interactions were performed for
this final evidence update.

## Focused layout and visual review during the user walkthrough

The user subsequently requested clearer section boundaries and consistent button
alignment/sizing. This is a new visual refinement pass on the prepared demo, not
a reopening of the earlier functional findings. I inspected
`discovery/plugin-v1/search-prefix-arch.png`, the lead's fresh default-list image,
and client layout/style sources. I did not interact with either the user's
browser or the lead's background browser. Demo settings, store, agent integration
and the completed prefix-search behavior remain outside this review's changes.

Recommendations were sent directly to the UI engineer and lead, in this order:

| Priority | Observed issue and operator effect | Specific visual recommendation |
| --- | --- | --- |
| **1 · Authority and section boundary** | The bare **Instructions (1)** line looks like a section heading for the ordinary memory results below it. In the search image the next item is project architecture; in the default list it is a personal preference. Users can misread the grouping even though record badges are correct. | Use a slim explicit **View instructions (1)** summary action with a chevron, then a separate results boundary/count. One row around 44–52 points is enough; do not restore the former tall instruction card. Preserve its independence from search. |
| **2 · Action alignment and control families** | **New memory** sits immediately beside a repeated Memories heading; tabs, buttons and plain actions lack a consistent visual role. Source already gives controls a 44-point minimum, so the perceived mismatch also comes from padding and unconstrained stretching. | Place New memory at the trailing edge of the list toolbar and align it with the input/pane inset. Use one 44-point control-height family and consistent horizontal insets; do not force unrelated text labels to equal widths. Distinguish mode tabs as a segmented group. Give navigation/disclosure actions a chevron or underline so they do not resemble static prose. |
| **3 · Detail section grouping** | `Section` currently adds only an 8-point internal gap, while the outer content gap is 12 points. Applicability, author and source can read as one undifferentiated run of labels. The split-pane rule alone does not establish hierarchy within detail. | Separate memory body plus preview, applicability/evidence, and advanced details using deliberate section spacing and subtle theme dividers. Align pane toolbars and content insets. Use stronger section labels than supporting field labels without boxing every field. |
| **4 · Deliberate form action layout** | Save, Cancel and Clear draft share a wrapping row. Long scope-bearing Save text can push peers into accidental rows, making order and button widths vary with pane width. | Keep Save and Cancel aligned on wide panes. On narrow panes, give Save a full row and place secondary actions deliberately below; keep Clear draft visually tertiary and separate. Preserve the full scope-bearing Save label and 44-point targets. |
| **5 · Preserve compact readability** | Adding separators or boxes can undo the earlier density improvements. Window-level compact state can also miss a narrow split pane. | Use the pane's measured width for stacking. Keep summary rows compact, allow labels to wrap without clipping, and verify the result list still exposes useful rows in a 390-point viewport. Do not reduce body font size to make room. |

The UI engineer owns implementation and reports plans aligned with these points.
The lead will reload and provide aftershots. These recommendations are not a
rendered pass of the pending changes. No backend, search, save-pending or
integration behavior change is requested by this visual spec.

### First desktop layout aftershot

I inspected the lead's live aftershot showing **Memory project architecture**
selected (attachment `b4e25f256e62d8e9bbc82d2ee8c7e367243f0e394041d94b23ca5625735ef17e.png`).
**No blocking desktop layout issue observed.** The segmented modes and trailing
New memory action read as a toolbar; search has its own boundary; the slim
required-instruction row no longer reads as the heading for unrelated results.
Selection is clear, and dividers distinguish the memory body/action, applicability,
author/source and Advanced section. Button treatment is consistent enough to
understand which text is actionable.

Two small refinements were sent to the lead and UI engineer, without requesting
unprioritized edits:

- The selected result title nearly touches its green left rail. Add consistent
  10–12-point inner row padding while retaining the shared outer pane edge.
- The summary counts the instruction twice: **Required instruction: 1** and
  **View instructions (1)**. Keep the count on the left and shorten the action to
  **View instructions ›**, reducing width pressure without increasing row height.

This pass covers the supplied desktop state only. The lead is testing compact,
create and narrow-pane states. I performed no browser interaction.

### Final conclusion for the bounded layout pass

**Accepted for the visual scope reviewed: no blocking issue in the supplied
desktop, compact-list, compact-form or narrow-desktop states.** Section boundaries
and action hierarchy are substantially clearer, and controls form a consistent
visual family. This conclusion concerns layout, not new evidence of data or
search behavior.

Additional evidence inspected:

- The lead's compact-list aftershot
  (`f76c54111b62594e794938ea42f1ac75e10d32ccbea8cdd9ce91125973f64996.png`)
  shows the mode controls and New memory in one toolbar, search in its own group,
  a separate instructions summary, and all three demo memories plus the range.
  The preference is no longer visually grouped beneath an Instructions heading.
- `discovery/plugin-v1/layout-after-compact-create-footer.png` shows distinct
  applicability, instruction and filing groups. **Save memory · This directory**
  occupies a full-width row without losing its scope; Cancel and Clear draft are
  deliberately separated below it. The image is a scrolled form state, not a
  keyboard-open or submission test.
- `discovery/plugin-v1/layout-after-narrow-desktop-detail.png` shows the reported
  900-wide desktop viewport using a single detail pane when available panel width
  falls below 760. Back to results is prominent, content fits, and body/preview,
  applicability, author/source and Advanced sections remain distinct. There is no
  cramped two-column detail layout in this state.

The lead has requested final small refinements: 12-point inner result padding,
one instruction count in the summary, and use of effective narrow-pane state for
the form footer. These are sensible consistency refinements and are not blockers
in the images reviewed. Their final rendered state is not claimed by these
pre-refinement screenshots. No additional UI interaction, settings change or data
write was performed by this reviewer. Prefix search and agent integration are
outside the visual acceptance scope.

### Final grid refinement closure

The lead supplied the latest running-bundle aftershot
(`0a7c9c5aa13e54870d305854b040c5a8f2001150b08d1a44624757ac7604aec5.png`).
I inspected it and confirmed that selected and unselected row text aligns with
comfortable inset from the selection rail, and the instructions summary now
states **1 required instruction** once beside **View instructions ›**.

The lead's DOM measurements independently report 12-pixel padding on all three
rows, identical text and row X positions, and reserved rail space for every row.
These measurements are lead-reported; this reviewer made no further browser read.
The row-padding and duplicate-count refinements are now **closed**.

**The bounded layout/visual review is complete and accepted in the supplied
states, with no outstanding visual blocker.** Earlier scope/snapshot wording
follow-ups remain outside this pass. The lead's final compact and prefix-search
checks are separate validation; no new behavior claim is made here.

## Holistic graph workflow review — October 23, 2026

The user requested a fresh team review of the explicit-split graph UI, then
asked for menus/popdowns and denser controls. Earlier bounded acceptance closed
specific clipping and recovery problems; it did not establish that the overall
composition was easy to use. This review considers finding, selecting, reading,
expanding and returning as one operator task.

Evidence inspected without browser interaction:

- `discovery/plugin-v1/graph-explicit-split.png` — 991×900 CSS viewport.
- `discovery/plugin-v1/graph-final-wide-properties.png` — 1280×900 CSS viewport.
- `discovery/plugin-v1/graph-compact-node-list-final.png` — 390×844 CSS viewport.
- `discovery/plugin-v1/graph-compact-inspector-final.png` — the scrolled compact
  context inspector.
- `paseo-hg-mem/client/memory-panel.tsx`, `memory-graph.tsx`,
  `memory-browse.tsx`, `graph-canvas.tsx` and `styles.ts`.

### Ranked operator friction

| Rank | Observed evidence and operator effect | Proposed correction within existing capability |
| --- | --- | --- |
| **1 — Control hierarchy obscures the task** | The explicit-split screen has app tabs/New memory, a separate Details Auto/Split row, List/Graph, then a wrapped status and duplicate Use list. On compact, the first readable loaded-node row begins around image y830 of 925. The canvas labels at this scale are too small to replace that list for exact selection. | Use one graph toolbar. Retain visible List/Graph and a named loaded-node action. Move layout choices into a compact Layout menu; remove ordinary duplicate Use list. Keep Retry and Use list direct in a failure state. Use 32–36-point desktop controls and preserve 44-point touch targets. |
| **2 — Selection moves to different destinations** | A selected memory is repeated below the canvas, in the highlighted node row and in the right detail pane. A selected Topic instead puts its inspector below the node list. Source confirms that context selection clears the memory pane, then renders the context Inspector after the canvas, selection summary and LoadedNodes. Users must find properties and Expand in different places depending on node kind. | One selection inspector handles memory or context. Keep the selected title, relevant authority/history cues and actions together there. The loaded-node list remains a way to select; it should not become another properties view. |
| **3 — Counts and context have unclear meanings** | The graph reports “30 of 41 shown” and “31 memory and 8 context nodes loaded.” The Topic inspector reports both “Loaded links: 25” and “Loaded 20 of 26.” A directory caption appears above memories with Global applicability. These are ambiguous descriptions, not evidence of incorrect data. | Name the search-results seed separately from the loaded graph. Use the expansion coverage beside Expand/Load more; remove or subordinate the redundant adjacent-edge count. Label workspace context as context and retain actual per-record scope, timing and historical status in the inspector. |

Source anchors: `memory-graph.tsx:82` selects by node kind;
`memory-graph.tsx:189` combines the result and graph counts;
`memory-graph.tsx:203` orders canvas, summary, loaded list and context inspector;
`memory-graph.tsx:355` shows adjacent-edge count while `memory-graph.tsx:372`
shows expansion-page coverage. `memory-panel.tsx:164` clears the existing memory
detail on context selection. These lines describe the reviewed source and may
move during later implementation.

The count distinction matters: result count describes the original query/page;
graph count includes loaded expansions and historical endpoints; adjacent-edge
count includes all drawn incident edges; expansion coverage counts records
returned through that specific expansion. No data or query change is required
to explain them accurately.

### Continuity risks and checks

These are review criteria, not claims that a live failure was reproduced:

- List/Graph conditionally replaces `MemoryGraph` in `memory-panel.tsx:328`.
  Panel state retains selected ID and expansions, but the canvas is unmounted
  on List. Previously tested preservation of the same canvas under a covered
  detail does not establish camera restoration after a List/Graph roundtrip.
- Search and paging currently live in List. Changing either starts a new graph
  generation and clears expansions. The composition should make a new search
  distinct from returning to the same exploration.
- Opening or dismissing the proposed Layout menu must preserve selection,
  expansion, camera and inspector scroll. Escape/outside click should dismiss
  it and return focus to its trigger; selected Auto/Split state must be clear.
- The same Layout control must remain reachable in single-pane detail. Explicit
  Split remains the user's choice; Auto remains available to return to the
  responsive presentation.
- The shared inspector must expose required/history cues before memory content
  and keep scope/timing/source support distinct. Context relations do not imply
  authorship, truth or applicability.

The designer owns the coordinated desktop/narrow composition. Findings and these
constraints were sent directly to the designer, UI engineer and lead. No source,
browser, settings or memory-store changes were made during this review.

### Agreed composition for implementation

The advocate agrees with the designer's authoritative composition. The lead
accepted it for the client-only build, conditional on the installed-host menu
spike passing. The wireframes below record that same proposal, not an alternative.
They supersede the initial hidden-Layout and below-canvas-context-inspector
strawman in the engineer's [composition review](plugin-graph-composition-review.md).

Desktop, when the available panel width supports the composition:

```text
Memory + short operator/context | Memories Instructions Help | New memory
[existing search, flexible] [List | Graph] [Nodes (39) v] [Layout: Split v]
Results 1–30 of 41                         Graph: 39 nodes
+----------------------------------+ +--------------------------------+
|                                  | | ONE selection inspector        |
| Canvas fills remaining viewport  | | Memory: body, scope, timing,   |
|                                  | | required/history/source cues   |
|                                  | | OR context: kind, actual path, |
|                                  | | 20 of 26 memories loaded       |
|                                  | | [Load more (6 left)]           |
+----------------------------------+ +--------------------------------+
```

Identity, primary tabs and New memory share a row only when measured content
fits. Otherwise identity/New is one row and primary tabs one row. New memory
does not wrap onto a row by itself, and labels are not squeezed to force a fit.
Canvas and inspector align at the top. Only inspector content scrolls; no outer
body scroll moves the canvas out of view.

Auto narrow:

```text
Memory + short operator/context                         [New memory]
[Memories | Instructions | Help]
[existing search field, full width]
[List | Graph] [Nodes (39) v] [Layout: Auto v]
Results 1–30 of 41                         Graph: 39 nodes
+------------------------------------------------------------------+
| Canvas fills the remaining graph viewport                         |
+------------------------------------------------------------------+

Select ANY node kind:
  Shared toolbar remains reachable, especially Layout.
  Body becomes one inspector with [Back to graph].
  Memory reading and context Expand/Load more use this same location.
```

Explicit Split remains a user choice at every width. It puts graph and the same
inspector beside each other, with the existing 42% inspector share capped at 380
and `minWidth: 0`; no forced minimum creates horizontal overflow. Auto is the
route back to the readable single pane. Split is not silently redefined as a
stacked layout.

The toolbar's named Nodes control opens the existing loaded-node selection
route: a bounded anchored picker on desktop and bounded sheet on compact. It
does not sit below the canvas or hide behind an unlabeled overflow control.
Layout uses the same verified menu primitive and exposes its current selection.
Desktop controls use 32–36-point sizing; compact controls retain 44-point touch
targets. Body typography stays readable.

Remove the permanent Details row, normal-state duplicate Use list, under-canvas
selected-summary block and always-visible interaction hint. Required/history
cues remain in the node row and inspector where they identify the record. Node
type breakdown belongs in Nodes. The inspector shows one linked-memory coverage
count beside Expand/Load more; the drawn-edge count is removed. Actual failures
retain direct Retry and Use list actions.

Overlay adoption requires reliable Escape/backdrop dismissal, no click-through
to the canvas, correct focus entry/return and selected-state announcement in the
installed host. Selecting a node closes its picker and moves focus into the
inspector; dismissing a menu returns focus to its trigger. If this is unavailable
in 0.12, use an honest in-flow disclosure in a bounded existing region, without
extending the graph body or pushing the canvas away. Runtime menu behavior is
not established by the design or by SDK type declarations.

One source-derived continuity check was added for the relocated shared search:
committing a different query should visibly return to the active List/Graph
results and clear the old selection/inspector with the existing graph-generation
reset. The user should not remain looking at an old narrow detail while new
results load behind it. An unchanged query, view switch, or menu opening must
not reset the exploration. This integration behavior awaits implementation and
live verification; it is not a claim of a reproduced failure.

**Review outcome:** the team agrees on one composition that addresses the ranked
friction. Implementation and menu behavior are not yet visually accepted. The
advocate awaits the lead's aftershots and interaction evidence. Only this review
document was edited by the advocate.

### First density-build desktop evidence

Inspected `density-graph-wide.png` and `density-context-split.png` in
`discovery/plugin-v1/`, without browser interaction. No blocking placement or
overflow problem is visible in these two states. Search, List/Graph, Nodes and
Layout form one task toolbar. Results-page range and graph-node count are named
separately. The selected Paging Topic now uses the right inspector, with its
actual path, applicability caveat and Expand action together; the former
below-canvas context-inspector destination is absent.

One specific copy issue remains in the context screenshot: **“Connections are
not loaded yet”** appears beside a graph already showing many edges to Paging.
That text describes an expansion request that has not run, not the loaded graph.
Recommended minimal replacement: **“Expand this topic to check for more linked
memories.”** The wording does not promise that additional memories exist. The
finding was sent to the lead, engineer and designer; no model or count change is
requested.

The supplied screenshots show the disclosures closed. Their open bounds, focus,
selection behavior and the compact return flow remain outside this desktop
screenshot acceptance. Lead-run interaction checks will supply that evidence.

### First compact density evidence — changes still needed

Inspected `density-compact-nodes-open.png` and `density-compact-context.png`.
The lead already assigned the header/New memory wrapping, segmented List/Graph,
focus-on-choice, required label and expansion-copy fixes. Two additional findings
were independently identified by the advocate and designer and sent to the team:

1. **P1 — Layout is missing from the single-pane context inspector.** Only Back
   to graph is visible above Paging. The agreed explicit Auto/Split choice must
   remain reachable while inspecting either node kind. Put the same Layout
   disclosure beside Back to graph, with no new permanent options row.
2. **P2 — The compact Nodes disclosure is too tall.** Its complete card occupies
   about 315 CSS pixels and leaves about 80 pixels of canvas in the supplied
   390×844 viewport. Use the designer's cap of the smaller of 200 CSS pixels or
   40% of available body height, including the summary. Let only the list scroll.
   A one-line **31 memories · 8 context nodes** summary avoids the current
   three-line enumeration. Preserve readable rows and 44-point touch targets.
   After the separately assigned header/toolbar fixes, roughly 200 pixels of
   visible graph is a useful check at this viewport, not a forced minimum that
   overflows shorter screens.

The compact context title, actual filing path, applicability caveat and Expand
group remain readable. These first-pass compact states are not accepted yet.
No browser interaction was performed; return-state preservation remains a
lead-run check.

### Final density aftershots — compact Split blocker remains

Reviewed `density-final-compact-nodes.png`,
`density-final-compact-context.png`, `density-final-compact-split.png` and
`density-final-wide-grouped.png` in `discovery/plugin-v1/`.

Closed in the supplied images:

- Auto compact context has Layout beside Back to graph and the corrected
  expansion copy. Its path, applicability caveat and Expand control are readable.
- The shorter Nodes disclosure leaves materially more canvas visible and shows
  the required-instruction badge. New memory shares the identity row.
- Wide identity/modes/New memory use one measured-fit header; List/Graph are
  grouped and Nodes/Layout remain named, with result and graph counts distinct.

The lead reports node choice focused Back to graph, the Split choice focused
Layout: Split, and the same single canvas object was retained. These are
lead-tested interaction results, separate from this reviewer's image inspection.

**P1 remains in explicit compact Split.** In
`density-final-compact-split.png`, the Paging title paints over List/Graph, its
ancestry crosses the Nodes/Layout row, and result counts collapse into an
approximately 30-pixel strip while inspector content spans most of the panel.
This is overlapping layout, beyond the narrow reading width inherent in the
user's explicit Split choice. The advocate and designer independently agree.

Smallest correction: place the shared toolbar above/outside the split body;
enforce the agreed inspector width share and graph `flex: 1` / `minWidth: 0`;
contain wrapping and painting within each pane. Preserve explicit Split and do
not silently substitute a stacked view. The finding was sent to the lead and UI
engineer immediately. Desktop and Auto compact fixes are accepted in the shown
states; overall density closure awaits corrected compact Split evidence.

### Corrected compact Split — final bounded closure

Directly inspected `density-split-contained-final.png` and
`density-header-right-final.png`. The remaining **P1 overlap is closed** in the
supplied 390-CSS-pixel Split state: shared controls and the result/graph count
sit above the split body; Paging title, path and body remain inside the right
pane; the graph remains inside the left canvas. Neither pane paints over the
toolbar or its sibling. Layout remains reachable. This accepts containment of
the user's explicit narrow Split choice; Auto remains the readable single-pane
alternative.

The wide header capture confirms the user's requested primary tabs immediately
beside New memory at the right. The lead reports actually selecting Layout Split
from the Auto inspector; that interaction is lead-tested, while this reviewer's
evidence is the supplied image. No browser action or source edit was performed.

**The bounded density/layout review is complete for the supplied states, with
no remaining material visual issue.** No further layout or feature change is
requested. Earlier interaction results retain their stated evidence boundaries.
