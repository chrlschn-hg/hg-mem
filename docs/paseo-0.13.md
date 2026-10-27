# Paseo 0.13

- Plugin release: 0.2.0. Supported Paseo range: `>=0.13.0 <0.14.0`.
- SDK/client: 0.13.0. React: 19.2.3. React Native: 0.86.3.
- GraphQLite stays at 0.12.0. No database migration is needed.
- Rebuilt Reagraph with private ReactDOM 19.2.3. Keep the exact host React guard.
- The vendor build now writes its hash and resolved version metadata automatically.
- This host's portal did not deliver RN `onLayout`; panel width stayed unset. A web-only ResizeObserver now measures the actual panel. Native retains `onLayout`.
- Header groups also wrap intrinsically. The title stays on one line; the stacked tab track uses an automatic flex basis so it cannot stretch into the search row.
- A recovered graph must notify its parent; otherwise Retry leaves a stale failure notice above a working canvas.

Verification: clean dependency install, generation, skill checks, typecheck, 61
backend tests and 6 graph/refresh tests. Live daemon 0.13.0 loads the plugin and
reports Memory ready. Desktop WebGL renders; forced context loss is contained and
Retry restores the canvas and Use list restores results. Header/pane resize was
checked at 390, 1000 and 1440 CSS pixels. Physical iOS/Android rendering is not verified.
