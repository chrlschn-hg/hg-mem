# SQLite CLI session

Requires extension-enabled SQLite CLI with FTS5 and GraphQLite 0.12.0 (tested
SQLite 3.53.4; bootstrap trigger syntax requires SQLite 3.47 or newer). No Python,
package install or executable helper ships with these skills. Install all sibling
skill folders together. Keep plugin-provided environment values. Never initialize
the live DB as a smoke test.

## Start in Paseo

The plugin supplies `HG_SKILLS`, `HG_DB`, `HG_SQLITE`, `HG_EXT`, `HG_OPERATOR`,
`HG_AGENT`, and `HG_SCOPE_IDS`. Do not read Paseo settings with `jq`, export sample
paths, or make up an agent ID. Run this check once per session:

```sh
(
  if [ -n "${HG_MEMORY_ERROR:-}" ]; then
    printf 'Memory unavailable: %s\n' "$HG_MEMORY_ERROR" >&2
    exit 1
  fi
  for key in HG_SKILLS HG_DB HG_SQLITE HG_EXT HG_OPERATOR HG_SCOPE_IDS; do
    if [ -z "$(printenv "$key")" ]; then
      printf 'Memory unavailable: missing %s. Check Memory setup; start a new agent session or reload this agent in Paseo.\n' "$key" >&2
      exit 1
    fi
  done
  for key in HG_DB HG_SQLITE HG_EXT; do
    if [ ! -f "$(printenv "$key")" ]; then
      printf 'Memory unavailable: %s file is missing. Check Memory setup.\n' "$key" >&2
      exit 1
    fi
  done
  if [ ! -f "$HG_SKILLS/memory-workflow/SKILL.md" ]; then
    printf 'Memory unavailable: skills are missing. Use Install / update in Memory setup.\n' >&2
    exit 1
  fi
)
```

If it fails, stop memory operations and report it. Setup's Agent sessions section
records launch delivery; it does not prove the provider passed values to shell tools.
If delivery succeeded but the shell is missing values, check the provider's shell
environment policy. A plugin reload or Memory's Refresh action cannot change an
already-running process. Start a new agent session or use Paseo's agent reload.

## Inline CLI helpers

Read and define these two functions directly in the shell call that runs a recipe.
No script file, `source`, code-extraction loader, `jq`, or new command is needed.
Shell calls may be independent; repeat the definitions when needed. They do not
change shell error modes. Keep `HG_EXT` free of double quotes/newlines for `.load`.
`HG_OPERATOR` is the configured human identity; `HG_AGENT` is the session's supplied
agent identity. If either is missing, report it; do not invent a human identity or
reuse another agent's identity. Recall can run without `HG_AGENT`; own writes cannot.

```sh
# Extract runnable SQL from a trusted bundled Markdown recipe; no generated script.
hgblock() {
  awk '/^```sql$/{inside=1; found=1; next} /^```$/{inside=0; next} inside{print} END{if(!found)exit 1}' \
    "$HG_SKILLS/$1"
}

# Direct CLI; optional HG_INPUT is an absolute JSON request-file path.
hgsql() {
  if [ -n "${HG_INPUT:-}" ]; then
    test -f "$HG_INPUT" || return 1
    hg_input_sql=$(printf '%s' "$HG_INPUT" | sed "s/'/''/g")
    "$HG_SQLITE" -bail -cmd ".load \"$HG_EXT\"" \
      -cmd '.timeout 8000' \
      -cmd '.parameter init' \
      -cmd ".parameter set @p \"CAST(readfile('$hg_input_sql') AS TEXT)\"" "$HG_DB" "$@"
  else
    "$HG_SQLITE" -bail -cmd ".load \"$HG_EXT\"" \
      -cmd '.timeout 8000' "$HG_DB" "$@"
  fi
}

```

Capability check (temporary in-memory database):

```sh
"$HG_SQLITE" -bail :memory: -cmd ".load \"$HG_EXT\"" \
  "SELECT cypher_capabilities(); CREATE VIRTUAL TABLE temp.fts_probe USING fts5(text);"
```

## Request files

Run `pwd -P`, then write its actual output as the JSON `cwd` value. Examples use
`/work/project` as a placeholder. Quoted heredocs preserve content literally:
`$HG_AGENT`, `$PWD`, and `$(pwd -P)` inside them do **not** expand. Replace sample
values with actual values before running. Escape JSON quotes and backslashes;
never switch to an unquoted heredoc for arbitrary memory text.

`HG_SCOPE_IDS` is the supplied JSON array of project scopes. Preserve it in request
`scopes`; do not silently replace project bindings with `[]`. Directory scope uses
the real task directory (`pwd -P`). Print `printf '%s\n' "$HG_SCOPE_IDS"`, then copy
that literal array into the quoted JSON request. Never put `$HG_SCOPE_IDS` literally
inside the heredoc. If supplied scopes fail the eligibility guard, stop and report
the binding/context problem; do not retry with `[]` or global scope to bypass it.
Outside Paseo, explicit runtime configuration
belongs to [memory-setup](../../memory-setup/SKILL.md), not automatic recovery.

## Explicit runtime acquisition

```sh
# Optional acquisition: macOS ARM64; select a matching release asset on other hosts.
mkdir -p ./runtime
curl -fL https://github.com/colliery-io/graphqlite/releases/download/v0.12.0/graphqlite-macos-arm64.dylib \
  -o ./runtime/graphqlite.dylib
printf '%s\n' '46ff8b643847840a48806bfa1ed1bb27762cdbd08a72d7d3b04b4bbae0b2e886  ./runtime/graphqlite.dylib' \
  | shasum -a 256 -c -
export HG_EXT="$PWD/runtime/graphqlite.dylib"
# No compatible CLI? Obtain extension-enabled sqlite3 before continuing.
# Native gqlite has no SQL interface; query errors may still exit zero.
```

```text
# JSON values stay in HG_INPUT; SQL/Cypher receive bound @p / named parameters.
# Do not interpolate user content into SQL, Cypher or .parameter commands.
# BEGIN IMMEDIATE -> assertions -> mutations -> FTS -> assertions -> COMMIT.
# -bail stops on error; connection close rolls back an open transaction.
# Keep -cmd arguments dot-commands only; SQL PRAGMAs belong in recipe stdin.
# Inspect output and exit status. No automatic retry, migration or raw-write bypass.
# Full validation/rebuild favors small stores; optimize only with measured coverage.
```

## References

- [Version-one graph and lifecycle contract](schema.md)
- [Official GraphQLite release assets](https://github.com/colliery-io/graphqlite/releases/tag/v0.12.0)
- [SQLite CLI parameters, dot commands and batch execution](https://sqlite.org/cli.html)
- [Parameterized GraphQLite SQL interface](https://colliery-io.github.io/graphqlite/reference/sql-interface/)
