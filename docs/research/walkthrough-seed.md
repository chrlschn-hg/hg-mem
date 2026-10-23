# Seed receipt: walkthrough graph demo

Script: [seed-graph-demo.mts](../seed-graph-demo.mts). Target only `discovery/plugin-v1/walkthrough/memories.db`.
Backup taken before the first run: [seed-backup/memories.before-seed-graph-demo.db](../seed-backup/memories.before-seed-graph-demo.db).
Run: `cd paseo-hg-mem && node --import tsx ../discovery/plugin-v1/seed-graph-demo.mts`.

## Result (first run)

- Created: 8 taxonomy and operator nodes, 43 memories.
- Store after seed: 46 memories (3 original, 43 `demo:graph:*`), 8 `demo:graph:*` taxonomy/operator nodes.
- `hg_violation`: 0. `hg_fts`: 46 rows (graph and FTS consistent through the commit recipe).
- Original three memories and their non-demo nodes: identical to the backup.
- Rerun: created 0 and 0 (idempotent). Counts unchanged.

## Edge types present

`CHILD_OF` (6), `FILED_UNDER` (40), `APPLIES_TO` (46), `ABOUT` (5), `SUPERSEDES` (3).

## Taxonomy and operators (new)

- Areas (CHILD_OF `domain:project-knowledge`): `demo:graph:area-retrieval`, `demo:graph:area-lifecycle`.
- Topics: `demo:graph:topic-paging` and `demo:graph:topic-ranking` under retrieval; `demo:graph:topic-revisions` and `demo:graph:topic-retirement` under lifecycle.
- Operators: `demo:graph:operator-alpha`, `demo:graph:operator-beta` (names prefixed `[Synthetic demo]`).

## Memories (new, all content prefixed `[Synthetic demo]`)

- Paging: 26 Operational memories filed to `demo:graph:topic-paging`, scope global. Ids `demo:graph:mem-paging-01` to `-26`.
- Ranking: 6 Operational memories filed to `demo:graph:topic-ranking`, scope the existing hg-mem directory scope (`/Users/charles.chen/code/hg/sandbox-2026/hg-mem`).
- Persona: 4, ABOUT `demo:graph:operator-alpha` (two) and `-beta` (two): `demo:graph:persona-1` to `-4`.
- CAPA required sample: `demo:graph:capa-required`, required, `source_ref` `synthetic:graph-demo`, asserted by `operator:demo`.
- Revision chain: `demo:graph:rev-1` to `-4`, CAPA, global, filed to `demo:graph:topic-revisions`. Touching intervals: [2026-01-01, 2026-02-01), [2026-02-01, 2026-03-01), [2026-03-01, 2026-04-01), [2026-04-01, open). `SUPERSEDES` links rev-2 to rev-1, rev-3 to rev-2, rev-4 to rev-3.
- Retirement samples: `demo:graph:retired-1` and `-2`, status retired, `valid_to` 2026-09-01.

## Approach, recorded

- Nodes and memories: shipped `begin`, `context` or `create`, `commit` recipes with bound JSON. Existing nodes are skipped; nothing is deleted.
- Revision links and retirement: raw Cypher in one `begin`/`commit` transaction. Recipes cannot set past intervals or a retired status. Intervals close exactly where the successor starts, so `supersedes_time` holds.
- Verify: the shipped `verify` recipe runs at the end of the script and must pass.

## Test queries for the root

- Paging seed: `demo:graph:mem-paging-01`, relation `filing`, global context (`cwd` `/`). Total 25 neighbors (26 members). Page 1 (offset 0, limit 20) returns 20; page 2 (offset 20, limit 20) returns 5. Sample via: `demo:graph:mem-paging-01 -[FILED_UNDER]-> demo:graph:topic-paging <-[FILED_UNDER]- demo:graph:mem-paging-02`.
- Revision seed: `demo:graph:rev-2`, relation `revisions`. Total 3: predecessor `rev-1` (depth 1); successors `rev-3` (depth 1) and `rev-4` (depth 2). `rev-1` and `rev-3` are INACTIVE by time; `rev-4` is APPLIES.
- Domain subtree from `domain:project-knowledge` (global context): total 28. Route sample: `domain:project-knowledge <-[CHILD_OF]- demo:graph:area-retrieval <-[CHILD_OF]- demo:graph:topic-ranking <-[FILED_UNDER]- demo:graph:capa-required`.
- Directory-scoped ranking memories are excluded from the global context, as the scope rules require. With the hg-mem root as context they are eligible.
- Browse search `Paging` (global context): total 26.
- Store health for this database (operator `operator:demo`): ready.

## Notes

- The 26 paging memories give a seed with 25 neighbors (the seed plus 25 others is 26 members). Two pages of 20 and 5 exercise the paging boundary.
- Old revisions carry status `active` with closed intervals; they are historical by time, not by status.
