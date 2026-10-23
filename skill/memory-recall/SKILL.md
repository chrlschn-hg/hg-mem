---
name: memory-recall
description: Retrieve memory before acting or answering what is remembered. Inventory required instructions, search text, read full records, and explore filing, subject, or revision paths. Read-only.
---

# Recall memory

Check the session environment and define the two [inline runtime functions](../memory-workflow/references/runtime.md)
in the shell call. No script file or `jq` settings lookup. Existing store only:
`test -f "$HG_DB"`. Request values go in JSON, never interpolated into SQL.

```sh
export HG_INPUT=$(mktemp)
# Replace cwd with pwd -P; add only provided project/session scope IDs.
cat > "$HG_INPUT" <<'JSON'
{"query":"arch","cwd":"/work/project","scopes":[],"limit":20,"offset":0}
JSON
{ hgblock memory-workflow/references/eligible.md;
  hgblock memory-recall/references/search.md; } | hgsql
rm -f "$HG_INPUT"; unset HG_INPUT
# arch matches architecture. Literal word-prefix OR; no synonyms or stemming.
```

| Operation | Recipe in `references/` | Request |
| --- | --- | --- |
| Required inventory | [directives.md](references/directives.md) | `cwd scopes limit offset`; no query |
| Text search | [search.md](references/search.md) | `query cwd scopes limit offset` |
| Connections | [explore.md](references/explore.md) | `id relation cwd scopes limit offset` |
| Exact read | [read.md](references/read.md) | `id` only; no eligibility prefix |

Run directives **before acting**, independently of search or purpose. Page until
`total` is exhausted and read full bodies. Possibly applicable rules are uncertain;
report conflicts instead of silently choosing. Other operations page until enough
context is found. Eligibility applies before LIMIT; a larger limit cannot fix scope.

```sh
export HG_INPUT=$(mktemp)
cat > "$HG_INPUT" <<'JSON'
{"id":"memory:hit-id","relation":"filing","cwd":"/work/project","scopes":[],"limit":20,"offset":0}
JSON
{ hgblock memory-workflow/references/eligible.md;
  hgblock memory-recall/references/explore.md; } | hgsql
# Next request: {"id":"memory:chosen-id"}; exact read has its own transaction.
# hgblock memory-recall/references/read.md | hgsql
rm -f "$HG_INPUT"; unset HG_INPUT
```

- `filing`: eligible memory → same filing; Domain/Area/Topic → subtree members.
- `subject`: eligible memory or Operator → memories ABOUT that subject, not its author.
- `revisions`: any memory → up to three SUPERSEDES steps each way; history, not current rules.
- Search already includes filing ancestry, subject, scopes/matches, and direct revision references. Use them to choose the next seed.
- An empty exploration can mean no other eligible members. Inspect the hit's breadcrumb; do not infer that the seed has no graph links.
- Scope is an attribute, not a traversal hub. Connectivity grants neither authority nor applicability.

Finish with exact read: full text, scope, status, timing, attribution, source.
Withdrawn records are evidence, not current guidance. A replaced record may retain
`status=active` while its effective interval has ended. Optional `at` is canonical
UTC; historical queries may include retired records, never retracted assertions as truth.

Document memories contain summaries and source locators. Open the source when
needed; unavailable is not proof it moved. Report unverified summaries honestly.
No matches does not prove no memory exists; try other literal terms or a known ID.

Advanced inspection: [bounded typed Cypher](references/cypher.md). Raw Cypher
bypasses eligibility. Prefer the maintained explore route. Legacy
[navigate.md](references/navigate.md) remains for compatibility, not new workflows.
