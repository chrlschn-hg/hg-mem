# Memory graph view

The graph is a second view inside Memories. Memories, Instructions, and Help remain
the top-level modes. List and Graph share the current search and result page.

## Placement and selection

On wide panels the graph uses the results area and the existing memory detail
panel shows the selected memory. On narrow panels, opening a memory covers the
graph; Back to graph restores the mounted canvas and its loaded neighborhood.
Auto layout uses a split only with at least 900 points of panel width. The
explicit Layout → Split choice overrides that threshold and keeps the
shared inspector on the right. It shares 42% of the available width, capped at 380
points, and remains selected for the lifetime of the open panel. Auto layout
restores responsive behavior. The layout choice remains reachable in detail view.
Search, List/Graph, Nodes, and Layout share a toolbar. The canvas stays in the
remaining viewport; the inspector scrolls independently. Nodes and Layout open
bounded in-flow disclosures. The core React Native Modal spike failed keyboard
focus containment, so this iteration does not use an overlay menu. Nodes lists
only the loaded graph, rather than searching the whole store.
The toolbar spans above both panes. Split sizing uses a percentage rather than
an initial measured-width fallback, keeping the inspector contained on narrow
screens. In the merged header, primary modes and New memory form one group on
the right; identity and context remain on the left.

Memory details retain the full body, purpose, required status, scope, timing,
assertion, source, and revision evidence. Selecting a taxonomy or subject node
uses the same inspector destination, showing its name and kind with an explicit
Expand action. ABOUT means the memory's
subject, independently of who asserted it.

Selecting and dragging a node do not change the database. Review and editing use
the existing detail/workflow boundary. Editing and removal are not introduced by
the renderer integration; their proposed persistence contract is described in
[memory-editing-design.md](memory-editing-design.md).

## Data boundary

The initial graph is built from the current result page. It contains actual
FILED_UNDER, CHILD_OF, ABOUT, and direct SUPERSEDES links returned in record
envelopes. It does not infer edges between memories with a shared topic. Scope
remains an attribute, avoiding a global scope hub.

Explicit expansion uses the existing typed `memory.explore` RPC. Eligibility is
applied before the page limit for current discovery. Revision evidence remains
historical and does not become an applicable instruction through connectivity.
The client limits the displayed graph to 120 nodes and reports omitted nodes.

## Failure boundary

Only the graph canvas loads the vendored Reagraph adapter. The platform check
precedes module evaluation. Native clients retain the list/path UI. The web
adapter uses guarded loading, a local React boundary, and canvas lifecycle
handling; failures offer retry and an escape to List without changing the search.

These boundaries contain supported loading/rendering/context-loss failures. They
do not isolate the browser process, GPU process, or every asynchronous error in a
third-party renderer. Reagraph's separate scene reconciler and private ReactDOM
remain version-sensitive. The renderer is a view, never the persistence layer.
The adapter checks exact host React compatibility before loading. It does not
install global error handlers. Font/glyph data may be requested by Troika's worker
from external services; the startup deadline does not verify that every label loaded.

## Verification

The density pass replaces the older scrolling graph-body composition described
in the historical evidence below. Live checks confirmed a context-node selection
in the right inspector, disclosure open preserving the canvas, and a different
committed search clearing the old inspector and showing the new graph results.
The final grouped List/Graph control exposes a tablist with explicit selected
states. At 390 × 844, a node choice focused Back to graph; selecting Split from
the inspector focused the Layout trigger and retained the same canvas. The
revised failure view was also exercised with real WebGL context loss: Use list
returned to results with zero canvases.

The pure graph adapter has tests for relation direction, context-node deduplication,
history markers, result-first caps, and absence of dangling edges or scope hubs.
Live Paseo web checks used the walkthrough store and an isolated adapter harness:

- The adapter harness exercised module failure, unavailable WebGL, host-tree and
  scene-tree render failure, startup timeout, retry, and a 160-input-node cap.
  See [adapter checks](research/graph-adapter-tests.md).
- In the actual Memory panel, `WEBGL_lose_context.loseContext()` removed the
  canvas and showed a graph-only error. Retry restored exactly one canvas and
  retained the loaded expansion. Use list restored results/search with zero canvases.
- Selecting a memory used the existing exact read. A superseded version displayed
  its history banner before the body. Historical memory exploration routes to
  revisions, while filing breadcrumbs independently seed taxonomy nodes.
- At 991 points of browser width, the panel used full detail with Back to graph.
  The return retained the same canvas DOM object, query and selected-node summary.
- Explicit expansion of the synthetic Paging Topic returned 20 of 26, then
  26 of 26 via Load more. The resulting graph held 47 nodes and one canvas.
- At 390 × 844, the graph body scrolled to its node list and Topic inspector.
  The canvas retained a 300-point flow height without overlaying other controls.
  Selecting historical Revision 3, opening its revisions, and returning to Graph
  retained the same canvas DOM object and selected-node summary. Evidence is in
  `discovery/plugin-v1/graph-compact-{node-list,inspector}-final.png` and
  `graph-compact-history-explorer.png`.
- At 1280 × 900, a selected memory used the bounded inspector beside the graph.
  The graph body could scroll to Topic expansion controls; Load more was inside
  the visible viewport, with exactly one canvas. See `graph-final-wide-properties.png`
  and `graph-final-wide-inspector-reachable.png` in the same evidence directory.

Physical iOS/Android, touch canvas gestures, light theme, very large stores, and
every asynchronous renderer failure were not tested in this integration.

## Connected walkthrough fixture

The user-authorized seed adds 43 synthetic memories and eight context nodes to
the walkthrough database, preserving the original three memories. It includes
two Areas, four Topics, two synthetic Operators, 26 memories sharing a Topic,
and a four-version revision chain. All text is marked synthetic. The seed is
idempotent; graph validation reports zero violations and FTS matches all 46
stored memories. See the [seed receipt](research/walkthrough-seed.md).
