# Version growth: DBA review

Review of the shipped text recipes and pinned GraphQLite 0.12.0 source, plus existing E9 artifacts. No database access, new EXPLAIN execution, benchmark, or implementation. These are alternatives to test, not selected schema changes.

Current search already excludes ended versions through a shared status/time/scope predicate. Do not replace that contract with an instruction to agents to remember a `current` flag. The unresolved scaling issue is physical work: history remains in FTS and the graph, even when it cannot appear in current results.

## What the current implementation guarantees

- `eligible.md` uses active status, a known start no later than the request time (or an unknown start), an end strictly later than that time (or no declared end), and an applicable scope. Unknown starts remain `POSSIBLE`.
- Replacement closes the predecessor's interval but leaves its status `active`. Thus `status=active` alone is insufficient both for retrieval and for a smaller search index.
- Search joins eligibility before LIMIT/OFFSET. It does not pick global top-k and then discard historical or out-of-scope hits. Exact match counts also apply eligibility.
- Explicit `at` queries include historically valid retired records and exclude retracted assertions. Revision evidence is a different route that can show retracted records. Neither reconstructs what was believed at a historical recording time.
- Retraction never reopens a predecessor. A new sourced memory is the reinstatement path. Future and partial replacements remain rejected; no successor-edge shortcut should silently introduce different semantics.

These guarantees come from [eligibility](../skill/memory-workflow/references/eligible.md), [search](../skill/memory-recall/references/search.md), [replacement](../skill/memory-write/references/replace-link.md), and the [lifecycle contract](../skill/memory-workflow/references/schema.md).

## Where history still costs work

The [commit recipe](../skill/memory-write/references/commit.md) deletes and rebuilds all FTS rows from all `hg_memory` records after full graph validation. More history therefore increases the amount of content processed by each rebuild. A current-result filter does not change this write path.

FTS contains all historical terms. Eligibility before LIMIT guarantees membership, not a particular physical join order or a bounded number of posting candidates. Existing E9 SQL plans show an FTS scan followed by indexed scope checks and an ordering temporary B-tree. They are prototype plans, not plans for the current recipes. The current `hg_node` view pivots typed EAV properties with aggregation; its work and possible materialization must also be measured. A small FTS index alone does not prove the rest of a query avoids history.

There is also a ranking effect: FTS5 BM25 uses table-wide document frequency and average document length. Consequently, adding excluded historical versions can change current-result scores, and potentially their ordering. This is an inference from the [FTS5 BM25 definition](https://sqlite.org/fts5.html#the_bm25_function), not a measured local ranking failure.

## Alternatives worth comparing

| Alternative | Benefit | Limit / decision |
|---|---|---|
| Existing status/time/scope predicates | No duplicated truth; correct current and explicit historical eligibility | Keep as the baseline and final eligibility gate; measure growing history |
| Stored `is_current` property or label | May narrow graph candidates if the actual plan uses it | Time can change applicability without a write; scope is request-relative. A graph flag does not remove old FTS postings. Only consider a rebuildable optimization, never new authority |
| Structural head edge or family node | Could locate a family's terminal revision directly | Terminal does not mean applicable: it may be expired, retracted, or future-dated. Does not shrink FTS. Existing bounded lineage navigation supplies no concrete need for another canonical node/edge |
| Derived live-candidate FTS, explicit history route | Removes ended-version terms from default search; separates current ranking statistics | Needs atomic maintenance, expiry cleanup, independent rebuild verification, and a measured benefit. Retain final time/scope checks |

For the last option, a candidate definition at maintenance time `w` is `status='active' AND (valid_to IS NULL OR valid_to>w)`. Deliberately retain future starts and unknown starts. At a later current query time `t>=w`, final eligibility removes future and newly expired candidates. This avoids missed activation merely because no write occurred when a start date arrived. Ended candidates still require cleanup for a physical size bound; write-only refresh is insufficient during idle periods. Clock reversal or requests before `w` must use the history route or refresh against that earlier time. This is a proposed maintenance contract, not implemented behavior.

Do not call this candidate set exact current truth. Do not define it only by active status. Keep existing history searchable explicitly, or assess an on-demand historical search alternative; neither full historical body indexing nor embeddings is proposed. Maintaining two indexes by rebuilding the entire historical one on every write would retain the principal write-growth problem. Full graph validation would remain another independent cost even after incremental FTS maintenance.

## Query patterns and physical index admission

The conceptual Cypher eligibility pattern below receives scope IDs already resolved by the shared scope policy, including global and applicable directories. It is not a replacement implementation:

```cypher
MATCH (m:Memory)-[:APPLIES_TO]->(s:Scope)
WHERE s.id IN $scope_ids
  AND m.status = 'active'
  AND (m.valid_from IS NULL OR m.valid_from <= $at)
  AND (m.valid_to IS NULL OR m.valid_to > $at)
RETURN DISTINCT id(m), m.id
```

For explicit historical valid-time search, change only the disposition predicate to `m.status <> 'retracted'` and use the requested time. Required-instruction inventory adds `m.required=true` and remains independent of lexical search. Keep canonical UTC comparisons and the separate `POSSIBLE` classification. A candidate-only FTS SQL pattern remains `FTS MATCH query JOIN eligible ON eligible.nid=FTS.rowid`, then ranking and LIMIT; eligibility after top-k is not an alternative.

GraphQLite already has label `(label,node_id)`, typed property `(key_id,value,node_id)`, and edge `(source_id,type)` / `(target_id,type)` indexes. Its Cypher `CREATE INDEX` is metadata-only. Existing E9 plans show that generated Cypher can still use repeated property lookups rather than a selective value-driven plan. Read the generated SQL and its inner SQLite plan; do not infer performance from the presence of an index or from the outer `SELECT cypher(...)` plan.

First compare existing direct typed-EAV SQL and the aggregate view for the same predicate. Admit a covering edge index, narrow candidate projection, or other physical index only if its specific query misses a predeclared budget and the new plan measurably reduces the expensive work. A start-led interval index and an end-led one are comparison arms, not an automatic composite-index prescription. Status/start/end occupy different EAV rows; an ordinary index on that table cannot magically combine them as columns of one memory row.

## History does not require a growing chain of SQL joins

Historical text search and as-of validity queries filter stored records directly; they need no `SUPERSEDES` traversal. Lineage exploration is separate. The current [explore recipe](../skill/memory-recall/references/explore.md) uses two recursive CTEs, each capped inside recursion at three steps. On a valid nonbranching revision graph that means at most six neighboring revisions. Each step uses one directional adjacency join; the SQL text does not acquire another self-join for every stored version.

The source has indexes supporting both adjacency directions, but each recursive step also joins `hg_node`. Six returned neighbors is therefore not proof of six underlying EAV rows read. No current explore execution plan was captured in this review. An unbounded chain would require work proportional to the number of traversed edges, plus property retrieval; accumulating the complete `via` path at every depth can also create quadratic total path text. A future full-history browser should bound recursion/work and continue from a frontier, rather than relying on a final LIMIT after producing all history. No family node is justified solely to avoid an imagined ever-longer generated SQL statement.

## Small falsification benchmark, not yet run

Hypothesis: current queries remain within budget at fixed live cardinality as versions grow, without another projection.

Fixture: 1,000 live memories with 1, 10, and 100 total revisions per chain: 1k/10k/100k graph records. Keep current bodies, scope memberships, and current answers fixed. Reuse the same lexical terms across ended versions; add an uneven-growth arm with one lineage at 100 versions and all others at one. Include a selective directory, multi-scope memories, unknown starts, future activation, expiry without a write, retired/retracted heads, and no-revival cases. Use a separate small lifecycle oracle if those cases would change the fixed performance cohort.

Compare: (A) exact shipped recipes, including count and full result enrichment; (B) equivalent direct-EAV candidate lookup, changing no schema; (C) derived live-candidate FTS with final eligibility plus explicit history search. Measure FTS-only matching, eligibility, enrichment, and full CLI operation separately. Include required inventory, historical text/as-of search, and the capped lineage query.

Observe: generated SQL and inner EXPLAIN QUERY PLAN; scan visits where supported, otherwise explicitly labeled VM-step proxies; matched candidate counts; warm and new-process p50/p95; index rows/bytes and database bytes; create/replace/retract latency; expiry-cleanup and rebuild cost. EQP and returned-row counts alone do not measure posting visits. Compare complete eligible result sets and each arm's independently computed ranking; different FTS corpora need not have identical BM25 order. Check ranking stability as history grows, not just latency.

Decision: predeclare budgets for the actual CLI workflow and judged live-query relevance before running. For a performance-driven change, admit the smallest optimization only if the unchanged baseline misses its budget in three independent blocks, the candidate meets it in all three with at least 2x improvement beyond variability, and maintenance/storage costs meet explicit caps. A relevance-driven change can instead qualify by correcting a predeclared live top-k miss caused by historical growth without new critical relevance misses; changed scores or ordering alone do not establish worse relevance. It must still meet read/write/space budgets. Require zero lifecycle/scope misses, future activation without a write, unknown-start retention, rollback/rebuild equivalence, and no predecessor revival. If A and B meet both performance and relevance needs, keep the existing representation; if B suffices, do not add C. If C fails because graph aggregation or validation still dominates, do not claim a live FTS bounds end-to-end cost. Existing E9 timings do not answer this fixed-live/version-growth experiment.

## Source references

- [Pinned schema indexes](../source/graphqlite/docs/src/content/docs/reference/database-schema.md) and [index executor source](../source/graphqlite/src/backend/executor/executor_schema_objects.c).
- [GraphQLite EXPLAIN and PROFILE](../source/graphqlite/docs/src/content/docs/reference/cypher-clauses.md).
- [Existing E9 plan artifact](../discovery/runtime/results/e9_plans/direct_10000_base.json), [runtime report and limits](../discovery/runtime/REPORT.md), and [previous provisional budget rules](../discovery/runtime/results/e9_budgets.json).
- [Canonical EAV aggregate views and validation](../skill/memory-setup/references/bootstrap.md).
- [FTS5 BM25 statistics](https://sqlite.org/fts5.html#the_bm25_function).

DMTS challenge exchange resolved: active-only FTS would retain replaced versions; successor retraction deliberately does not restore the predecessor. Both reviewers agree to keep interval eligibility authoritative and require measurements before another projection.
