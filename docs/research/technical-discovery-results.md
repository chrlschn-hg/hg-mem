# Technical discovery results

Completed 2026-10-23. Three engineering tracks executed disposable prototypes.
DMTS reviewed temporal fixtures; Senior DBA audited the baseline writer evidence;
the researcher reviewed retrieval interpretation. Later runtime repairs and timing
results are engineer-reported, not independently revalidated by those reviews.
No production schema, skill runtime, or supported writer was selected.

## Findings that guide implementation

| Question | Finding | Practical implication |
| --- | --- | --- |
| SQL, Cypher and search in one runtime? | Official GraphQLite 0.12.0 loads into extension-enabled SQLite alongside FTS5. | A CLI wrapper can combine graph operations and SQL search in one connection. |
| Atomic writes? | Controlled transactions preserved tested graph/search state across mutations, named failures and process kills. | Keep mutation, validation and search maintenance in one transaction; explicitly roll back errors. |
| Are triggers sufficient? | Tested triggers maintained search text while invalid graph states still committed. | Search synchronization and semantic validation are separate responsibilities. |
| Filter before or after ranking? | Global top-k followed by scope filtering lost eligible results; duplicate scope joins crowded out distinct memories. | Apply eligibility before every lossy limit; use membership semantics such as EXISTS. |
| Required instructions through search? | Tag filters and lexical top-k omitted applicable directives in authored fixtures. | Required-directive inventory must be independent of lexical matches; expose overflow. Adherence remains unmeasured. |
| Need copied scope tables? | Direct SQL graph joins met the assumed 10k read budget in the measured block. | No copied scope projection earns inclusion from this evidence. |
| Summary format winner? | Every arm found all 18 positive targets in its top three. | The preregistered improvement gate was unmet; keep expansion experimental. |
| Does a source locator prove support? | The same locator returned changed guidance; formatting-only changes also changed its digest. | Read sources when checking current support. Digests identify byte changes, not truth. |

## Runtime evidence and limits

The final runtime report records 154 heterogeneous checks: 37 committed,
41 rejected, 20 invariant failures, 43 injected failures, two errors, one commit
failure, one busy failure and nine read/diagnostic checks. These are not 154
independent successful writes. The injection matrix covers 42 boundaries,
including eight before mutation; a separate injection is also recorded.

Review exposed a real prototype hole: extra properties could replace the requested
public ID and commit an unindexed node. The engineer preserved the failing case,
added allowlists and a missing-node guard, and exercised regressions. Public-ID
immutability still depends on the sanctioned API; raw bypasses can rename IDs.

```text
# GraphQLite 0.12.0 counterexamples: verify future writer syntax carefully.
SET m += {title:$t}       # Parameters inside map literals became NULL silently.
SET m += $map            # Whole-map parameters worked; null entries were ignored.
SET m.title = $t         # Property-position parameters worked.
# Emit REMOVE explicitly for property deletion.
# Failed cypher() does not abort the surrounding transaction automatically.
# Native gqlite query errors may still return exit status zero.
```

At 10,000 fixture memories, direct SQL FTS-plus-scope joins took about 3.6 ms
warm p95 for the common-term case against an assumed 50 ms budget. The tested
Cypher-composed form took about 355 ms; a host composition was slower still.
These are specific query shapes, not a general verdict on Cypher.
Full-graph validation missed the write budget; touched-memory validation met it
under the provisional invariants. Broader graph changes need their own validation
coverage rather than assuming local checks suffice.

Timing used one block per arm, not the three blocks required for admitting a new
materialization. The narrow scope copy was faster but was not admitted: the
direct SQL baseline already met budget, and copy maintenance coverage was limited.
No power-loss, disk-full or comprehensive arbitrary-writer validation was run.

## Temporal and scope choices remain open

Time fields answer different questions: when recorded, when valid, whether an
instruction is currently retired, and what was believed earlier. The experiments
do not justify a full event log by default.

- Effective-time-only models can answer the tested validity questions with safe
  write policies under the baseline assumptions. Alternative unknown-end policy
  exposes a remaining overclaim; rejecting ambiguous writes is a capability cost.
- Distinguishing expiry from retirement becomes necessary if predecessor revival
  differs between those cases. Historical belief after in-place correction needs
  transition evidence or an unsupported answer.
- Unknown start is not unbounded start; recorded time cannot invent validity.
  Interval boundaries, date-only timezone meaning and revival remain decisions.
- Replacement with identical scope-ID sets is the runtime's provisional contract.
  Broader coverage does not authorize broader applicability. Equality-only and
  coverage-plus-explicit-authorization remain alternatives; narrowing is deferred.
- Missing scope versus explicit global remains unresolved. Symlinks, filesystem
  case and multiple checkouts were not validated.

## Summary retrieval interpretation

The frozen pilot used six agent-authored documents in three opposing pairs,
summary-only indexes and 26 independently authored, summary-blind questions.
All 22 frozen artifact hashes were verified before question release.

All 18 positive targets ranked first or second in every arm, with the contrast
sibling also present in the top three. Generic and keyword sibling payloads were
identical, making their top-one results deterministic ID tie-break outcomes.
Literal preservation improved the rare-identifier subset, but not the negation
or condition subsets. The duplicate literal arms are one treatment, not replication.
No reader-model answer support, instruction adherence or abstention was measured.

The E5 deterministic probes retained distinct public claim IDs sharing a source,
preserved sibling claims during a selected-summary refresh, and resolved stable
IDs after local FTS rowids changed. They demonstrate prototype mechanics, not
production migration guarantees.

A proposed follow-on uses twelve fresh documents, four competing sources per
family and frozen generic-versus-literal summaries with fresh blinded queries.
It has not started. Generated expansion, stemming and fuzzy routes still require
their own workload evidence; vectors remain explicit opt-in only.

## Suggested next implementation boundary

Use the existing init skill and CLI smoke test as the starting point. A proposed
next increment is one controlled CLI writer plus a literal FTS search command,
with graph-backed eligibility and independent directive inventory. Resolve the
minimum scope and lifecycle contract before that writer is presented as supported.
Keep optional fields, relations and search extensions out until a concrete recall
query or experiment earns them inclusion.

## References

- [Algorithm/function follow-up, executed compatibility probes and integration shortlist](graph-algorithms-review.md)
- [Runtime report, transaction probes and physical query measurements](../../discovery/runtime/REPORT.md)
- [Semantics report, temporal alternatives and eligibility counterexamples](../../discovery/semantics/REPORT.md)
- [Retrieval report, frozen baseline and source-state probes](../../discovery/retrieval/REPORT.md)
- [Discovery ownership, coordination and evidence qualifications](technical-discovery.md)
- [Experiment hypotheses and predeclared decision gates](../archive/proposal-experiments.md)
- [GraphQLite parameter-literal counterexample and captured output](../../discovery/runtime/results/counterexamples/param_in_literal_is_null.sql)
- [Initialization skill and CLI smoke-test instructions](../../skill/hg-mem-init/SKILL.md)
