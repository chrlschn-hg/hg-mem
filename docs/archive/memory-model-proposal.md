# Memory model proposal

Draft for discussion, reviewed with the project DMTS. No schema implemented.
Vector retrieval remains explicit opt-in.

## Node families

| Family | Labels | Purpose |
| --- | --- | --- |
| Memory | `Memory` plus `Persona`, `CAPA`, or `Operational` | A retrievable claim, instruction, or observation |
| Classification | `Domain`, `Area`, `Topic` | Three taxonomy levels; content lives in attached memories |
| Context and subjects | `Scope`, `Operator`, optionally `Project` or `Entity` | Applicability boundaries and the things memories describe |

```text
# Proposed graph shape; not executable Cypher.
(Memory:Persona)-[:ABOUT]->(Operator)
(Memory:Operational)-[:FILED_UNDER]->(Domain | Area | Topic)
(Memory:CAPA)-[:GOVERNS]->(Domain | Area | Topic)
(Memory)-[:APPLIES_TO]->(Scope)
(Memory)-[:RELATED_TO]->(Memory | Entity)

# Filing answers where to find a memory; it does not define authority or scope.
# Operational memories have one canonical filing location.
# Cross-links improve discovery without creating competing hierarchy parents.
# Persona need not be forced into the operational taxonomy.
# CAPAs may be filed there too when useful; GOVERNS adds topical relevance.
```

## Three taxonomy levels

```text
Domain: Software Engineering
  Area: Build and Tooling
    Topic: SQLite Runtime Setup

# Accepted hierarchy: Domain -> Area -> Topic, broadest to most specific.
# Keep exactly three taxonomy types; a Memory is content, not a fourth level.
# Topic has exactly one Area parent; Area exactly one Domain parent.
# No cycles or cross-level parent edges.
# Memory may attach at any of the three levels.
# Topic retrieval includes relevant Area and Domain context.
# Domain retrieval should summarize descendants before loading every memory body.
# Ancestor filing alone does not make a memory apply to every descendant task.
```

Confirmed: exactly three allowed taxonomy levels, populated as needed. A Domain
may exist without Areas, and an Area without Topics. Upper-level memories
do not require placeholder descendants.

Use opaque stable IDs for all nodes. Names, slugs, and display paths can change.
Container slugs are unique within a parent, with Domain names partitioned by the
chosen taxonomy namespace. Decide whether the taxonomy is shared across scopes
or owned by each scope; keep scope applicability independent either way.

## Scope

```text
# Scope is a first-class node; properties describe the boundary.
Scope {id, kind: global|project|directory|session, name, root_uri?}
(Memory)-[:APPLIES_TO]->(Scope)
(Scope)-[:WITHIN]->(Scope)       # Optional explicit nesting.

# A pathname is a locator, not a stable identity.
# Match directory boundaries: /repo/a includes /repo/a/src, not /repo/abc.
# Define canonicalization, symlinks, relative paths, and machine-specific roots.
# A scope may need multiple locators for different checkouts or machines.
# The scope where a claim was observed is not necessarily where it applies.

# Optional derived SQL projection, only if measured queries justify it.
# Direct graph joins are the smaller candidate; graph edges remain canonical.
memory_scope(memory_id, scope_id)
# Filter with EXISTS to avoid duplicate search hits from multiple scopes.
# Scope edits and locator moves invalidate affected search projections.
```

Prefer a node over independent scope strings on every memory. Use derived
properties or join tables for indexed filtering. More-specific scopes can rank
first, but they must not silently erase conflicting broader CAPAs.

## Temporal retrieval (proposal)

| Question | Canonical field | Meaning |
| --- | --- | --- |
| When was this stored? | `created_at` | Recording time |
| When did the event happen? | optional `occurred_at` or event interval | Event time; may precede recording |
| When was the claim or directive applicable? | optional `valid_from`, `valid_to` | Effective time |

```text
# Temporal is an orthogonal retrieval dimension, not a fourth taxonomy level.
# A Temporal label on all dated memories adds little discrimination.
# Store canonical times; derive calendar year/month/date and ISO week buckets.
# Resolve user-facing local dates to explicit timezone-aware query ranges.
# Weeks cross month boundaries and may cross calendar years.
# ISO week keys include the ISO week-year, not just calendar year + week number.
# A memory's recording week differs from its event week and effective interval.

# Default proposal: timestamp fields + indexed search projection + calendar views.
# Alternative when graph-native calendar traversal is useful:
(memory)-[:RECORDED_IN]->(TimeBucket {kind: week, key: 2026-W43})
(memory)-[:OCCURRED_IN]->(TimeBucket {kind: week, key: 2026-W42})
# Bucket keys must include calendar/timezone policy; edges are derived/rebuildable.
# Avoid linking a long-lived CAPA to every week in its active interval.
# Query effective intervals by overlap instead.
```

Calendar buckets organize presentation; they do not replace effective-time
predicates. Preserve unknown or coarse event dates rather than inventing exact
timestamps. Start without full transaction-time history unless historical audit
queries require it. The calendar-node option is open for discussion.

LongMemEval evaluates timestamped-event indexing and time-range query filtering;
it does not establish a need for calendar nodes or a `Temporal` label.

## Persona

```text
# Keep the operator separate from each claim about the operator.
(p:Memory:Persona {attribute: preferred_name, value: Charles})-[:ABOUT]->(Operator)
(new_preference)-[:SUPERSEDES]->(old_preference)

# Distinguish explicit statements from inferred preferences.
# Preserve source evidence and effective dates.
# Treat attributes as potentially multi-valued: nicknames can coexist.
# Only supersede claims that actually contradict each other in the same context.
# Return unresolved conflicts with their sources; latest timestamp alone is insufficient.
```

Nicknames can remain sourced Persona claims while a derived alias lookup makes
them easy to search. Promote aliases to graph entities only when relationships
or disambiguation justify them.

## CAPA

```text
# Keep the event, immediate correction, and preventive rule distinct.
Incident: agent used an unavailable SQLite runtime.
Correction: rerun using the installed compatible runtime.
Prevention: verify extension loading and FTS support before selecting a runtime.
Applies when: initializing or changing the memory runtime.
Verification: capability checks pass and the database survives reopening.

(incident)-[:RESULTED_IN]->(c:Memory:CAPA)
(c)-[:GOVERNS]->(Topic:SQLiteRuntimeSetup)
(c)-[:APPLIES_TO]->(Scope:Project)
(replacement)-[:SUPERSEDES]->(c)

# Optional Incident nodes preserve recurrence evidence; a source reference suffices initially.
# CAPA content: trigger, directive, reason, verification.
# Separate fields versus sections in content remain under review.
# action_kinds is optional metadata, never a required-recall filter.
# Correction completion does not retire the preventive directive.
# Suggested lifecycle: proposed -> active -> superseded|retired.
# User corrections can activate directly; agent-inferred rules remain proposals.
# New task instructions may revise a remembered preference or CAPA.
```

Retrieval proposal: inventory active/effective CAPAs in applicable scopes,
including possibly-applicable records with uncertainty visible. Action tags,
form, and text matches must not silently exclude them. On context overflow,
show headings and page or narrow explicitly. Return conflicts together.
Lifecycle, authority routing, and supersession representation remain open.

## Properties

| Group | Suggested fields |
| --- | --- |
| Core | `id`, `title`, `content`, `created_at`, `updated_at` |
| Provenance | `source_ref`, `asserted_by`, `assertion_kind` (`explicit`, `observed`, `inferred`) |
| Time | Candidate `valid_from`, `valid_to`, event time; unknown/unbounded semantics remain open |
| Search | Optional curated terms/aliases and `language`; generated expansion is experimental |
| Persona | Subject via `ABOUT`; optional `attribute`/`value` only if a query earns them |
| CAPA | Lifecycle representation open; trigger and instruction text; other separate fields optional |

Start with fields needed by actual queries. Keep scope and hierarchy edges
authoritative; derived filter columns are rebuildable. Preserve original evidence
when revising a claim. Review scheduling and generated-keyword fields are not
baseline requirements. In-place edits versus semantic revisions remain to be defined.

## Search and segmentation

Accepted for large external documents: index a summary and retain a document
reference. Do not ingest or full-text-index the document body. Read the document
on demand when the summary identifies it as relevant.

```text
# Document memory: searchable summary + external reference.
title: GraphQLite runtime setup guide
content: Summary of the document's purpose, key guidance, and useful subjects.
source_ref: /path/to/runtime-guide.md

# Search returns the summary and reference.
# Open the referenced document only when more detail is needed.
# If unavailable, report that the reference cannot be opened; do not infer a move.
# Do not search for a new location, track moves, or repair the reference automatically.
# The stored summary can still be returned, marked as having an unavailable source.
```

```text
# One independently useful claim or directive per Memory.
# Exception: a document-discovery summary may cover several source claims.
# Split records whose scope, validity, or update lifecycle differs.
# A CAPA may keep trigger + action + reason together as one coherent instruction.
# Preserve source references; excerpts are optional, not full-document ingestion.
# Link claims derived from the same source when useful.
(summary:Memory)-[:SUMMARIZES]->(source_memory:Memory)
# This optional edge summarizes existing stored memories, not external document bodies.
# An external document summary uses source_ref; no body ingestion is implied.

# Candidate literal FTS core; final fields/weights remain to be selected:
title | content
# Curated terms, generated keywords/questions, and a separate trigger field
# are experiment arms, not required canonical properties.
# Generated expansion is a recall aid, not factual evidence.
# Keep stable identifiers out of aggressive stemming and fuzzy rewriting.
# Exact filters: kind, status, subject, effective time, applicable scopes.
# FTS supplies candidates; Cypher supplies taxonomy, provenance, and neighbors.
# Deduplicate final hits by memory ID and retain match reasons and source IDs.
```

## Retrieval contract

```text
# Start a task:
resolve operator + directory/project/session scopes
load applicable active CAPAs and task-relevant Persona
identify likely Domain/Area/Topic from task + exact aliases + search
retrieve atomic memories with ancestor context
expand selected relationships within an explicit budget
return provenance, applicable scope, validity, and conflicts

# Before a relevant action:
inventory applicable active/effective CAPAs without form/action/text exclusion
retain possible candidates with uncertainty; handle overflow explicitly

# Search broadens in explicit steps:
current topic -> area/domain context -> same-scope cross-links
# Broader scopes are consulted explicitly; filing is never an access boundary.
```

GraphQLite documents node uniqueness/non-null constraints, but not relationship
cardinality constraints. Validate hierarchy, filing, scope, and supersession
invariants in write commands as well as a separate verify command.

## References

- [Current search alternatives and DMTS synthesis](../research/search-options.md)
- [GraphQLite node labels, directed edges, and typed property storage](../../source/graphqlite/docs/src/content/docs/reference/database-schema.md)
- [GraphQLite schema constraints and their limitations](../../source/graphqlite/docs/src/content/docs/reference/cypher-clauses.md)
- [GraphQLite entity and traversal functions](../../source/graphqlite/docs/src/content/docs/reference/cypher-functions.md)
- [Parameterized SQL/Cypher composition](../../source/graphqlite/docs/src/content/docs/reference/sql-interface.md)
- [LongMemEval time-aware retrieval and event indexing, Section 5.4 and Appendix D](https://arxiv.org/html/2410.10813v2)
- [SQLite date functions, ISO week-year, and calendar formatting](https://www.sqlite.org/lang_datefunc.html)
- [Second-review findings and unresolved model choices](proposal-challenge-review.md)
- [Proposed validation and retrieval experiments](proposal-experiments.md)
