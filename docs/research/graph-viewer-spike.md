# Graph viewer spike: report

Date 2026-10-23. Host: Paseo app and daemon 0.12.0 (web origin 127.0.0.1:6818, Paseo browser tab; user agent verified by root as Paseo 0.12, Electron 44.2, Chrome 152). Fixture: synthetic, 30 typed nodes, 49 directed edges, 5 edge types. No memory data was read, and the production `hg-mem` plugin was not touched.

## Answer

| Renderer | Bundles in 0.12 | Renders in plugin UI (web) | Native iOS/Android |
| --- | --- | --- | --- |
| Sigma 4.0.3 | Only after prebundling | Yes: WebGL, click select, pan, zoom, resize, clean unmount | No direct native renderer under the current plugin contract (web DOM/WebGL only); device untested. A future host drawing API could change this. |
| Reagraph 4.32.0 | Only after prebundling | Yes: WebGL, click select, pan, zoom, resize, clean unmount | No direct native renderer under the current plugin contract; the vendor documents React Native as unsupported; device untested. |
| RN primitives (View/Text/Pressable/PanResponder) | Yes, directly | Yes: click select, pan, zoom buttons | Same code path as web, so plausible. **Untested on device or simulator.** |

Neither library can be added the normal way. Both need a pre-bundling step, and both are web-only under the current contract. The RN-primitive renderer is a candidate native path, but native behaviour, performance and accessibility are untested. All recommendations below are provisional.

## Resolved versions

Sigma 4.0.3, graphology 0.26.0, Reagraph 4.32.0 (resolved `@react-three/fiber` 9.8.2, `@react-three/drei` 10.7.9, `three` 0.184.0, `react-dom` 19.1.0 for the prebundle), esbuild 0.25.12, `@getpaseo/plugin` and `@getpaseo/client` 0.12.0, React 19.1.0, React Native 0.81.5. Exact trees are in each variant's `package-lock.json`.

## Findings

1. **Host allowlist.** Client code may import only `@getpaseo/plugin`, `/client`, `/client/ui`, `@tanstack/react-query`, `react`, `react/jsx-runtime`, `react-native`, `zod`. Seen in the shipped app bundle: anything else throws `Module "<name>" is not available in plugin client code`. There is no `react-native-svg`, WebView, Skia or `react-dom` in the documented contract. The v0.12.0 app package lists `react-native-svg`, `react-native-webview` and Skia as dependencies, but the plugin contract does not expose them. Say "not exposed to plugins", not "absent from the device".
2. **Direct import fails at compile time.** `graphology` (Sigma's dependency, also pulled in by Reagraph) imports the Node built-in `events`. The plugin bundler rejects it. Verbatim, from `paseo plugin install`:
   `Node module cannot be imported into the plugin client bundle: events imported by .../node_modules/graphology/dist/graphology.cjs.js` (and `graphology.mjs` for the Reagraph variant). Lazy `require()` does not help; the compiler resolves every `require()` statically, so one failing library blocks the whole plugin. That is why the work is split into one plugin per library.
3. **Workaround that needs no compiler or host change.** Prebundle the library with esbuild (`tools/prebundle-*.mjs`, esbuild 0.25.12) into a single vendored ESM file under `client/vendor/`, with the npm `events` polyfill inlined. The plugin bundler accepts it.
   - Sigma: 440 kB, no remaining imports.
   - Reagraph: 1.5 MB. `react` and `react/jsx-runtime` stay external (the host's copies are used). `react-dom`, `three`, `@react-three/fiber` and `drei` are inlined, so the plugin carries a second, private `react-dom`. That worked here, but it is a fragile arrangement and the size is large.
   - The vendored files are build output. They have to be regenerated whenever the library version changes.
4. **Sigma 4 differs from Sigma 3.** My first zoom buttons threw because `camera.animatedZoom` and `animatedUnzoom` no longer exist; v4 uses `camera.zoomIn` and `zoomOut`. Fixed. Do not assume v3 examples work.
5. **Sigma WebGL warning is still observed, not resolved.** During pan and zoom the console repeats, once per frame: `GL_INVALID_OPERATION: glDrawArraysInstanced: Active draw buffers with missing fragment shader outputs.` Rendering and GPU picking still worked. I did not investigate the cause. It was not seen with Reagraph.
6. **Theming.** Sigma labels draw in the default dark text, which is hard to read on a dark theme. Node and edge colours come from `theme.colors`, but label colour was not themed. Reagraph uses its own `darkTheme` for the scene, with node and edge fills overridden from `theme.colors`. Neither follows light/dark switching automatically. The RN renderer takes everything from `theme.colors`.
7. **Reagraph interaction quirk.** Node click only registered after a pointer-move over the node first (hover intent). Selecting a node dims the others.

## Evidence (web only)

- Mount: both libraries drew a real WebGL canvas inside the plugin screen. `evidence/sigma-selected-desktop.png`, `evidence/reagraph-themed-selected-desktop.png`, `evidence/rn-primitives-selected-desktop.png`.
- Selection: Sigma `clickNode` and Reagraph `onNodeClick` both updated the React property panel (id, kind, status, label, neighbours). RN node press verified with a real browser click.
- Pan and zoom: Sigma wheel zoom (camera ratio 1 to 1.7) and drag pan (node moved with the drag); Reagraph wheel zoom and drag pan (`evidence/reagraph-zoom-pan-select.png`). Sigma +/- buttons verified with a real click after the fix (ratio 1 to 0.667 on zoom in; Sigma ratio falls as you zoom in). RN pan and zoom buttons verified.
- Resize and compact: Reagraph at 480 px wide re-fit the canvas (`evidence/reagraph-compact-480.png`). Sigma logged resize events from its container `onLayout`; I did not screenshot Sigma at a compact width.
- Cleanup, counted separately:
  - Sigma instances: 9 created across a load and 8 tab switches, 8 destroyed, 1 live and connected, 0 live but detached. A second run of 4 sidebar open/back cycles gave 4 created, 4 destroyed, 0 live, 0 canvases left.
  - WebGL canvases: after each tab switch away from a renderer there were 0 canvases in the document, and 1 after switching back, for both libraries.
  - Reagraph: 8 cycles produced 8 WebGL contexts created and 1 connected canvas at the end. I did not verify context loss directly, and no "too many contexts" warning appeared.
  - One unexplained anomaly: on the very first Sigma open (before I added instance tracking) the log showed 2 mounts and no destroy. I could not reproduce it in later runs with tracking.
- Install and error text: `evidence/01-combined-install-failure.txt`, `evidence/02-install-results.txt`.

## How the tests were driven

- Buttons and node presses on the RN renderer, the Sigma +/- buttons, and plugin navigation used real clicks through the browser tool (`browser_click` on accessibility refs).
- Canvas interaction (Sigma and Reagraph node click, wheel zoom, drag pan) used **synthetic** `PointerEvent`/`MouseEvent`/`WheelEvent` dispatched from `evaluate`, because there is no coordinate-click tool. They show the libraries handle those events, not that a physical mouse or touch does.
- Tab switching in the cycle tests also used synthetic events on the tab buttons.
- The workspace panel (`addWorkspacePanel`) is registered in each plugin but **was not opened or tested**. Only the screen route was tested.

## Not tested

- iOS and Android, device or simulator. Nothing here claims native support.
- Touch gestures, pinch zoom, accessibility of the canvas renderers, light theme, large graphs, performance.
- Workspace panel placement, other browsers (Safari, Firefox), plugin reload and daemon restart behaviour.
- Sigma 3, Cytoscape.js (research only), other libraries.

## Recommendation (provisional; no production selection made)

For the data the memory plugin would show (bounded neighbourhoods, tens of nodes):

- **Default and native fallback: keep the already-working path/list UI.** The RN-primitive renderer (`variants/rn`) remains a candidate, with a JS layout and no prebundling. Its native behaviour, performance and accessibility are untested; larger graphs and label overlap were not tried.
- **Sigma: viable web candidate** (440 kB). The unresolved per-frame GL warning must be resolved or explained before any production use. It also needs the prebundle step, and its labels are not themed.
- **Reagraph: viable web candidate with a real cost**: a 1.5 MB bundle with a private `react-dom`, a 2D/3D scene model, and vendor documentation (per the researcher, reagraph.dev Installing page) saying React Native is unsupported. Whether that cost is acceptable is a product decision.
- Whichever web library is used, gate it behind `Platform.OS === "web"` so native never loads a DOM or WebGL library.

## Reproduce

See `README.md` in this folder. Plugins `hg-mem-graph-spike-rn`, `hg-mem-graph-spike-sigma` and `hg-mem-graph-spike-reagraph` are installed on the local daemon; open `/h/srv_mpbwHwXzHyp-/plugin/<id>/surface/graph` on the web origin. My browser tab `d51eec5e-559b-465e-bbc3-94834cdb48db` is left on the RN demo. The combined `plugin/` source is kept as the failed-install artifact; its failed registration `hg-mem-graph-spike` was removed from the daemon by root, and source and evidence are preserved.
