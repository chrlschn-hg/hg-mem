# Documentation map

Start with [README](../README.md), [AGENTS](../AGENTS.md), and [lessons](lessons.md).

## Current contracts

- [Schema](../skill/memory-workflow/references/schema.md): graph, authority, time, replacement rules.
- [Runtime](../skill/memory-workflow/references/runtime.md): CLI session functions.
- [Recall](../skill/memory-recall/SKILL.md), [write](../skill/memory-write/SKILL.md), [maintenance](../skill/memory-maintain/SKILL.md).
- [Memory exploration](memory-exploration.md), [graph UI](memory-graph.md).
- [Agent-first writing and human review](agent-memory.md).
- [Version-search review](version-search-review.md): physical growth and ranking concerns.
- [Editing design](memory-editing-design.md): proposal; UI editing is not shipped.

## Research and review history

Documents in [archive/](archive/) record proposals and bounded session reviews.
They are evidence of decisions, not an alternative runtime contract. Some refer to
ignored local discovery files and old paths. Historical statements about installed
plugins or browser tabs describe the experiment date, not the current environment.

Durable technical reports are in [research/](research/). Full local sandboxes remain
in ignored `discovery/` and `research/`; caches, upstream checkouts, stores, binary
downloads, raw screenshots, and captured session payloads are not source deliverables.

## Shipping boundary

`paseo-hg-mem/package.json` defines plugin package contents. Runtime assets include
generated recipes, embedded Markdown, the prebundled renderer, metadata and license
notices. SQLite and GraphQLite binaries are separately configured on the host.
Development tests/generators, source skills, docs, and screenshots belong in Git but
are not required inside the plugin package. Check with `npm pack --dry-run`.

## Cleanup decisions

| Keep in Git | Keep local / ignored |
| --- | --- |
| Plugin source, lockfile, generated runtime assets | `node_modules`, caches, temporary build outputs |
| Canonical Markdown skills | Generated ZIP release snapshots |
| Maintained generators, tests, renderer build lockfiles | Spike plugin variants and their installed dependencies |
| Design/findings, selected final screenshots | Raw browser captures and session-specific payloads |
| Runtime provenance and checksums in docs/source | Database files, downloaded executables/libraries, upstream Git checkouts |

The initial database and CLI examples predate the managed schema. Treat them as
local historical material, not supported ways to create current memories.
They are preserved under `.local/legacy/`. The GraphQLite reference checkout is
under `.local/upstream/graphqlite/`, not in project source.
