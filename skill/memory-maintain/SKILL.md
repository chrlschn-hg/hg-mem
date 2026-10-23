---
name: memory-maintain
description: Inspect or verify an existing managed memory store; rebuild its derived search index only when requested. Does not initialize, migrate, or repair graph data.
---

# Maintain memory

Load [runtime](../memory-workflow/references/runtime.md) and
[schema](../memory-workflow/references/schema.md). Choose the store explicitly.

```sh
test -f "$HG_DB"
unset HG_INPUT

# Counts and schema objects; no initialization.
hgblock memory-maintain/references/inspect.md | hgsql

# Graph + FTS integrity/row agreement. Nonzero means failed verification, not repaired.
hgblock memory-maintain/references/verify.md | hgsql

# Only when requested, and only if graph validation passes.
hgblock memory-maintain/references/rebuild.md | hgsql
hgblock memory-maintain/references/verify.md | hgsql
```

| Result | Next action |
| --- | --- |
| Wrong schema or graph violations | Stop; report codes. No automatic migration or graph repair. |
| FTS drift with valid graph | Requested rebuild, then verify again. |
| Uncertain write outcome | Check the exact public ID; never blindly replay the write. |

The graph is canonical. Rebuild replaces only `hg_fts(title,content)`, keyed by
internal node ID. It validates before commit; failure rolls back. Do not add
vectors, generated keywords, mixed-graph algorithm caches, bulk deletion, or
source-relocation repair.

Recipes: [inspect](references/inspect.md), [verify](references/verify.md),
[rebuild](references/rebuild.md).
