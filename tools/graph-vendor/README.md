# Renderer build inputs

`bundler/`: esbuild 0.25.12 and the browser prebundle command.
`deps/`: the executed spike's locked renderer dependency set. Its package name is
historical; no spike plugin source ships here. Keep the lockfile to preserve exact
transitive versions, including private ReactDOM 19.1.0.

These are development inputs, not plugin dependencies. Follow
[vendor instructions](../../paseo-hg-mem/client/vendor/README.md) from the repository root.
The tested artifact, metadata, and notices remain committed with the plugin.
