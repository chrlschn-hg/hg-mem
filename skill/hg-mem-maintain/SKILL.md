---
name: hg-mem-maintain
description: Inspect and verify a managed hg-mem SQLite graph, or rebuild its derived FTS index through the SQLite CLI.
---

# Maintain hg-mem

Read the [runtime](../hg-mem/references/runtime.md) and [schema](../hg-mem/references/schema.md) first. Use the extension-enabled SQLite CLI session from the runtime. Select the database explicitly and confirm it already exists; these recipes never initialize a database.

```sh
# After setting explicit HG_SKILLS, HG_SQLITE, HG_DB, HG_EXT and defining
# hgblock/hgsql as shown in the runtime.
test -f "$HG_DB"

# Read-only schema, node-label, edge-type, and Memory counts.
hgblock hg-mem-maintain/references/inspect.md | hgsql

# Read-only graph validation and FTS integrity/row agreement.
hgblock hg-mem-maintain/references/verify.md | hgsql

# Only when rebuild is requested and graph validation passes.
hgblock hg-mem-maintain/references/rebuild.md | hgsql
```

- `inspect` reads `hg_meta`, schema objects, `node_labels`, `edges`, and `hg_memory` in one transaction.
- `verify` prints graph violations and FTS row differences, checks FTS5 integrity, then asserts schema version 1, no graph violations, and exact `nid`/rowid plus title/content agreement. Success exits zero; a failed assertion exits nonzero. It does not repair data.
- If verification finds graph violations or the wrong schema, stop and report them. Do not run a rebuild to repair graph data. For FTS drift with a valid graph, rebuild only when requested, then run verify again.
- `rebuild` uses `BEGIN IMMEDIATE`, validates schema and graph before mutation, replaces only derived `hg_fts` rows from `hg_memory`, checks integrity and exact row agreement, then commits. SQL errors or failed guards stop the CLI and closing its connection rolls back the transaction.
- Keep the graph canonical. `hg_fts(title, content)` is a literal projection keyed by `hg_memory.nid` as its local rowid. Do not add vectors, generated keywords, cached algorithms, copied scope tables, bulk deletion, or source-relocation repair.
- A Memory has exactly one purpose (`Persona`, `CAPA`, or `Operational`); `required` is independent, and a required memory represents an explicit imperative. An inferred CAPA remains `required=false`. Keep taxonomy within Domain → Area → Topic, with at most three levels and no placeholder nodes.

## References

- [Inspection SQL recipe](references/inspect.md)
- [Verification SQL recipe](references/verify.md)
- [FTS rebuild SQL recipe](references/rebuild.md)
- [SQLite CLI session and `hgblock`/`hgsql` functions](../hg-mem/references/runtime.md)
- [Version-one graph schema and lifecycle rules](../hg-mem/references/schema.md)
