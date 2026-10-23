---
name: hg-mem-init
description: Set up extension-enabled SQLite CLI with GraphQLite 0.12.0 and initialize a new managed hg-mem database; reject existing unmanaged data without migration.
---

# Initialize hg-mem

Read [runtime acquisition and CLI setup](../hg-mem/references/runtime.md), then
the [schema contract](../hg-mem/references/schema.md). No Python runtime required.

```sh
# Choose HG_DB explicitly. Parent directory must exist; never use gqlite --init.
# Bootstrap is for a NEW database only. Existing data or an initialized DB rejects.
unset HG_INPUT
hgblock hg-mem-init/references/bootstrap.md | hgsql
# Require: hg-mem schema v1 initialized, exit 0.
```

```sh
# Reopen in a separate CLI process: persistence, version, explicit global scope.
test -f "$HG_DB"
printf '%s\n' \
  'PRAGMA foreign_keys=ON;' \
  'SELECT version FROM hg_meta;' \
  'SELECT id,name,scope_kind FROM hg_node;' \
  'SELECT * FROM hg_violation;' | hgsql
# Expect version 1, scope:global, zero violations. No fake user memory is inserted.
# Next: create Operator/taxonomy context, add one memory, read it back using siblings.
```

## References

- [Runtime dependencies, verified download and direct CLI session](../hg-mem/references/runtime.md)
- [Complete bootstrap SQL and preconditions](references/bootstrap.md)
- [Version-one schema and lifecycle behavior](../hg-mem/references/schema.md)
- [Create context and memories](../hg-mem-write/SKILL.md)
- [Read a stored memory in a separate invocation](../hg-mem-recall/references/read.md)
