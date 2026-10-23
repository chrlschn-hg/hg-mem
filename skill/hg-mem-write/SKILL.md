---
name: hg-mem-write
description: Create or revise scoped GraphQLite memories and context nodes using atomic SQLite CLI recipes, including explicit retirement, retraction and same-scope replacement.
---

# Write memories

Load [runtime](../hg-mem/references/runtime.md) and [schema](../hg-mem/references/schema.md).
Before writing, use the [recall recipes](../hg-mem-recall/SKILL.md) for applicable
directives and duplicate/corrected records.
Use an existing managed database: `test -f "$HG_DB"`.

```sh
# Request data only. Choose a fresh public ID and an existing Operator/scope/filing.
export HG_INPUT=$(mktemp)
cat > "$HG_INPUT" <<'JSON'
{"id":"memory:unique-id","kind":"Operational","title":"SQLite extension loading","content":"Use extension-enabled sqlite3 for SQL and Cypher on one connection.","asserted_by":"operator:me","assertion_kind":"explicit","required":false,"source_ref":"conversation:source-id","scopes":["scope:global"],"filing":"domain:software"}
JSON
{ hgblock hg-mem-write/references/begin.md;
  hgblock hg-mem-write/references/create.md;
  hgblock hg-mem-write/references/commit.md; } | hgsql
rm -f "$HG_INPUT"; unset HG_INPUT
# Require a public id + operation result and exit 0. Failed guards roll back.
```

| Operation | Middle recipe / request |
| --- | --- |
| Context | [context](references/context.md): id/label/name; Scope kind/root; Area/Topic parent |
| Memory | [create](references/create.md): example above; Persona also subject Operator |
| Typo/presentation | [edit](references/edit.md): id, meaning_unchanged:true, changed text |
| End applicability now | [retire](references/retire.md): id |
| Withdraw mistaken assertion | [retract](references/retract.md): id |
| Change meaning | [replace-start](references/replace-start.md), [create](references/create.md), [replace-link](references/replace-link.md): old + new create request |

```json
{"id":"operator:me","label":"Operator","name":"Operator"}
```

```json
{"id":"domain:software","label":"Domain","name":"Software"}
```

```text
# Feed each context request through begin + context + commit before the memory example.
# Domain -> Area -> Topic; add parents before children. No placeholder levels.
# required=true for explicit imperatives, even Persona/Operational; inferred stays false.
# CAPA: correction/prevention purpose, not the sole required-instruction channel.
# One independent claim/directive; document exception is summary + source_ref only.
# Preserve literal identifiers, conditions and negation. Never ingest document bodies.
# Unknown start: unknown_start:true; default creation explicitly activates now.
# Meaning changes get a new ID; no in-place scope, authority, temporal or ID changes.
# No automatic broadening, partial/future replacement, revival, deletion or migration.
# Attribute source_ref honestly; generated summaries are not independent evidence.
```

## References

- [Shared graph, scope and lifecycle contract](../hg-mem/references/schema.md)
- [Direct SQLite CLI and JSON binding](../hg-mem/references/runtime.md)
- [Write preconditions](references/begin.md)
- [Validation, search maintenance and commit](references/commit.md)
