---
name: hg-mem
description: Coordinate SQLite GraphQLite memory tasks; route initialization, writing, recall and maintenance through the shared graph contract.
---

# Memory workflow

Read the [schema](references/schema.md); load the [CLI session](references/runtime.md).

```text
# Resolve the chosen DB, operator and task context; never infer another DB.
# Before acting: inventory applicable directives; read all pages/full bodies.
# Recall relevant Persona and operational memories; show unresolved conflicts.
# Route to one operation below. Loading this skill does not authorize recording.
# Report public IDs, evidence state and uncertainty; summaries identify sources.
```

| Task | Skill |
| --- | --- |
| New runtime/database | [Initialize](../hg-mem-init/SKILL.md) |
| Add or revise memory/context | [Write](../hg-mem-write/SKILL.md) |
| Search, read, navigate, directive check | [Recall](../hg-mem-recall/SKILL.md) |
| Inspect, verify, rebuild search | [Maintain](../hg-mem-maintain/SKILL.md) |

```sh
# Existing managed DB; no initialization or repair is implicit.
test -f "$HG_DB"
hgblock hg-mem-maintain/references/inspect.md | hgsql
# Run the recall skill's directive inventory with canonical cwd and explicit scopes.
```

## References

- [Version-one graph and lifecycle contract](references/schema.md)
- [Runtime acquisition, environment and inline CLI loader](references/runtime.md)
- [Eligibility and retrieval snapshot SQL](references/eligible.md)
