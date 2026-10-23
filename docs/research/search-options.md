# Search options

Status: expanded shortlist reviewed by the dedicated Paseo agent
`DMTS: hg-mem search architecture` (`a7b7a819-c7ec-485a-ab31-5f7932449e03`),
with preliminary input from another project's DMTS. No search schema implemented.

```text
# Constraint: no vector index, embedding model, or vector dependency by default.
# Vector search requires explicit opt-in; lexical and graph retrieval work alone.
```

## Candidate paths

| Path | Use | Tradeoff |
| --- | --- | --- |
| Exact IDs, normalized names, alias tables/graph edges | Entity lookup, acronyms, product names, terminology | Requires explicit alias curation or extraction; preserve provenance |
| FTS5 `unicode61` | Keywords, phrases, prefix and proximity queries | Tokenization must suit the corpus; no typo correction |
| FTS5 `porter unicode61` | English inflections | Can conflate terms; preserve an unstemmed path for names and identifiers |
| FTS5 `trigram` | Substrings, partial identifiers | Additional index space; not an edit-distance matcher; short queries need another path |
| `spellfix1` | Vocabulary-level typo suggestions | Separate extension and vocabulary; evaluate correction quality before making it default |
| `sqlean-fuzzy` | Edit distance and phonetic scoring of bounded candidates | Scalar scoring is not an inverted index; documented distance functions are ASCII-only |
| Alias/synonym query expansion | Alternate terms without embeddings | Bound expansion; broad synonyms can reduce precision |
| FTS5 custom synonym tokenizer | Consistent index/query synonym handling | Native extension maintenance and prefix/phrase behavior require validation |
| `fts5-snowball` | Language-specific stemming beyond English | Third-party native extension; stemming is not word segmentation or language detection |
| `simple` tokenizer | Chinese/Pinyin, optional jieba segmentation | Language-specific dependency and dictionary/configuration management |
| `sqlite-tantivy` | Alternative engine with documented fuzzy syntax and BM25 | Explicit flush, companion database, query/index stemming asymmetry, and patched dependency; prototype only |

## Retrieval composition

```text
# Proposed independent candidate sources; no single source must gate every query.
query
  → exact ID / normalized entity / aliases
  → literal and stemmed FTS
  → optional substring candidates
  → optional typo-expanded terms / fuzzy entity candidates
  → deduplicate by stable memory ID
  → rank and retain candidate provenance
  → bounded Cypher traversal of selected relationship types
  → return content, provenance, match reason, and graph path

# A misspelling may have zero literal FTS hits.
# Generate fuzzy candidates from vocabulary/aliases, not just literal FTS hits.
# Apply scope and metadata filters before the final top-k selection.
# Compare rank fusion with simple exact > lexical > fuzzy tiers on real queries.
```

## Index ownership

```text
# Preserve graph nodes/properties as canonical data.
# Maintain a rebuildable search projection keyed by stable memory ID.

# Option A: controlled write command, one SQLite transaction.
BEGIN
  Cypher mutation
  update search projection / indexes
COMMIT

# Option B: triggers over graph storage maintain the projection.
# Covers other writers but couples synchronization to the EAV schema.

# Option C: dirty IDs / change queue, then incremental index refresh.
# Allows batching; requires an explicit freshness contract and recovery checks.

# All options need backfill, update/delete handling, rebuild, and drift checks.
# External-content FTS does not automatically index its source table or view.
```

## CLI feasibility

```sh
# Checked locally: system SQLite 3.54.0 disables loadable extensions.
/usr/bin/sqlite3 :memory: \
  "SELECT sqlite_compileoption_used('OMIT_LOAD_EXTENSION');"
# 1

# Checked locally: Homebrew SQLite 3.53.4 permits extension loading and has FTS5.
/opt/homebrew/opt/sqlite/bin/sqlite3 :memory: \
  "SELECT sqlite_compileoption_used('OMIT_LOAD_EXTENSION'), sqlite_compileoption_used('ENABLE_FTS5');"
# 0|1

# Proposed operational CLI; requires obtaining the GraphQLite shared library.
# Use SQL for search and SELECT cypher(..., params_json) for graph operations.
# Native gqlite has no raw SQL or .load command.
```

## Prototype gates

```text
# Compare literal-only vs stemmed vs aliases vs typo handling on the same corpus.
# Include exact names, identifiers, inflections, misspellings, phrases, and empty results.
# Add representative multilingual queries if those languages are in scope.
# Measure recall@k, ranking quality, latency, index size, and write overhead.
# Verify update/delete visibility, rollback, concurrent writers, and index rebuilds.
# Test real GraphQLite + extension coexistence before claiming integration support.
```

## DMTS review outcome

| Question | Preliminary reviewer | Project DMTS | Lead synthesis |
| --- | --- | --- | --- |
| Write ownership | One SQL-capable command updates graph and projection transactionally | Triggers preserve native `gqlite` writes | Keep both options open; prototype native write/update/delete consistency before choosing |
| Default indexes | Literal + Porter + short-field trigram | One literal index + vocabulary; others evidence-driven | Start evaluation with one literal index; compare added recall against storage/write cost |
| Typos | Bounded host-language correction | LLM composes vocabulary, prefix, and substring primitives | Agent reformulation is useful but does not guarantee typo recall; deterministic correction remains a separate option |
| Runtime | Prefer Python + GraphQLite wheel | Preserve CLI; interpreter pinning is required for Python | Explicit Homebrew SQLite is the available SQL CLI; native `gqlite` remains a possible writer |

```text
# Shared ground: graph canonical; projection rebuildable; stable memory IDs;
# provenance and match reasons; bounded traversal; vectors explicit opt-in only.

# Trigger feasibility: project DMTS reports native gqlite links system SQLite
# with FTS5, so preinstalled FTS tables/triggers can run during native writes.
# Actual GraphQLite + trigger coexistence still needs a disposable-database gate.

# Verified by lead in Homebrew SQLite 3.53.4:
# INSERT OR REPLACE on a normal table fires INSERT, not DELETE triggers,
# when recursive_triggers is OFF. Do not rely on implicit-delete notifications.
# contentless_delete=1 DOES support clean INSERT OR REPLACE by rowid.
# Plain duplicate INSERT is different; traditional contentless is different.
# A content-bearing index remains a simpler candidate for snippets/readback.

# Trigger coverage must include every input to the projection:
# label changes, selected properties and type changes, aliases/list/edge changes,
# memory deletion, and metadata. Removing content must not lose searchable titles.
# An FTS phrase match is token-based; use equality for exact identifiers.
```

The project DMTS favors keeping the LLM as the query-expansion host rather than
installing a fuzzy extension immediately. This is a workflow proposal, not a
measured replacement for stemming or spelling correction. Its simple FTS5
baseline and native-writer trigger option expand the choices; neither is final.

## References

- [GraphQLite extension composition and loading order](../../source/graphqlite/docs/src/content/docs/how-to/other-extensions.md)
- [Cypher SQL functions, parameters, and result rows](../../source/graphqlite/docs/src/content/docs/reference/sql-interface.md)
- [GraphQLite EAV tables and physical indexes](../../source/graphqlite/docs/src/content/docs/reference/database-schema.md)
- [Native CLI command handling](../../source/graphqlite/src/main.c)
- [FTS5 tokenizers, ranking, synchronization, and synonym API](https://sqlite.org/fts5.html)
- [Spellfix1 vocabulary lookup and edit costs](https://sqlite.org/spellfix1.html)
- [Sqlean fuzzy distances and phonetic functions](https://github.com/nalgeon/sqlean/blob/main/docs/fuzzy.md)
- [Snowball tokenizer language configuration and build requirements](https://github.com/abiliojr/fts5-snowball)
- [Simple Chinese/Pinyin tokenizer and jieba integration](https://github.com/wangfenjin/simple)
- [SQLite Tantivy usage and documented limitations](https://github.com/russellromney/sqlite-tantivy)
- [Preliminary DMTS opinion from the earlier consultation](dmts-search-review.md)
- [SQLite REPLACE behavior and delete-trigger conditions](https://sqlite.org/lang_conflict.html)
