# Schema v1

This release chooses conservative v1 behavior. New managed databases only;
initialization rejects existing unmanaged graph data. No automatic migrations.

```text
# Public id: nonempty opaque text, globally unique across every node label.
# Physical SQLite id: local join/FTS rowid only; never a portable public ID.
(m:Memory:Persona|CAPA|Operational)-[:APPLIES_TO]->(s:Scope)
(m)-[:FILED_UNDER]->(Domain|Area|Topic)
(m)-[:ABOUT]->(Operator)
(new:Memory)-[:SUPERSEDES]->(old:Memory)
(Topic)-[:CHILD_OF]->(Area)-[:CHILD_OF]->(Domain)
```

| Node | Properties / invariants |
| --- | --- |
| Every node | `id`, `name` for context nodes; names are mutable display text |
| Memory | Exactly one purpose label; `title`, `content`, `created_at`, `updated_at`, `asserted_by`, `assertion_kind`, `required`, `status`; optional `source_ref`, `valid_from`, `valid_to` |
| Scope | `kind`: global/project/directory/session; directory requires canonical absolute `root`; exactly one explicit global scope `scope:global` |
| Domain | No parent; zero or more Areas |
| Area | Exactly one Domain parent; zero or more Topics |
| Topic | Exactly one Area parent |
| Operator | Subject identity, separate from claims about that operator |

```text
# Exactly three taxonomy types; populate branches as needed, no placeholders.
# Operational: exactly one FILED_UNDER; Persona/CAPA: zero or one.
# Persona: exactly one ABOUT Operator; other purposes: optional ABOUT Operator.
# Every Memory has >=1 explicit APPLIES_TO. Missing scope is invalid, not global.
# Taxonomy namespace is database-wide. Labels/edges not listed above are unsupported.
# Graph is canonical; hg_fts(title,content) is rebuildable, no source bodies.
# Document memories store a discovery summary + source_ref; no relocation repair.
# No generated keywords, vector extension, algorithm cache, copied scope table.
```

## Authority and time

```text
# required=true preserves an explicit user imperative regardless of purpose label.
# CAPA is corrective/preventive purpose; inferred CAPA stays required=false.
# assertion_kind: explicit|observed|inferred. required implies explicit.
# asserted_by: public Operator id for explicit statements; nonempty agent identity
# for observations/inferences. source_ref should identify the instruction/evidence.
# status: active|retired|retracted. SUPERSEDES is a relationship, not a stored status.
# Canonical times: YYYY-MM-DDTHH:MM:SSZ; UTC seconds; intervals [from,to).
# valid_from absent = unknown -> POSSIBLE. valid_to absent = no declared end.
# Unknown end and explicitly unbounded start are unsupported; do not encode as null.
# Create explicitly activates at write time by default; unknown_start:true omits start.
# Never derive historical validity from created_at in a query.
# Current: active + effective/possibly-effective. Retired is currently inactive.
# Historical valid-time queries use intervals, including retired records.
# Retracted records are excluded as accepted truth; read ID still exposes the record.
```

```text
# edit: title/content/source_ref typo or presentation correction only; meaning unchanged.
# retire: effective now, records end and disposition; future-start retirement rejected.
# retract: withdraw accepted assertion, preserves evidence; no predecessor revival.
# replace: new public ID, same purpose and exact scope-ID set, effective now;
# closes old interval, links new->old. Branching replacement of ended rules rejected.
# No automatic revival, future/partial/scoped replacement, in-place meaning change,
# same-ID reinstatement, or historical-belief reconstruction.
# To reinstate: create a new sourced memory. Surface conflicts; no scope precedence.
```

## Retrieval

```text
# Scope eligibility = explicit global OR supplied project/session IDs OR a canonical
# directory root containing realpath(cwd) at a path boundary. No inferred nesting.
# --scope directory IDs must also contain cwd. Unknown IDs are errors.
# Resolve symlinks using this host's realpath; no cross-machine root mapping.
# Case spelling is not folded; ambiguous case/checkouts require explicit scope review.
# Required inventory: required=true, applicable scope, active/effective or POSSIBLE.
# Inventory ignores lexical terms/purpose/action tags; paginate until exhausted.
# Search: unicode61 remove_diacritics 2, quoted word-prefix OR, BM25, deterministic ID ties.
# Eligibility before LIMIT; exact read exposes historical/retired/retracted evidence.
# navigate: typed bounded paths; returned memories eligible before final LIMIT.
# Ineligible Memory intermediates are excluded too. Filing never grants applicability.
# FTS source hits are candidates, not source-supported answers.
# Search context: actual filing ancestry (Domain -> Area -> Topic when present),
# ABOUT subject, declared scopes with request matches, and direct revision references.
# Explore one typed channel: filing, subject, or revisions. Current filing/subject
# members are eligible before paging. Revisions are separate history, max 3 hops
# each direction; inactive/retracted evidence is never mixed into current results.
# APPLIES_TO scopes are attributes, not related-memory hubs. No per-hit expansion.
```

## References

- [Atomic write preconditions](../../hg-mem-write/references/begin.md)
- [Final graph validation and search maintenance](../../hg-mem-write/references/commit.md)
- [Runtime setup and session loader](runtime.md)
- [GraphQLite typed storage schema](https://colliery-io.github.io/graphqlite/reference/database-schema/)
- [SQLite FTS5 tokenization, ranking and integrity checks](https://sqlite.org/fts5.html)
