# SQLite CLI session

Requires extension-enabled SQLite CLI with FTS5 and GraphQLite 0.12.0 (tested
SQLite 3.53.4; bootstrap trigger syntax requires SQLite 3.47 or newer). No Python,
package install or executable helper ships with these skills. Install all sibling
skill folders together. Choose paths; never initialize the live DB as a smoke test.

```sh
# zsh/bash session. Homebrew sqlite3 was tested; system macOS sqlite3 cannot .load.
set -e
set -o pipefail
export HG_SKILLS="/absolute/path/to/skill"
export HG_SQLITE=/opt/homebrew/opt/sqlite/bin/sqlite3
export HG_DB="/absolute/path/to/memories.db"
export HG_EXT="/absolute/path/to/graphqlite.dylib"
# Keep HG_EXT free of quotes/newlines; it becomes a .load filename.

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

# Capability smoke in memory; existing-DB recipes first require test -f "$HG_DB".
"$HG_SQLITE" -bail :memory: -cmd ".load \"$HG_EXT\"" \
  "SELECT cypher_capabilities(); CREATE VIRTUAL TABLE temp.fts_probe USING fts5(text);"
```

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
