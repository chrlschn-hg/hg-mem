# Memory exploration

Search locates a starting point. Explicit typed paths provide the next steps.

| Path | Default result context | Next step |
| --- | --- | --- |
| `Memory → FILED_UNDER → Topic → CHILD_OF → Area → CHILD_OF → Domain` | Named breadcrumb, displayed Domain → Area → Topic at its actual depth | Choose a breadcrumb to browse eligible memories filed there or below it |
| `Memory → ABOUT → Operator` | Named subject | Browse eligible memories about that subject; this differs from who asserted them |
| `Memory → APPLIES_TO → Scope` | Declared scopes and which matched the request | Explain applicability; do not use shared scope as a relatedness hub |
| `new Memory → SUPERSEDES → old Memory` | Direct replacement links, status and dates | Explicit revision-history channel, up to three steps in each direction |

Filing may terminate at Domain, Area or Topic. Empty branches do not require placeholders.
The taxonomy is global organizational context; it never grants applicability.

## Search → explore → read

1. Search with the ordinary eligibility and word-prefix recipe.
2. Inspect the hit's filing breadcrumb, subject, scopes and direct revision references.
3. Choose one exploration channel: filing, subject, or revisions.
4. Read a related memory or reseed at an ancestor/subject; retain the original search.
5. Read the source when an answer needs source support. A graph connection is context, not evidence of truth.

No related-memory lists are automatically expanded for every hit. Current filing/subject
channels apply scope, status and time eligibility before paging. Revision references are
historical evidence, including inactive or retracted records; they never share a current-result count.
Required-instruction inventory remains independent of lexical and graph exploration.

## Agent interfaces

The text-only recall skill exposes the same `explore.md` recipe through SQLite CLI.
Requests identify a public seed ID and one relation, with explicit context and paging.
The maintained recipe is preferable for routine exploration; `cypher.md` documents
tested, bound-parameter Cypher for inspecting and reproducing the standard paths.

Always type relationships and bound hops. Return explicit public IDs and named steps.
Raw Cypher does not inherit eligibility: current-memory queries must apply it before
`LIMIT`. Do not walk global scopes or use whole-graph centrality to invent relevance.

## Limits

This adds derived result context and read-only navigation, without changing graph schema,
FTS ranking or memory authority. Taxonomy subtrees have at most two `CHILD_OF` steps.
Revision exploration is bounded rather than an unlimited audit log. Exact historical belief
reconstruction remains unsupported. Full taxonomy-tree counts and graph visualization are deferred.

## Verification

The backend has 44 passing checks across the store, exploration and raw-search parity suites.
These include a three-level breadcrumb, ABOUT versus asserted_by, eligibility before paging,
direct revision context, and a seven-version chain with six paged history references.
The installed text-only explore recipe was also compared with the live plugin RPC on the
demo store: the complete JSON pages matched (`discovery/plugin-v1/explore-installed-skill-parity.json`).
All 28 installed skill assets pass the installer checks; eight Cypher recipes were exercised
against a disposable fixture. UI typecheck passes. The desktop browser round trip from
search → filing node → memory → exploration → results preserves the query.

Graph visualization is being evaluated separately in `discovery/graph-viewer-spike/`;
that spike does not change the maintained search/exploration contract.
