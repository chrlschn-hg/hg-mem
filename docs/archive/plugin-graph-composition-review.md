# Graph workspace composition review (review only)

Owner: UI engineer. Status: review and proposal. No source, browser, settings, or store edits in this pass.
Evidence: `discovery/plugin-v1/graph-explicit-split.png` (991 CSS wide, current build with the Details row),
`graph-final-wide-properties.png` (1280×900, predates the Details row), `graph-compact-node-list-final.png` and
`graph-compact-inspector-final.png` (390×844). Source: `client/memory-panel.tsx`, `client/memory-graph.tsx`.

## Ranked issues

Observed in the captures:

1. **Stacked controls push the graph down.** On a 390×844 phone the canvas starts about 390 CSS px from the top (estimate
   from the capture). Above it: the title and operator line, the Memories | Instructions | Help tabs, the New memory row
   (it wraps to its own line in compact), the List | Graph row, and a two-line caption. In graph view the Details row adds
   a sixth row.
2. **The "Details: Auto layout | Split view" row is unclear and adds a control layer.** "Details" does not say what it
   controls, and "Split view" forces side-by-side at any width. The row appears only in graph view, so the layout shifts
   when the graph opens. Source-derived risk: at a 770px panel, the forced split gives the inspector about 296px
   (`min(380, (width − pad − 16) × 0.42)`) and the graph about 410px, below the 420px drawable minimum.
3. **The canvas scrolls away.** In the 991 capture the top of the canvas is cut off. The canvas sits inside the same body
   ScrollView as the list and inspector, so scrolling the list also moves the graph out of view.
4. **Nested scrolling.** The node list (maxHeight 220) sits inside the body scroll, and the detail column scrolls
   separately. Two or three scroll indicators are visible at once in the captures.
5. **Columns do not align.** In the 991 split, the detail column starts at the List | Graph row, while the canvas starts
   about 100px lower. The two columns read as unrelated.
6. **The caption is verbose and jargon-heavy.** "Most recent in this directory · 30 of 41 shown · 31 memory and 8 context
   nodes loaded · limit 120" wraps to two lines. "Use list" floats at the far right, away from the caption. "limit 120"
   is engineering vocabulary.
7. **"Use list" duplicates the List chip** in normal states. It should appear only in the failure state.
8. **Labels repeat.** "Required instruction" appears in the selection line, the node-list row, and the detail badges.
   "Filed under: Ranking" appears in the selection line and in the detail section. The detail should be the reader's
   full view; the selection line should shrink to one line.
9. **Compact canvas labels are unreadable at 390px.** This is canvas-owned (fit and zoom). It is not a layout decision.
10. **Panel header partly clipped at the top** in the 1280 capture, with the "Memory" title under the app bar. This may be
    an artifact of a scrolled outer panel. Verify on the next capture.
11. **Two counts with different denominators.** "30 of 41" is the results page. "31 memory and 8 context nodes" is the
    merged graph, including expanded and history nodes. The inspector's "Loaded links: 25" counts every drawn adjacent
    edge, while "Loaded 20 of 26" counts the rows returned by one expansion. Neither is wrong, but a reader can take them
    for the same number. Keep one user-action count, next to Expand or Load more, and label the two denominators in the
    caption.
12. **Selection has two destinations.** Selecting a memory opens the right-hand detail. Selecting a context node clears
    that detail and renders its inspector below the canvas, after the summary and node list. The inspector and its
    Expand controls sit in a different place from the memory detail. (Source: `select` in `memory-graph.tsx`, `clearDetail`
    in `memory-panel.tsx`.)

Source-derived and untested risks (not seen in the captures):

- A wheel over the canvas scrolls the body, because the canvas is inside the body ScrollView today.
- The forced split below about 900px (issue 2).
- Keyboard order runs header, tabs, List | Graph, canvas, selection line, node list, inspector, hint. Canvas nodes are
  not keyboard reachable; the node list is the route. The node list should come before the inspector.
- Back to graph preserves the canvas only while the canvas stays mounted. The current structure keeps it mounted under
  `display: none`. This is untested with the proposed structure.
- List and Graph switch by conditional render. Switching to List unmounts the canvas, so the camera and layout are not
  restored when Graph returns. Search and paging exist only in List, so the graph cannot be re-queried in place. Untested.

## Strawman layout (the designer owns the wireframe; this is for constraint checking)

Fixed rows, in both layouts:

- **Header:** "Memory" title and operator line on the left, and New memory on the right. Compact no longer gives New memory
  its own row.
- **Tabs:** Memories | Instructions | Help (unchanged; full width in compact).
- **Controls row (Memories only):** List | Graph chips on the left, and a one-line query summary on the right, for example
  "Matches “arch” · 30 of 41" or "Most recent in this directory · 30 of 41". The Details row is removed. "Use list" appears
  only in the failure state.

Desktop (panel width 900px or more):

```
Memory · Operator · Scope                                   [New memory]
[Memories] [Instructions] [Help]
[List] [Graph]                              Matches “arch” · 30 of 41
+--------------------------------------+   +-----------------------------+
| canvas (flex 1, min 360)             |   | selected memory: existing   |
|                                      |   | MemoryDetail, or the        |
+--------------------------------------+   | context inspector           |
| Selected: X · Required · Filed under |   | (scrolls on its own)        |
| Nodes (39) ▸ (collapsed; own scroll) |   |                             |
+--------------------------------------+   +-----------------------------+
footer: graph counts (31 memories, 8 context nodes, including expanded and history nodes) · limit 120 · partial note if cut
Results page counts (30 of 41) sit in the controls row, labelled as the results page.
```

- The graph takes the left flex column. The right column is 380px fixed (320 to 400). With nothing selected it reads
  "Select a memory or context node in the graph."
- The right column header carries the explicit Auto | Split choice, so it stays reachable and remains a user decision,
  not a separate row.
- The canvas stays out of any scroll region. The selection line is one line. The node list is collapsed by default, with
  its own bounded scroll.

Narrow and compact (under 900px, or 390 wide):

```
Memory                                              [New memory]
[Memories] [Instructions] [Help]
[List] [Graph]                              Matches “arch” · 30 of 41
+--------------------------------------+
| canvas (fixed 300; does not scroll)  |
+--------------------------------------+
| Selected: X · relations (one line)   |  <- only this body scrolls
| Nodes (39) ▸                         |
| inspector (context node), or nothing |
+--------------------------------------+
Select a memory: single pane with "‹ Back to graph" and the full memory detail.
```

- The canvas stays mounted through the detail, as today. Back to graph returns to the same canvas, selection, and
  expansions.

## Feasibility (Paseo 0.12)

- Uses the existing RN primitives (View, ScrollView, Pressable, Text). No new dependencies, no renderer or model change.
- The changes are in `client/memory-panel.tsx` and `client/memory-graph.tsx`, plus style keys in `client/styles.ts`. The
  `splitGraph` override stays as an explicit user choice. Its two chips move into the right column header, and the
  `splitDetailWidth` math moves with them.
- Compact vertical budget: header, tabs, and the controls row come to roughly 150 to 190px, so the canvas can start near
  the top. Estimate, to be checked on the capture.

## Decisions requested from root, designer, and advocate

1. The Details (Auto | Split) choice leaves its own row and moves into the right column header, reachable in both the
   detail and the inspector. It stays an explicit user choice. The row's label "Details" is replaced with the choice's
   own words.
2. Node list collapsed by default, bounded height, its own scroll.
3. One shared selection inspector in the right column, for both memories and context nodes. A memory shows the existing
   MemoryDetail. A context node shows the inspector, with Expand connections and Load more beside its connection count.
   This is a layout move; the content is unchanged. Compact places it under the fixed canvas, in the scrolling body.
4. One count next to Expand or Load more, for example "Loaded 20 of 26 linked memories". Drop "Loaded links: 25"
   (drawn edges). Label the two denominators in the caption: results page (30 of 41) and graph (31 memories, 8 context
   nodes, including expanded and history nodes).
5. The search field moves into the controls row shared by List and Graph, so the query is visible and editable from either
   view. This is not a new capability; the search and paging already exist, in List only.
6. Keep both views mounted, and hide the inactive one with `display: none`, the same mechanism as the narrow detail. Then
   the camera, selection, and list scroll survive a List or Graph switch. Untested; the canvas must re-measure when shown.

## Density addendum: menus and the Layout control

Verified in the installed SDK (`@getpaseo/plugin` 0.12.0, `dist/client`):

- `client/react-native` declares `Modal` (titled, `open` and `onOpenChange`, with `Modal.Content`), `Icon`, `useToast`,
  `ScrollView`, `FlatList`, `TextInput`, and `copyText`.
- `Modal` is a titled overlay, not anchored to a trigger. Its dismissal and focus behavior are host-owned. Its runtime
  availability inside a workspace panel is not verified, because the SDK's `react-native.js` and `ui.js` are type-only
  stubs. The host supplies the implementation, and the context bridge mentions portal hosts.
- `client/ui` has `SettingsSelect` only, for settings rows. It is not a toolbar control.
- `openPopover` exists only on sidebar items (`PluginSidebarItemProps`). It is not available to a panel.
- There is no generic anchored dropdown or menu in 0.12 for panels.

Recommendation, the smallest supported option: an inline disclosure built from RN primitives (`Pressable`, `View`, `Text`)
and the existing `Chip` and tokens.

- The toolbar carries a `Layout: Auto ▾` trigger (36px desktop, 44px compact). Pressing it opens the two choices in flow,
  directly below the toolbar, and pressing a choice or the trigger again closes it.
- No overlay, so there is no outside-click, Escape, or portal dependency to verify. Focus follows the normal tab order.
- The choices are plain `Chip`s with selected state: "Auto (by width)" and "Split beside detail".
- Compact keeps the Layout trigger, because the override applies at every width (see the reconciliation below).
- The SDK `Modal` is an option only if a true overlay is needed later. Verify its runtime in a workspace panel first.

Proposed density, one graph toolbar:

```
Desktop (900 or more)
Memory · Operator · Scope              [Memories | Instructions | Help]   [New memory]
[List | Graph]   Matches “arch” · 30 of 41              [Layout: Auto ▾]
+------------------------------------------+  +-----------------------------+
| canvas (flex 1, min 360)                 |  | selected memory (existing   |
+------------------------------------------+  | MemoryDetail) or shared     |
| Selected: X · relations (one line)       |  | inspector with Expand /     |
| Nodes (39) ▸                             |  | Load more                   |
+------------------------------------------+  +-----------------------------+
footer: graph counts · limit 120 · partial note

Compact (under 900, or 390 wide)
Memory                                              [New memory]
[Memories | Instructions | Help]
[List | Graph]                                       [Layout ▾]
Matches “arch” · 30 of 41
+------------------------------------------+
| canvas (fixed 300; does not scroll)      |
+------------------------------------------+
| body (scrolls alone): selection, nodes,  |
| inspector                                |
+------------------------------------------+
```

Permanently visible rows drop from five or six to two on desktop (the title and tabs share a row, then the graph toolbar)
and three plus one line on compact. Desktop controls stay in the 36px family; compact keeps 44px touch targets.

Open for the designer and advocate: the desktop row 1 merge of title, tabs, and New memory must fit 770px panels. If it does
not, row 1 stays as the title row and the tabs row keeps its place.

## Reconciliation (supersedes the density wireframes above where they differ)

Decisions carried in from root and the advocate:

1. The explicit Layout override applies at every width. The Layout ▾ trigger is present in compact too, and it is never
   hidden.
2. Under Auto at narrow widths, memory and context selection open the same full-pane inspector, with "‹ Back to graph".
   Context Expand and Load more live in it. Under explicit Split, the shared inspector sits in the right column.
3. The node list becomes a Nodes (N) ▾ menu, anchored under the canvas on desktop and shown as a bottom sheet on compact.
   It leaves the flow, so the canvas cannot be scrolled out of view, and the body no longer scrolls.
4. Layout ▾ and Nodes ▾ share one menu primitive: a core React Native `Modal` popover. It is transparent, with a backdrop
   `Pressable` and a panel anchored by `measureInWindow` at open time, clamped with `useWindowDimensions`. Compact uses the
   same `Modal` as a bottom sheet.
5. The inline disclosure is the fallback only, if the verification below fails.

Feasibility of the core RN `Modal` popover:

- Verified in the installed RN 0.81.5 types, not in a running host: `Modal` (`transparent`, `visible`, `onRequestClose`,
  `animationType`), `measureInWindow` on host components, and `useWindowDimensions`.
- Not verified here: the host's web runtime. `react-native-web` is not in this workspace's `node_modules`, so Escape,
  focus movement, and focus return on web are unknown. Android back calls `onRequestClose`; iOS has no Escape.
- Not verified: plugin context inside a core `Modal`. The SDK's context bridge exists because the host re-roots plugin
  content inside portal hosts, so a core `Modal` may need the same care.

Verification before adoption (one browser spike for root):

- (a) Taps reach the menu, not the canvas, while it is open.
- (b) The backdrop closes it.
- (c) Escape on web closes it, or it does not. If it does not, the explicit Close row and the backdrop cover it, and no
  Escape claim is made.
- (d) `measureInWindow` places the panel under its trigger after the sidebar toggles and after a resize.
- (e) A plugin hook, such as settings or RPC, works inside the `Modal` content.
- (f) The canvas keeps its identity across open and close.
- (g) Focus enters the menu and returns to the trigger, or the limit is documented.

If (a), (d), (e), or (f) fails, use the inline disclosure fallback, which has no overlay.

Open for the designer, whose wireframe is authoritative:

- Split at compact width. The override applies at every width, which leaves the inspector column about 150px at 390.
  Specify a minimum inspector width, or the stacked form with the override honored and labelled.
- Desktop row 1: whether title, tabs, and New memory share a row at 770px.
- Placement of the Nodes (N) ▾ trigger: under the canvas, or in the canvas's top-right corner.
