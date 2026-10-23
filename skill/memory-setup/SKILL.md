---
name: memory-setup
description: Explicitly configure the GraphQLite SQLite CLI and initialize a new managed memory store. Use for setup requests, not routine recall or automatic repair.
---

# Set up memory

Read [runtime acquisition](../memory-workflow/references/runtime.md) and
[schema](../memory-workflow/references/schema.md). Confirm the chosen database
and operator. Missing configuration during a task is not permission to initialize.

```sh
# New managed database only. Parent directory must exist; never use gqlite --init.
# Keep HG_DB explicit. Existing initialized/unmanaged stores reject bootstrap.
unset HG_INPUT
hgblock memory-setup/references/bootstrap.md | hgsql
# Require: hg-mem schema v1 initialized, exit 0.

# Reopen: prove persistence and inspect invariants. No test memories in a real store.
test -f "$HG_DB"
printf '%s\n' \
  'SELECT version FROM hg_meta;' \
  'SELECT id,name,scope_kind FROM hg_node;' \
  'SELECT * FROM hg_violation;' | hgsql
# Expect version 1, scope:global, zero violations.
```

Create the confirmed Operator and meaningful filing nodes using
[memory-write](../memory-write/SKILL.md). Then use
[memory-recall](../memory-recall/SKILL.md). Bootstrap is not migration or repair.

In Paseo, use Memory setup for plugin-managed configuration and skill installation.
Do not manually copy skills into provider folders to work around an installation failure.
