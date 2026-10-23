---
name: hg-mem-recall
description: Recall memories before acting or when asked what is remembered. Loads required directives for the current scope, searches memory content, reads one memory by id, navigates typed links. Read-only SQLite CLI recipes.
---

# Recall memories

Read-only. Load the [CLI session](../hg-mem/references/runtime.md) first (`hgsql`, `hgblock`, `HG_*`); record layout and
policy are in the [schema](../hg-mem/references/schema.md). Existing managed DB only: `test -f "$HG_DB"` before any recipe.
Do not write, and never splice user text into SQL: request values go in a JSON file bound as `@p`.

## Run a recipe

```sh
# 1. Request file. Quoted heredoc: no shell expansion; escape " and \ for JSON. cwd = output of `pwd -P`.
export HG_INPUT=$(mktemp)
cat > "$HG_INPUT" <<'JSON'
{"cwd":"/abs/real/path","scopes":[],"limit":50,"offset":0}
JSON
# 2. Shared eligibility snapshot, then one operation block; pipe to the CLI.
{ hgblock hg-mem/references/eligible.md; hgblock hg-mem-recall/references/directives.md; } | hgsql
rm -f "$HG_INPUT"; unset HG_INPUT
```

| Key | Meaning |
| --- | --- |
| `cwd` | canonical absolute working directory (required except `read`) |
| `scopes` | public ids of explicit project/session scopes you know; `[]` if none |
| `at` | optional canonical UTC `2026-10-23T12:00:00Z`; omit for now |
| `limit` 1..500, `offset` >=0 | paging; `depth` 1..3 for navigate |
| `query` / `id` | search text / memory or context-node public id |

A nonzero exit or `Error near line` means the request was rejected or failed; nothing is partial. Fix the request, do not retry blindly.

## 1. Before a task or action: required directives (never skip, never use search for this)

Recipe `hg-mem-recall/references/directives.md`; keys `cwd scopes at limit offset`.

- Inventory is by scope and status, not by text, tag, topic or purpose label. The first result row gives `total`.
- Page (`offset += limit`) until every row is read; do not act on a partial page. Read each full `content`, not only the title.
- `validity` marks known-applicable vs possibly applicable (e.g. unknown start): treat the first as binding, tell the user about the second.
- Conflicting directives come back together: report the conflict; do not pick one silently.
- Without `at`, retired or retracted rules do not return, and a replaced rule does not come back when its replacement ends. With `at`, retired records inside their validity interval can appear (status shows `retired`); retracted never do.

## 2. Find memories by content

Recipe `hg-mem-recall/references/search.md`; keys `query cwd scopes at limit offset`.

- The query is tokenized by SQLite and matched as word prefixes joined by OR (`arch` finds `architecture`; no stemming or synonyms). Retry with other literal
  wording or identifiers; an empty result does not prove absence. Hits are summaries/candidates, not source-supported answers.
- Only eligible memories are ranked and limited; raising `limit` is not a scope fix. Search is not the directive channel.

## 3. Read and navigate

- `hg-mem-recall/references/read.md` (no eligibility prefix; request `{"id":"..."}` only): the record in any status or scope plus its
  direct edges. An unknown id is an error. Retracted means mistaken: never quote it as current. `purpose`, `required`, `status`,
  validity, provenance and `source_ref` are all shown.
- `hg-mem-recall/references/navigate.md`; keys `id depth cwd scopes at limit offset`: FILED_UNDER, CHILD_OF, ABOUT, SUPERSEDES only,
  both directions, `via` shows the path. A Memory seed must be eligible; ineligible memories are skipped even as intermediates.
  Filing and ancestors give context, not applicability.

### Explore from a hit: search, breadcrumb, explicit exploration, read

Search finds candidates and already carries context per hit: `filing_path` (Domain > Area > Topic), `subject`, `scopes` (with `matched`),
and direct `revisions`. That context is not applicability and is not a related-memory list. To follow structure, pick one hit and explore ONE channel on purpose:

```sh
export HG_INPUT=$(mktemp)
cat > "$HG_INPUT" <<'JSON'
{"id":"mem:hit-id","relation":"filing","cwd":"/abs/real/path","scopes":[],"limit":30,"offset":0}
JSON
{ hgblock hg-mem/references/eligible.md; hgblock hg-mem-recall/references/explore.md; } | hgsql
rm -f "$HG_INPUT"; unset HG_INPUT
```

| `relation` | Seed | Returns |
| --- | --- | --- |
| `filing` | eligible memory, or Domain/Area/Topic | eligible memories filed on the same node, or under the taxonomy subtree |
| `subject` | eligible memory, or Operator | eligible memories ABOUT the same Operator |
| `revisions` | memory (may be retired or replaced) | SUPERSEDES history up to 3 steps each way, any status; history only, not rules |

- Same route as the app UI. Current channels need an eligible memory seed and return only eligible memories, filtered before `LIMIT`; page (`offset += limit`)
  until you have enough or `total` is exhausted. A Scope seed or other combination is rejected, not widened.
- Revision rows are evidence: a replaced memory keeps `status` active with a `valid_to`; only its `validity` and the successor edge show it ended.
  Use `read` before relying on any of them.
- Scope is an attribute to read, not a hub to walk; do not look for "everything that applies" by traversing it.
- Raw Cypher ([typed Cypher exploration](references/cypher.md)) is for inspection and advanced structure questions, with the same eligibility rules; prefer `explore`.

Finish with `read` on any memory you will rely on (full body, status, validity, `source_ref`), then report.

## 4. Documents

A document memory holds a summary and `source_ref`; bodies are not indexed. Open `source_ref` only when the summary is not enough,
and check it still supports the summary. If it cannot be opened, say it is unavailable; do not search for it or say it moved, and
return the stored summary marked unverified against the source.

## Report

State what was recalled and its scope. Separate stored statements from your inference. Say when directives were uncertain,
paged, conflicting, or when a source was unavailable. Do not turn an inferred preference into an obligation.

## References

- [Eligibility snapshot and request validation](../hg-mem/references/eligible.md)
- [Required-directive recipe](references/directives.md), [search recipe](references/search.md),
  [navigate recipe](references/navigate.md), [read recipe](references/read.md)
- [Explore recipe (filing, subject, revisions)](references/explore.md)
- [Typed Cypher exploration guide for inspection](references/cypher.md)
- [Record layout and policy v1](../hg-mem/references/schema.md)
- [CLI session and loader functions](../hg-mem/references/runtime.md)
