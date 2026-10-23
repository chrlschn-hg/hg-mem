# Typed Cypher exploration (read-only)

Structure around a memory you already found: filing ancestry, subject, scopes, revisions, same-topic neighbours.
Graph v1 has only `Memory` (+ one of `Persona`/`CAPA`/`Operational`), `Domain`/`Area`/`Topic`, `Scope`, `Operator` and the edges
`FILED_UNDER`, `CHILD_OF`, `ABOUT`, `APPLIES_TO`, `SUPERSEDES` ([schema](../../memory-workflow/references/schema.md)). Do not invent labels or edges.

```text
# Global context vs applicability: Domain/Area/Topic/Operator/Scope nodes are shared context and are always readable.
# A Memory is applicable only if eligible (scope, status, time) for the request. Filing and ancestry never grant applicability.
# Scope is an attribute to read (recipe A4), not a hub to walk: do not traverse APPLIES_TO to find "other memories".
# Current-memory discovery (B recipes) passes the eligible ids and filters `o.id IN $eligible` BEFORE DISTINCT/ORDER/SKIP/LIMIT.
# Never take a raw top-k and filter afterwards. Revision history (A5) deliberately shows retired/replaced evidence and flags `eligible_in_request`.
# Values reach Cypher only as bound parameters ($id, $limit, ...) from the request JSON; Cypher text is constant. No string splicing.
# PRAGMA query_only=ON before the Cypher makes any write fail. Only MATCH/OPTIONAL MATCH/RETURN here.
# Public ids: on a MATCH-bound variable (m, t, o) `.id` is the public property id. On path elements it is NOT: observed on GraphQLite 0.12.0,
# nodes(p) returns node objects whose `id` is the internal integer (public id only inside `properties.id`), and in `[x IN nodes(p) | x.id]`
# `x.id` yields that internal integer (x.name still reads the property). Never use nodes(p)/relationships(p) as public paths:
# bind each hop to a variable and return explicit maps (A1) or fields (A5).
# Rows are JSON in one cell. Missing optional hops are null: drop steps whose `edge` is null.
```

Request file (`HG_INPUT`, see [SKILL](../SKILL.md)). `id` is a public id; A2 and B recipes take `limit` (1..500) / `offset` (the Cypher uses `SKIP $offset LIMIT $limit`); B recipes also take the eligibility keys
`cwd` (`pwd -P`), `scopes` and optional `at`.

Form A runs without eligibility; form B prepends the shared eligibility snapshot and passes `$eligible` (O(eligible) list; fine for small stores).

```sh
# Form A (context/evidence). Put one SELECT cypher('<constant text>', @p) below the PRAGMA.
hgsql <<'SQL'
PRAGMA query_only=ON;
.mode list
SELECT cypher('MATCH (m:Memory {id:$id}) RETURN m.id AS id', @p);
SQL
# Form B (eligible current memories): snapshot first, then the guard, then the query, then COMMIT.
{ hgblock memory-workflow/references/eligible.md; cat <<'SQL'
PRAGMA query_only=ON;
.mode list
SELECT cypher('MATCH (m:Memory {id:$id}) RETURN m.id AS id, m.id IN $eligible AS eligible_in_request',
  json_patch(@p, json_object('eligible', (SELECT json_group_array(id) FROM _eligible))));
COMMIT;
SQL
} | hgsql
```

## A1 Filing ancestry (request `{"id":"mem:cache-v1"}`)

```sh
hgsql <<'SQL'
PRAGMA query_only=ON;
.mode list
SELECT cypher('MATCH (m:Memory {id:$id})-[r1:FILED_UNDER]->(t) OPTIONAL MATCH (t)-[r2:CHILD_OF]->(a) OPTIONAL MATCH (a)-[r3:CHILD_OF]->(d) RETURN m.id AS memory, [{from: m.id, edge: type(r1), to: t.id, label: labels(t)[0], name: t.name}, {from: t.id, edge: type(r2), to: a.id, label: labels(a)[0], name: a.name}, {from: a.id, edge: type(r3), to: d.id, label: labels(d)[0], name: d.name}] AS steps', @p);
SQL
```

```text
[{"memory":"mem:cache-v1","steps":[{"from":"mem:cache-v1","edge":"FILED_UNDER","to":"topic:sqlite","label":"Topic","name":"SQLite runtime"},{"from":"topic:sqlite","edge":"CHILD_OF","to":"area:build","label":"Area","name":"Build and Tooling"},{"from":"area:build","edge":"CHILD_OF","to":"domain:software","label":"Domain","name":"Software"}]}]
```

No rows means no filing (Persona/CAPA may have none) only for a seed you confirmed exists (`read`); an unknown seed id also returns `[]`. Taxonomy is at most three levels, so the fixed pattern is complete.

## A2 Taxonomy below a node (request `{"id":"area:build","limit":50,"offset":0}`; `limit` 1..500)

```sh
hgsql <<'SQL'
PRAGMA query_only=ON;
.mode list
SELECT cypher('MATCH (c)-[:CHILD_OF*1..2]->(r {id:$id}) RETURN c.id AS id, c.name AS name, labels(c)[0] AS label ORDER BY id SKIP $offset LIMIT $limit', @p);
SQL
```

## A3 Subject (request `{"id":"mem:pref-concise"}`)

```sh
hgsql <<'SQL'
PRAGMA query_only=ON;
.mode list
SELECT cypher('MATCH (m:Memory {id:$id})-[:ABOUT]->(o:Operator) RETURN o.id AS subject, o.name AS name', @p);
SQL
```

## A4 Scopes: applicability attributes of one memory (request `{"id":"mem:sqlite-local"}`)

```sh
hgsql <<'SQL'
PRAGMA query_only=ON;
.mode list
SELECT cypher('MATCH (m:Memory {id:$id})-[:APPLIES_TO]->(s:Scope) RETURN s.id AS id, s.name AS name, s.kind AS kind, s.root AS root ORDER BY id', @p);
SQL
```

This shows where the memory is meant to apply. Whether it applies to the current task is decided only by eligibility (`search`/`directives`/B recipes).

## A5 Revision history, including retired and replaced (form B; request `{"id":"mem:cache-v1","cwd":"/abs/real/path","scopes":[],"limit":10,"offset":0}`)

```sh
{ hgblock memory-workflow/references/eligible.md; cat <<'SQL'
PRAGMA query_only=ON;
.mode list
SELECT cypher('MATCH p=(s:Memory)-[:SUPERSEDES*1..3]->(n:Memory {id:$id}) RETURN {direction: "successor", id: s.id, status: s.status, valid_from: s.valid_from, valid_to: s.valid_to, depth: length(p), eligible_in_request: s.id IN $eligible} AS item ORDER BY item.depth',
  json_patch(@p, json_object('eligible', (SELECT json_group_array(id) FROM _eligible))));
SELECT cypher('MATCH p=(n:Memory {id:$id})-[:SUPERSEDES*1..3]->(o:Memory) RETURN {direction: "predecessor", id: o.id, status: o.status, valid_from: o.valid_from, valid_to: o.valid_to, depth: length(p), eligible_in_request: o.id IN $eligible} AS item ORDER BY item.depth',
  json_patch(@p, json_object('eligible', (SELECT json_group_array(id) FROM _eligible))));
COMMIT;
SQL
} | hgsql
```

```text
[{"item":{"direction":"successor","id":"mem:cache-v2","status":"active","valid_from":"2026-10-23T18:30:36Z","valid_to":null,"depth":1,"eligible_in_request":true}}]
[]
```

(Output of the two statements for `mem:cache-v1`; timestamps differ per database.)

`SUPERSEDES` points new -> old. A replaced memory keeps `status` active and gains `valid_to`; replacement is visible only through this edge.
These rows are historic evidence, not current rules. `eligible_in_request` is relative to THIS request's `cwd`/`scopes`/`at` (with `at` it describes that moment, which may be historical, not necessarily now): only `true` rows can guide action, and only when the request has no `at` or `at` is the moment you care about. The seed may be retired or replaced (it need not be eligible).
Each query prints `[]` when there is no successor/predecessor (depth 1..3, same vocabulary as the backend `RevisionRef`); run both, they are independent.

## B1 Same-topic eligible discovery (request `{"id":"mem:sqlite-runtime","cwd":"/abs/real/path","scopes":[],"limit":10,"offset":0}`)

```sh
{ hgblock memory-workflow/references/eligible.md; cat <<'SQL'
PRAGMA query_only=ON;
.mode list
SELECT cypher('MATCH (m:Memory {id:$id})-[:FILED_UNDER]->(t)<-[:FILED_UNDER]-(o:Memory) WHERE m.id IN $eligible AND o.id <> $id AND o.id IN $eligible RETURN DISTINCT o.id AS id, o.title AS title, t.id AS shared_filing ORDER BY id SKIP $offset LIMIT $limit',
  json_patch(@p, json_object('eligible', (SELECT json_group_array(id) FROM _eligible))));
COMMIT;
SQL
} | hgsql
```

The seed must itself be eligible (`m.id IN $eligible`), as in the product channels, and only eligible neighbours come back, filtered before `LIMIT`; page with `offset`.
`[]` means no eligible neighbour, an ineligible seed, or an unknown seed: Cypher cannot tell which, so run `read` on the seed (exact status and scopes) before concluding. Filing under the same Topic is context, not a claim they apply together.

## B2 Memories filed under a node or its descendants (request `{"id":"area:build","cwd":"/abs/real/path","scopes":[],"limit":10,"offset":0}`)

```sh
{ hgblock memory-workflow/references/eligible.md; cat <<'SQL'
PRAGMA query_only=ON;
.mode list
SELECT cypher('MATCH (o:Memory)-[:FILED_UNDER]->(t)-[:CHILD_OF*0..2]->(r {id:$id}) WHERE o.id IN $eligible RETURN DISTINCT o.id AS id, o.title AS title, t.id AS filed_under ORDER BY id SKIP $offset LIMIT $limit',
  json_patch(@p, json_object('eligible', (SELECT json_group_array(id) FROM _eligible))));
COMMIT;
SQL
} | hgsql
```

## B3 Eligible memories about a subject (request `{"id":"operator:me","cwd":"/abs/real/path","scopes":[],"limit":10,"offset":0}`)

```sh
{ hgblock memory-workflow/references/eligible.md; cat <<'SQL'
PRAGMA query_only=ON;
.mode list
SELECT cypher('MATCH (m:Memory)-[:ABOUT]->(o:Operator {id:$id}) WHERE m.id IN $eligible RETURN m.id AS id, m.title AS title ORDER BY id SKIP $offset LIMIT $limit',
  json_patch(@p, json_object('eligible', (SELECT json_group_array(id) FROM _eligible))));
COMMIT;
SQL
} | hgsql
```

## Caveats

- This guide is raw Cypher: use it to inspect structure and to reproduce what the app shows, not as the discovery channel of record. The [explore recipe](explore.md)
  (channels `filing`, `subject`, `revisions`, same route as the app UI) is the maintained route; the output shapes here are only samples.
- Public ids appear only where a recipe returns explicit `x.id` fields or maps on bound variables (see the path-id note at the top).
- B recipes pass every eligible id as a list parameter: correct and filtered before `LIMIT`, but O(number of eligible memories) per call.
- Not covered on purpose: generic untyped walks, `APPLIES_TO` hub traversal, per-search-hit related lists, and extending `navigate`.

## Failure notes

- A write attempt (`CREATE`, `SET`, `DELETE`) fails under `query_only`; do not remove the guard.
- A hostile `id` (quotes, braces, `DETACH DELETE`) is only a parameter value and matches nothing.
- Unknown seed id: A recipes return `[]`; use `read` for an exact existence/status answer.
- Generic untyped walks (`-[*]-`), `APPLIES_TO` hub traversal and per-search-hit related lists are out of scope here.

## References

- [Shared eligibility snapshot and request validation](../../memory-workflow/references/eligible.md)
- [Graph v1, authority and time contract](../../memory-workflow/references/schema.md)
- [Explore recipe, the maintained route](explore.md)
- [Typed navigate recipe (bounded SQL walk)](navigate.md)
- [GraphQLite Cypher clauses and functions](https://colliery-io.github.io/graphqlite/reference/cypher-clauses/)
