# Working on hg-mem

## Boundaries

- Plugin source: `paseo-hg-mem/`. Keep its path stable for installed local plugins.
- Canonical skills and SQL: `skill/`. Skills ship as Markdown only; shell/SQL examples live inside the text.
- Generate embedded copies with `cd paseo-hg-mem && npm run generate`. Never edit `server/generated/recipes.ts` or `server/skill-assets.ts` directly.
- `tools/` and `tests/` are development inputs. `docs/` records decisions and evidence.
- Local stores, downloads, caches, upstream checkouts, and experiments are ignored. Never commit them or run tests on a user store.

## Commands

```sh
cd paseo-hg-mem
npm ci
npm run generate
npm run typecheck
npm run test:graph
HG_SQLITE=/path/to/sqlite3 HG_EXT=/path/to/graphqlite.dylib npm test
npm pack --dry-run
paseo --host 127.0.0.1:6767 plugin reload hg-mem
paseo --host 127.0.0.1:6767 plugin logs hg-mem
```

Use an explicit Paseo host. Do not restart the daemon. Use Paseo browser tools for
UI checks; use a separate tab and preserve the operator's tab/settings. Coordinate
shared file edits. For material layout changes, ask designer and operator advocate
for bounded screenshot review.

## Stack and persistence

- Paseo SDK/client 0.12.0, React 19.1.0, React Native 0.81.5, TypeScript, Zod.
- UI → typed RPC → `MemoryStore` → SQLite CLI + GraphQLite 0.12.0.
- No Node SQLite driver, Python runtime, or parallel SDK writer.
- Spawn without a shell; bind JSON values, never interpolate user SQL/Cypher.
- `BEGIN IMMEDIATE`, invariant checks, FTS refresh, commit. Reads use readonly CLI.
- `-bail` is required. SQL in SQLite `-cmd` can skip stdin; use dot commands there and put PRAGMAs in stdin.
- Integration tests use `.local/test-data`; override `HG_SQLITE` and `HG_EXT` for local runtime paths.

## Model and recall

Read [schema](skill/hg-mem/references/schema.md) before changing graph semantics.
The graph is canonical; FTS is derived. Keep status, effective time, scope, purpose,
subject, and authority distinct. Current eligibility belongs in the shared recipe,
before LIMIT. Do not add an agent-maintained `current` flag or traverse scope hubs.
Directive inventory is independent of search. Search uses literal token-prefix OR;
`arch` matches `architecture`. Raw Cypher inspection bypasses eligibility.

Replacement closes the old interval and adds new → old SUPERSEDES. History is a
separate bounded channel; retraction does not revive old records. Public IDs are
stable properties, not GraphQLite internal node IDs.

## UI contract

- Memories / Instructions / Help; desktop primary tabs beside New memory on the right.
- Grouped List / Graph inside Memories; shared Search, Nodes, Layout toolbar above both panes.
- One inspector destination for memories and context nodes. Select inspects; Expand loads bounded neighbors.
- Auto stacks when narrow; explicit Split stays available at every width, inspector 42%, capped at 380, minWidth 0.
- Pin the canvas. Scroll inspector and bounded node picker independently.
- Keep query, camera, and loaded nodes across inspector/menu/view changes. A different committed query clears the old exploration.
- Disclosures use explicit expanded/selected ARIA props. Core Modal failed focus containment in this host; do not reintroduce it without a real runtime probe.
- Desktop controls 36px, compact 44px. Show real scope, timing, sources, and partial counts. Never imply connectivity grants authority.
- Save-pending freezes the draft. Unknown commit outcomes must not trigger blind retries.

## Graph renderer

Reagraph 4.32.0 is prebundled in `client/vendor/` with private ReactDOM 19.1.0;
host React stays external. Preserve notices and metadata. Exact host React guard,
web-only lazy loading, error boundary, startup timeout, and context-loss handling
are deliberate. Never eagerly import the renderer on native. Test Use list recovery.
Async/GPU/process isolation is not guaranteed. See vendor README before rebuilding.

## References

- [Documentation index](docs/README.md)
- [Lessons](docs/lessons.md)
- [Graph UI](docs/memory-graph.md)
- [Editing proposal, not shipped](docs/memory-editing-design.md)
- [Paseo plugin docs](https://paseo.sh/docs/plugins/reference.md) — verify against installed 0.12 types; current docs may describe newer APIs.
