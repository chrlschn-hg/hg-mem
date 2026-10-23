# GraphQLite reference for memory skills

Reviewed 2026-10-23. Upstream: https://github.com/colliery-io/graphqlite.
Local checkout: `source/graphqlite`, main at
`995a8b9bc25cdd86d4c2b50ff7ff87f0eb236629` (0.12.0, 2026-10-17).

This is a source and documentation review, not a finished skill implementation.
The query templates below have not been executed locally. The system Bison is
2.3, below the documented 3.0+ build prerequisite. Subsequently, the official
v0.12.0 macOS ARM64 release CLI was downloaded to `bin/gqlite` and used to create
`data/memories.db`, insert one `Memory` node, and read it back in a separate
process. A CLI count query confirmed exactly one node. The executable came from
https://github.com/colliery-io/graphqlite/releases/download/v0.12.0/gqlite-macos-arm64.

Repeat the read from the workspace root:

```sh
bin/gqlite data/memories.db < examples/read-one-memory.cypher
```

The insertion script is `examples/create-one-memory.cypher`; it uses CREATE and
must not be rerun against this database unless an additional node is intended.

## Reference map

Paths below are relative to the upstream checkout:

| Reference | Relevance |
| --- | --- |
| `docs/src/content/docs/how-to/cli.md` | `gqlite` arguments, stdin scripts, dot commands |
| `src/main.c` | Actual CLI buffering, output, error handling, initialization |
| `docs/src/content/docs/reference/cypher-clauses.md` | MATCH, MERGE, SET, UNWIND, schema objects |
| `docs/src/content/docs/reference/cypher-functions.md` | Entity, list, string, graph functions |
| `docs/src/content/docs/reference/cypher-operators.md` | Text filters, predicates |
| `docs/src/content/docs/reference/sql-interface.md` | JSON results, parameters, validation, capabilities |
| `docs/src/content/docs/how-to/parameterized-queries.md` | `$name` values and JSON parameter objects |
| `docs/src/content/docs/reference/database-schema.md` | SQLite tables and indexes |
| `docs/src/content/docs/explanation/storage-model.md` | Typed EAV property storage |
| `docs/src/content/docs/tutorials/knowledge-graph.md` | Entity identities, relationships, retrieval |
| `examples/sql/01_getting_started.sql` through `06_sql_integration.sql` | SQLite CLI loading, Cypher, traversals, aggregation, analytics |
| `examples/llm-graphrag/{README.md,ingest.py,rag.py}` | Ingestion and seed retrieval followed by graph expansion |
| `src/backend/executor/cypher_executor.c` | Query savepoints, rollback, result printing |
| `src/backend/parser/cypher_scanner.l` | Actual string and comment syntax |
| `bindings/python/src/graphqlite/graph/nodes.py` | Application `id` property used by Python helpers |

Use the unversioned docs for this checkout. The docs also contain historical
0.9.x, 0.10.0, 0.11.0, and 0.12.0 copies; do not mix their behavior accidentally.

## CLI operating contract

Build with `make graphqlite` from the checkout; the binary is `build/gqlite`.
Build the loadable SQLite extension separately with `make extension`.

```sh
source/graphqlite/build/gqlite /absolute/path/memories.db < operation.cypher
```

- Always supply the database path. The default is `graphqlite.db` in the current directory.
- Opening a missing path creates a database and initializes its graph schema.
  For inspection of an existing graph, check that the selected file exists first.
- `-i` / `--init` deletes the existing database file before opening it. It is
  unsuitable for routine skill invocations.
- Available flags are help, verbose, and init. There is no query argument,
  parameter flag, JSON mode, read-only flag, transaction command, or extension
  loading dot command in this shell.
- Feed Cypher through stdin. Put each statement on its own line or set of lines,
  ending in `;`. Do not put multiple statements on one line: the shell only
  removes the final semicolon and passes the whole buffer as one query.
- EOF also executes a pending statement without a semicolon. Do not rely on
  truncation or a missing terminator to prevent execution.
- Dot commands are `.help`, `.schema`, `.tables`, `.stats`, `.quit`, `.exit`.
  They must begin at column one, outside a pending statement, with no semicolon.
- The shell joins buffered input lines with spaces. Avoid line comments in
  generated scripts: `//` can swallow the following buffered query. The CLI
  guide's `--` comment examples disagree with the scanner, which recognizes
  `//` and `/* ... */`, not SQL-style line comments.
- Input uses a 4,096-byte line buffer and a 65,536-byte query buffer. Keep
  statements well below these limits, especially for memory bodies.
- Noninteractive runs still print database/executor startup messages. Results
  use minimum-width text columns, without an unambiguous field delimiter;
  long values, spaces, and embedded newlines complicate parsing.
- Query failures print `Query failed: ...` or `Failed to execute query` to
  stdout. Execution continues and the loop returns zero. Exit status alone
  cannot establish success. Zero-row reads produce no result table; some
  successful no-op writes also produce no explicit success message.
- The executor guards individual write queries with savepoints and rolls back
  failed writes. Outside an enclosing transaction, releasing the savepoint
  commits the query. A multi-statement stdin script is not one atomic operation.

## Introspect schema and topology

Distinguish physical storage, declared constraints, and observed graph shape.
`.schema` lists SQLite table DDL, not a domain model or complete index catalog.
`.stats` counts label assignments, not distinct label names.

```text
.tables
.schema
.stats
```

Cypher templates for observed shape and declared schema objects:

```cypher
SHOW INDEXES;
SHOW CONSTRAINTS;
MATCH (n) UNWIND labels(n) AS label RETURN label, count(*) AS nodes ORDER BY label;
MATCH ()-[r]->() RETURN type(r) AS relationship_type, count(*) AS edges ORDER BY relationship_type;
MATCH (n) UNWIND keys(n) AS key RETURN DISTINCT key ORDER BY key LIMIT 100;
MATCH (a)-[r]->(b) RETURN labels(a) AS source_labels, type(r) AS relationship_type, labels(b) AS target_labels, count(*) AS edges LIMIT 100;
MATCH (n) RETURN id(n) AS internal_id, labels(n) AS labels, properties(n) AS properties LIMIT 10;
```

Inspect property keys and representative values per label, and relationship
properties per type, once the initial inventory identifies them. Limits bound
returned output; they do not necessarily bound the work of aggregation or traversal.
Label-based inventories exclude unlabeled nodes, so retain total node counts.

Do not assume Neo4j APOC or `CALL db.schema.*` / `CALL db.labels()` procedures.
GraphQLite is its own Cypher implementation; verify features in this version.
Cypher indexes are catalog records because property tables already have physical
indexes. Node uniqueness and non-null constraints are enforced after write
queries; relationship constraints are not supported.

## Add memories

The following `Memory` and `Entity` names are illustrative conventions, not
an upstream memory schema. Discover and reuse an existing graph's conventions
before selecting labels, properties, or relationship types.

Use an application ID property such as `m.id`; `id(m)` is the internal SQLite
numeric identity. Python's `upsert_node` helper also uses the `id` property.
Merge on stable identity, not the entire changing memory body.

```cypher
MERGE (m:Memory {id: 'memory:example-001'})
ON CREATE SET m.created_at = '2026-10-23T12:00:00Z'
SET m.content = 'The project uses GraphQLite.', m.source = 'user', m.updated_at = '2026-10-23T12:00:00Z'
RETURN m.id AS id, properties(m) AS memory;
```

For relationships, match known endpoints and merge the directed edge:

```cypher
MATCH (m:Memory {id: 'memory:example-001'}), (e:Entity {id: 'entity:graphqlite'})
MERGE (m)-[:ABOUT]->(e)
RETURN m.id AS memory_id, e.id AS entity_id;
```

Missing endpoints yield no relationship. Verify both memory and relationships
after writing, preferably through a new process to check persistence. Retries
should reuse IDs and merge patterns; do not infer deduplication from `CREATE`.
Do not claim a multi-query operation is atomic. Validate uniqueness/duplicate
behavior under concurrent writers before depending on it.

A fresh schema could enforce application identity with a node constraint:

```cypher
CREATE CONSTRAINT memory_id IF NOT EXISTS FOR (m:Memory) REQUIRE m.id IS UNIQUE;
```

This is a schema change, separate from ordinary memory addition. Establish the
memory data contract (identity scope, content, provenance, timestamps, update
and conflict policy) before implementing skills. Preserve original memory text;
the GraphRAG demo replaces quotes/backslashes and truncates text, which is not
an appropriate general memory-ingestion policy.

## Search and read memories

Start with exact identity or bounded lexical seed retrieval, then expand only
the relationship types and hop range relevant to the task.

```cypher
MATCH (m:Memory {id: 'memory:example-001'}) RETURN properties(m) AS memory;
MATCH (m:Memory) WHERE toLower(m.content) CONTAINS 'graphqlite' RETURN m.id AS id, m.content AS content, m.source AS source ORDER BY m.id LIMIT 20;
MATCH (m:Memory)-[:ABOUT]->(e:Entity {id: 'entity:graphqlite'}) RETURN DISTINCT m.id AS id, m.content AS content ORDER BY id LIMIT 20;
MATCH (m:Memory {id: 'memory:example-001'})-[:RELATED_TO*1..2]-(other:Memory) RETURN DISTINCT other.id AS id, other.content AS content LIMIT 20;
```

Use `STARTS WITH`, `ENDS WITH`, `IN`, equality/range filters, `ORDER BY`, and
`SKIP`/`LIMIT` where appropriate. Use deterministic ordering when paging.
Return stable IDs and provenance alongside content so results can be traced
and deduplicated. Distinguish an empty result from a query failure.

`CONTAINS` is substring matching, not ranked full-text or semantic search.
The GraphRAG example adds `sqlite-vec` and an embedding model for vector seeds,
then traverses `COOCCURS` edges and expands communities. These are additional
dependencies, not built-in `gqlite` semantic-search commands. Its `rag.py` is
a Python demo CLI, separate from the native Cypher shell. Do not copy its
string-interpolated queries for arbitrary memory text.

## SQLite CLI route for parameters and structured results

Both paths are CLI-based Cypher access. `gqlite` provides native Cypher input;
`sqlite3` loads the extension and invokes Cypher through SQL. The latter exposes
features the native shell does not offer: JSON parameter objects, JSON results,
validation, capability inspection, and explicit SQLite transactions.

Example from the repository root after building the macOS extension:

```sh
sqlite3 -bail /absolute/path/memories.db <<'SQL'
.load ./source/graphqlite/build/graphqlite.dylib
SELECT cypher_capabilities();
SELECT cypher_validate('MATCH (m:Memory {id: $id}) RETURN properties(m) AS memory');
SELECT cypher(
  'MATCH (m:Memory {id: $id}) RETURN properties(m) AS memory',
  '{"id":"memory:example-001"}'
);
SQL
```

Use `.so` on Linux and `.dll` on Windows. A quoted heredoc prevents the shell
from expanding `$id`; external values still require proper serialization and
SQL binding/quoting when constructing the SQL request. Never paste arbitrary
memory text into shell commands or query literals.

`cypher()` returns a JSON array for query rows, `[]` for zero matching rows,
or a modification-count object for writes without RETURN. Failures raise
SQLite errors containing structured JSON. `sqlite3 -bail` stops after errors;
use explicit BEGIN/COMMIT if several statements must commit together.
`cypher_rows()` exposes tabular rows and supports SQL composition.
`cypher_validate()` checks syntax and static semantics, not all runtime errors.

The practical decision before skill authoring is whether native `gqlite` alone
is mandatory, or whether the SQLite CLI extension route is allowed. If native
only, the implementation needs tested string serialization, output handling,
failure detection, size handling, and explicit post-write verification.

## Next validation work

With a suitable CLI build available, use a disposable database to check
inspection, create/retry deduplication, relationship creation, exact/lexical/
two-hop reads, empty results, quote/backslash/newline/Unicode round trips,
query errors and exit status, constraint rollback, persistence, and contention.
Then author the introspection, memory-write, and memory-search/read skills
against the chosen CLI contract and agreed memory schema.
