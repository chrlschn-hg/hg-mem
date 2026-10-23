# Graph algorithms and functions for memory retrieval

Reviewed pinned GraphQLite 0.12.0 docs/source with DMTS and Senior DBA.
Lead executed a small synthetic in-memory probe using the official release dylib
and SQLite 3.53.1. No live database, schema or skill changed.

## Integration candidates

| Capability | Memory use | Recommendation |
| --- | --- | --- |
| Typed, bounded paths; `nodes`, `relationships`, `length` | Expand a recalled memory through selected subjects/taxonomy; explain why another memory was reached. | First candidate. Smoke passed; test distractor edges, direction, cycles, duplicate paths and eligibility before limits. |
| Typed `shortestPath` | Show a concise connection between two records. | Test before use; one typed one-hop smoke passed, not all-path correctness. Connection is not evidence of applicability or truth. |
| `labels`, `keys`, `properties`, `type`, aggregates | Introspection, inventories and topology summaries. | Include in read/introspection examples after output-contract checks. Return public `.id` separately. |
| Pattern `exists{...}`; property `IS NOT NULL`; `CASE` | Scope membership without duplicate joins; explicit missing/uncertain states. | Useful primitives. Preserve unknown validity; do not coalesce it to an invented effective date. |
| `date.truncate`, epoch constructors, durations | Calendar queries and derived weekly/monthly views. | Test against chosen UTC/timezone and boundary rules. No Temporal nodes required. |
| `count`, `collect`, typed cycle queries | Filing cardinality, missing parents, cycles and scope inventories. | Verification candidates. Counts must distinguish rows, distinct memories and missing optional matches. |

```cypher
// Tested: inspect the record and keep public identity explicit.
MATCH (m:Memory {id:$id})
RETURN m.id, labels(m), keys(m), properties(m)

// Tested: reverse filing direction explicitly; generic BFS cannot do this.
MATCH (t:Topic {id:$id})<-[:FILED_UNDER]-(m:Memory)
RETURN m.id

// Tested pattern presence form; later add the chosen scope/time eligibility.
MATCH (m:Memory)
WHERE exists{(m)-[:APPLIES_TO]->(:Scope)}
RETURN m.id
```

Relationship names in probes are fixture choices, not additional schema decisions.
Bound expansion by both hops and output budget; deduplicate public memory IDs.
Filter eligible records before truncating candidates. Whether traversal may pass
through an ineligible intermediate node needs an explicit policy too.

## Algorithm experiments, rather than defaults

| Algorithm | Potential use | Why it stays optional |
| --- | --- | --- |
| `nodeSimilarity` / `knn` | Suggest structurally related memories; possible duplicate-review candidates. | Non-vector neighborhood Jaccard, not textual or semantic similarity. Shared Scope/taxonomy hubs dominate; global top-k precedes external eligibility. |
| Strongly connected components | Cycle diagnostics on a selected relation graph. | Built-in SCC includes every relation. Use typed recursive queries for taxonomy and SUPERSEDES invariants; separately check self-loops. |
| Weakly connected components, degree | Maintenance overview, isolated islands and hubs. | Shared global scopes can connect everything; whole-graph degree does not prove correct filing. Typed counts often answer the actual question. |
| PageRank, other centralities | Exploratory navigation or ranking on a justified relation graph. | Connectivity does not establish relevance, truth or instruction authority. No personalized seed parameter is documented for PageRank. |
| Louvain / label propagation | Suggest possible organization gaps. | Existing taxonomy/scopes can determine clusters. Never automatically rewrite Domain/Area/Topic or infer applicability. |

Defer DFS, weighted Dijkstra, A*, all-pairs shortest paths and triangle counts
until a concrete query needs them. Our current model has no justified geographic
heuristic or edge-cost policy. Leiden adds a Python dependency outside the CLI
baseline. None is needed for the initial recall contract.

The built-in CSR loader reads all nodes and all edges; algorithm signatures have
no label, relationship-type or scope projection argument. Filtering algorithm
output does not change that input graph. A separate derived graph could provide
a projection, but adds maintenance and is not justified by this review. Typed
Cypher/SQL over authoritative edges is the smaller starting point.

## Executed findings and compatibility checks

```text
# Reproduce the synthetic probe; results are saved alongside the script.
/Users/charles.chen/.local/share/mise/installs/python/3.13.16/bin/python3 \
  -I discovery/algorithms/probe.py
```

- Two memories sharing only a Scope scored Jaccard 1.0. This confirms structural
  similarity can be uninformative about memory content; it is not duplicate proof.
- BFS followed outgoing edges of every type. Starting at Topic did not retrieve
  its incoming FILED_UNDER memory; the typed reverse pattern did.
- Mixed-relation SCC grouped a Memory and Subject linked in both directions.
  That does not imply a taxonomy or supersession cycle.
- `CALL ... YIELD` and standalone algorithm `RETURN` worked with different result
  shapes. Algorithm `user_id` is the text property `id`; internal `node_id` and
  `id(n)` are different. Probe `elementId(m)` serialized numerically despite the
  documented string return: do not use it as a durable public-ID contract.
- `exists(m.aliases)` returned false for a populated list; `exists(r.note)`
  returned false for a populated relationship property. `IS NOT NULL` was true
  in both cases. Pattern existence is a separate implementation and passed its
  smoke check. Validate exact property types before adopting presence helpers.
- Cached BFS retained a transient node after write, algorithm refresh and
  ROLLBACK. Live MATCH returned no such node; explicit `gql_reload_graph()` fixed
  BFS. Same-executor writes can automatically refresh a dirty cache, but that
  does not establish rollback or other-connection invalidation. Do not use cached
  algorithms as the writer's sole validation oracle.
- `date.truncate('week', date({year:2027,month:1,day:1}))` gave `2026-12-28`.
  `datetime.fromepoch(0)` gave `1970-01-01T00:00:00Z`. `date($parts)` gave null,
  whereas `date({year:$year,month:1,day:1})` worked. Parameter support is contextual.

These are API counterexamples and smoke results, not performance or recall scores.

## Focused next tests

1. Typed expansion/path oracle: mixed hubs, distractor relations, unequal paths,
   reversed edges, cycles and missing endpoints. Compare bounded paths and typed
   shortestPath to an independent SQL/host oracle; verify public IDs and nulls.
2. Verification oracle: separate taxonomy and SUPERSEDES cycle checks; seeded
   self-loops, true cycles, valid cross-links and multiple-parent violations.
3. Temporal query equivalence: literal versus parameter predicates, mixed offsets,
   date-only boundaries, leap dates, ISO year changes and missing values. DBA
   source review flags possible optimized lexical versus runtime temporal ordering
   differences; no mixed-offset runtime failure was tested here. Normalize stored
   instants consistently and test the exact predicates we will expose.
4. Optional typed Jaccard: selected ABOUT subjects versus whole-graph neighbors,
   shared-global-scope controls, parallel edges, and higher-ranked ineligible
   candidates. Require measured retrieval gain before introducing ranking logic.
5. If cached algorithms are retained: committed/raw-SQL/other-connection changes,
   rollback and reload behavior. Avoid cached algorithm calls in write validation.

No new persistent score, node, edge or algorithm cache is selected. First integrate
tested introspection/predicate helpers; extend recall with bounded typed paths
after the path oracle passes. Centrality, communities and similarity remain
derived experiments and never gate required directives.

## References

- [GraphQLite algorithm reference and signatures](https://colliery-io.github.io/graphqlite/reference/algorithms/)
- [GraphQLite algorithm selection and cache guide](https://colliery-io.github.io/graphqlite/how-to/graph-algorithms/)
- [GraphQLite Cypher functions reference](https://colliery-io.github.io/graphqlite/reference/cypher-functions/)
- [Pinned v0.12.0 algorithm documentation](../../source/graphqlite/docs/src/content/docs/0.12.0/reference/algorithms.md)
- [Pinned v0.12.0 function documentation](../../source/graphqlite/docs/src/content/docs/0.12.0/reference/cypher-functions.md)
- [Whole-graph CSR loader and public-ID mapping](../../source/graphqlite/src/backend/executor/graph_algorithms.c)
- [Outgoing-neighbor Jaccard KNN implementation](../../source/graphqlite/src/backend/executor/graph_algo_knn.c)
- [Property-existence query transformation](../../source/graphqlite/src/backend/transform/transform_expr_predicate.c)
- [Algorithm dispatch and dirty-cache reload](../../source/graphqlite/src/backend/executor/query_dispatch.c)
- [Executed synthetic probe](../../discovery/algorithms/probe.py)
- [Captured probe results and exact query forms](../../discovery/algorithms/probe-results.json)
- [Earlier technical-discovery findings and limits](technical-discovery-results.md)
