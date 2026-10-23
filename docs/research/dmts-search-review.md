# DMTS review: non-vector search over the GraphQLite memory graph

Date: 2026-10-23. Scope: architecture opinion on `docs/search-options.md`, preliminary, no implementation audit. Vector search stays explicit opt-in and is not part of any default below.

## Two decisions that matter more than the tokenizer

1. **Own a rebuildable search projection, written by the one write command, in one SQLite transaction (Option A).** The graph stays canonical; `memory_search(memory_id, kind, title, aliases, content, scope, updated_at, ...)` is derived and can be dropped and rebuilt from the graph at any time. This is what makes every other choice cheap to change: a tokenizer, a second index or an opt-in vector table is a rebuild, not a migration. Triggers over the EAV tables (Option B) are the wrong coupling here: a property lives in one of five typed tables and moves between them when its type changes, keys are indirected through `property_keys`, and GraphQLite documents that direct writes bypass its key cache. A change queue (Option C) is only worth it if writes become batched. Required with A: a `rebuild` command, a `verify` command that compares a hash of the projection with a fresh projection from the graph, and update and delete handling in the same transaction. `cypher()` participates in the current SQLite transaction, so `BEGIN; SELECT cypher(...); INSERT INTO memory_search ...; COMMIT` is a documented pattern, not a proposal.

2. **Pick the runtime that gives SQL and Cypher on one connection.** Native `gqlite` offers `CONTAINS`, `STARTS WITH` and `=~` only, no raw SQL, no `.load`. Two documented routes give both: the Homebrew `sqlite3` (3.53.4, extension loading enabled, FTS5 present, verified by the lead) with `.load` of the release `graphqlite-macos-arm64.dylib` (present in `graphqlite-release.json`), or Python with the `graphqlite` wheel (`graphqlite.load(conn)`) on an interpreter whose `sqlite3` module allows `enable_load_extension` (the mise Python 3.13.16 does; confirm its bundled SQLite has FTS5 before relying on it). My preference is the Python route for skills: parameters, transactions, JSON results and the projection maintenance live in one process, and `cypher_rows()` lets one SQL statement join FTS candidates to Cypher results. The `sqlite3` CLI route is fine for inspection and for a pure-shell skill; it must never be the system `/usr/bin/sqlite3`. One documentation inconsistency to verify before relying on regex: the operators reference says `=~` is PCRE, the SQL interface reference says POSIX ERE.

## Option tiers

| Tier | Component | Default? | Why |
|---|---|---|---|
| 0 | Exact id, normalized name, alias lookup as graph data (`Entity`, `Alias` nodes or an `aliases` list property), equality through the existing `(key_id, value)` indexes | Yes | Highest precision, zero dependencies, carries provenance. Aliases as data beat a synonym tokenizer: curated, inspectable, reversible. |
| 1 | FTS5 `unicode61 remove_diacritics 2` over title, aliases, content with BM25 and column weights (title > aliases > content); a second FTS5 table with `porter unicode61` over the same text | Yes | Built in; literal and stemmed side by side preserve names and identifiers while catching English inflections. Two tables cost nothing at memory-store scale. Prefix queries (`term*`) come free. |
| 2 | FTS5 `trigram` over title, aliases and identifiers only (not full content) | Yes | Substring and CJK fallback (`unicode61` runs CJK ideographs together), and the fuzzy candidate generator: a misspelling shares most trigrams with the right term. Verified locally with `case_sensitive 0`. |
| 3 | Typo correction from the index's own vocabulary: `fts5vocab` (built in, verified) feeds a small `terms` table; candidates by trigram overlap, scored by a bounded edit distance in the host language (Python `difflib` or a 20-line Levenshtein) | Yes, bounded | Answers the spellfix1 question: the vocabulary already exists, the candidate set is tens of rows, scoring needs no extension. |
| 4 | `spellfix1` | No, opt-in | Separate extension (absent from the system CLI, unverified in Homebrew), its own vocabulary table to keep in sync, edit costs tuned for English. Only worth it if tier 3 proves too slow or too weak on real queries. |
| 4 | `sqlean-fuzzy` | No, opt-in | Scalar scoring only, ASCII-only distances, another loadable extension. Use it only if scoring must stay in SQL. |
| 4 | `fts5-snowball`, `simple` | No, corpus-driven | Native third-party tokenizers to build for macOS arm64. Add snowball only when non-English inflection is shown to matter; add `simple` only for Chinese with word segmentation needs, otherwise trigram covers CJK substring. |
| X | `sqlite-tantivy` | No | Companion database file, explicit flush and a patched dependency break the single-file, single-transaction model that makes Option A trustworthy. |
| X | Vector (`sqlite-vec`) | Explicit opt-in only | Keep `memory_id` as the join key in the projection so a `vec0` table can be added later without touching the default path. |

## Retrieval composition and ranking

- Candidate sources run independently and each tags its hits with a `match_reason`: `id`, `alias`, `phrase`, `bm25_literal`, `bm25_stemmed`, `trigram`, `typo:<correction>`. Dedupe by stable memory id, keep the best reason and all provenance.
- Rank by tiers before any fusion: exact and alias hits first, then phrase, then BM25 (fuse the literal and stemmed lists with reciprocal rank fusion, which needs no score normalisation), then trigram and typo candidates. Apply metadata filters (scope, kind, time range) as SQL `WHERE` on projection columns before top-k, and recency or pinned boosts as multipliers after candidate generation, never inside the BM25 call.
- Query expansion is bounded: aliases from the graph (one hop, cap the count) and at most a few typo corrections; log which expansions fired so precision loss is diagnosable.
- Graph expansion is a separate, explicit step after top-k: bounded relationship types and hop range through `cypher_rows()`, returning the path alongside content.

## Prototype gates

1. Coexistence: FTS5 tables and GraphQLite loaded on one connection in both runtimes; insert, update, delete and rollback in one transaction; rebuild equals incremental (hash compare).
2. A synthetic corpus of a few hundred memories covering names, identifiers, inflections, misspellings, phrases, diacritics and a CJK sample; recall@10 and rank of the intended memory per tier and for the fused result; empty-result behaviour.
3. Write overhead per memory add with all default indexes, and index size; both should be negligible at this scale and the numbers should say so.
4. Two concurrent writers against the file database; confirm the projection never diverges from the graph.
5. Only after 1 to 4: decide whether any tier 4 dependency earns its place.

## Uncertainties

- The mise Python's bundled SQLite version is 3.53.1; FTS5 presence there is unverified.
- Homebrew `sqlite3` does not ship `spellfix1` or sqlean; both would be separate loadable builds.
- `fts5vocab` as a correction vocabulary is a documented table, but using it with trigram candidate generation is my proposal, not a documented pattern.
- Third-party tokenizers were not built or tested here.

## References

- [GraphQLite: loading alongside other SQLite extensions, load order and transaction notes](../../source/graphqlite/docs/src/content/docs/how-to/other-extensions.md)
- [GraphQLite SQL interface: `cypher()`, `cypher_rows()`, `cypher_validate()`, transaction behaviour, direct schema access](../../source/graphqlite/docs/src/content/docs/reference/sql-interface.md)
- [GraphQLite database schema: typed EAV property tables and their indexes](../../source/graphqlite/docs/src/content/docs/reference/database-schema.md)
- [GraphQLite storage model: why EAV and its trade-offs](../../source/graphqlite/docs/src/content/docs/explanation/storage-model.md)
- [GraphQLite Cypher operators: string operators and the `=~` regex note](../../source/graphqlite/docs/src/content/docs/reference/cypher-operators.md)
- [GraphQLite CLI guide: bundled extension, no raw SQL](../../source/graphqlite/docs/src/content/docs/how-to/cli.md)
- [Release assets including the macOS arm64 loadable extension](../../graphqlite-release.json)
- [Existing GraphQLite reference for memory skills](graphqlite-reference.md)
- [Expanded search options shortlist under review](search-options.md)
- [SQLite FTS5: tokenizers (`unicode61`, `porter`, `trigram`), BM25, prefix queries, `fts5vocab`, external content](https://sqlite.org/fts5.html)
- [SQLite spellfix1 virtual table](https://sqlite.org/spellfix1.html)
- [SQLite loadable extensions and `OMIT_LOAD_EXTENSION`](https://sqlite.org/loadext.html)
- [sqlean fuzzy: distance and phonetic functions](https://github.com/nalgeon/sqlean/blob/main/docs/fuzzy.md)
- [fts5-snowball tokenizer](https://github.com/abiliojr/fts5-snowball)
- [simple tokenizer for Chinese and Pinyin](https://github.com/wangfenjin/simple)
- [sqlite-tantivy and its documented limitations](https://github.com/russellromney/sqlite-tantivy)
