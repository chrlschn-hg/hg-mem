# Production graph canvas adapter

Files in `paseo-hg-mem/client/`: `graph-canvas.tsx` (component), `graph-web.ts` (web-only plumbing), `vendor/` (generated Reagraph bundle, see its README). Test harness: `variants/adapter` (plugin id `hg-mem-graph-spike-adapter`, copies those files unchanged; regenerate with `node tools/make-adapter.mjs`).

## Contract

`GraphCanvasView({ theme, compact, nodes, edges, selected, onSelect, onError? })`. Nodes `{id,label,kind,status?,historical?}`, edges `{id,source,target,label}`. The parent supplies a bounded height; the component fills it. It clamps to 120 nodes (and drops edges whose endpoints were clamped) and shows "Showing N of M nodes".

## States

| State | Trigger | What the user sees |
| --- | --- | --- |
| Native list | `Platform.OS !== "web"` | Message plus node list. The vendor bundle is never evaluated. No retry. |
| Loading | Start of every attempt | "Loading graph…" over an empty canvas, until a sized `<canvas>` appears. |
| Ready | Canvas has non-zero size | Interactive graph; "Show node list" toggle. |
| Error | Any failure below | In-place "Graph view unavailable", the message, Retry, and the node list. Memory UI around it is untouched. `onError(message)` is called once per failure. |

Failures that reach Error: no WebGL (probe context, released immediately); host React series differs from the bundle's private `react-dom` (19.1.x); vendor module throws on evaluation or lacks exports; a React render error in our tree or in the renderer's own React root (the renderer rethrows to our boundary); `webglcontextlost` on the container (capture-phase listener); no sized canvas within 8 s.

Retry bumps the attempt: unmounts the canvas (killing its WebGL context), re-runs the checks, and mounts a new canvas. Only the canvas is recreated.

## Not covered (stated limits)

- Errors thrown asynchronously outside React (timers, promises) are not caught; no global `error` or `unhandledrejection` listener is installed on purpose, so unrelated page errors are never swallowed.
- GPU, browser or renderer-process crashes and a hung main thread. A lost context is handled; a dead process is not.
- A vendor module that threw during evaluation is not re-evaluated by the plugin bundler in the same session. Retry then reports the earlier failure and the fix is a plugin reload.
- The 1.5 MB artifact is part of the client bundle on native too. It is parsed but never evaluated there.
- Canvas content is not readable by assistive technology; the node list is the accessible path.

## Fault injection (browser tests)

`GraphCanvasView` accepts an optional test-only `fault` prop: `module`, `nowebgl`, `timeout`, `render-react`, `render-canvas`. Production callers do not pass it. There is no global flag. The harness has a button per fault. Changing the prop restarts the canvas.

## Test results (harness `hg-mem-graph-spike-adapter`, web only, Electron 44 / Chrome 152)

Tested, with real WebGL and the real vendored bundle. Buttons were driven with synthetic click events; the context loss used the browser's `WEBGL_lose_context` extension on the live canvas.

| Case | Result |
| --- | --- |
| No fault | Canvas appears, loading text clears, 1 canvas. |
| `module` | Error panel "The graph module could not be loaded: injected module failure", 0 canvases, one `onError`. |
| `nowebgl` | Error panel "WebGL is not available (injected test fault)." |
| `render-react` (throw in our tree) | Caught by the local boundary: "The graph failed while drawing: injected render failure". |
| `render-canvas` (throw inside the renderer's own React root) | **Tested: reached our boundary** and produced the same error panel. Reagraph's source places `children` inside the R3F `<Canvas>`, so the throwing component ran in the renderer's own root. Scope of that proof: a component that throws during render inside the canvas tree. Errors thrown from frame callbacks or other non-render paths inside the renderer were not tested and are expected not to reach a React boundary. |
| `timeout` | "Loading graph…" for about 8 s, then "The graph canvas did not start within 8 seconds." |
| Retry | Re-runs and fails again under the same fault (one more `onError`); recovers to a working canvas when the fault is cleared. |
| Context loss | After `loseContext()` the canvas is removed and the panel shows the context-lost message; Retry then creates a new working canvas. |
| 160 nodes in | "Showing 120 of 160 nodes"; accessibility label counts 120 nodes and only the edges between kept nodes. |
| Node list | Select via the list calls `onSelect`; hidden with `showNodeList={false}`. |

Bug found and fixed during testing: after a render error the start-deadline timer still fired and replaced the message with the timeout text. A failure now stops the watch, so each attempt reports one failure.

Unverified: native device behaviour; real (non-injected) WebGL-unavailable browsers; real GPU resets; node click and pan on the canvas inside this exact adapter (verified earlier in the spike with the same bundle and props); any browser other than the Electron/Chrome tab.

## Network note

The label text renderer (troika-three-text, bundled) loads glyph or font data from a CDN when no `labelFontUrl` is given (Google Fonts per Reagraph's docs; the bundle also references the `cdn.jsdelivr.net` unicode-font-resolver). The page's resource timing showed no external requests, but the fetches happen in a worker, which that API does not list, so this is not confirmed by direct network capture; root is checking. The graph is therefore not claimed to work fully offline. Canvas readiness does not wait on fonts. A local font through `labelFontUrl` was not added (no font asset in the repo; out of scope).

## Readability changes (after review)

- Unselected nodes and edges stay readable when a node is selected: `inactiveOpacity` 0.7 for nodes and 0.6 for edges. Checked in the harness with one node selected (`evidence/adapter-selected-inactive-opacity.png`); the other nodes keep their kind colours.
- `labelType: "all"`, so node and edge (relationship type) labels are drawn. Labels are small when the camera fits a large graph; zoom to read them. Not measured at 120 nodes.
- The adapter's own node list (only when `showNodeList` is true) uses human wording: About me, Project knowledge, Correction or prevention, Domain/Area/Topic/Operator, "Historical memory", plus "Required instruction" when `required === true`, any non-active status, and `validity` text. `GraphCanvasNode` gained optional `required` and `validity`. The purpose wording is a small local copy of `labels.ts` so the renderer does not import the contracts module; keep the two in step. Production currently hides this list (`showNodeList={false}`) and uses its own.

## Error copy (after recovery review)

The error panel reads "Graph view unavailable", "Try again or continue in List.", a muted "Detail: <reason>" line, and Retry inside the panel. The context-lost reason is "The WebGL context was lost." with no cause guessed. In the error state the count overlay reads "N of M nodes loaded" instead of "Showing N of M nodes". Verified in the harness by losing the context with 160 nodes in: the panel and "120 of 160 nodes loaded" appeared. The earlier test-table messages above predate this wording.
