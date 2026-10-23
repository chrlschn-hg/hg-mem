# client/vendor

`reagraph-vendor.js` is a generated, minified ESM bundle of reagraph 4.32.0. Do not edit it.

Why it is vendored: a plugin client bundle cannot import the Node built-in `events`, which graphology (a reagraph dependency) imports. The bundle inlines the npm `events` polyfill, and also inlines `three`, `@react-three/fiber`, `@react-three/drei` and a private `react-dom`. Only `react` and `react/jsx-runtime` stay external, so the host's React is used. It is loaded only on web, from `../graph-web.ts`.

Metadata (versions, hash, required host React) is in `reagraph-vendor.meta.json`. Resolved versions: reagraph 4.32.0, @react-three/fiber 9.8.2, @react-three/drei 10.7.9, three 0.184.0, react-dom 19.1.0, graphology 0.26.0. esbuild 0.25.12.

Regenerate from the development-only locked dependency sets:

    npm ci --prefix tools/graph-vendor/bundler
    npm ci --prefix tools/graph-vendor/deps
    LEGAL=1 node tools/graph-vendor/bundler/prebundle-reagraph.mjs <abs>/tools/graph-vendor/deps <abs>/paseo-hg-mem/client/vendor

Run these from the repository root. Review the resulting artifact, notices, hash
and metadata together. A dependency change requires the host React guard and real
Paseo render/recovery checks; do not silently update the version metadata.

Never `npm install reagraph` into this plugin: the plugin compiler would reject `events` at install time.

Licenses: reagraph is Apache-2.0 (`LICENSE-reagraph.txt`). The other bundled packages carry MIT or similar licenses; their notices are in `reagraph-vendor.js.LEGAL.txt`.
