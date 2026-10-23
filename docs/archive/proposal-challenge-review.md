# Proposal challenge review

Second review requested by the user. Final DMTS and Senior DBA recommendations
and the researcher's final critique/evidence audit received; experiments consolidated. No proposed
schema changes have been accepted or implemented in this pass.

Binding decisions remain Domain -> Area -> Topic, summary-only indexing of large
external documents, no relocation tracking/repair, and vectors only by opt-in.

## Initial findings

| Concern | Type | Review question |
| --- | --- | --- |
| CAPA action-tag filtering conflicts with load-all/visible-overflow policy | Draft inconsistency | Can untagged or differently tagged applicable directives disappear? |
| Status, supersession edges, and effective dates can disagree | Model decision | Which state is canonical, and what is derived? |
| Generic core status has no defined meaning for ordinary facts | Draft ambiguity | Is lifecycle restricted to directives, or consistently defined for all memories? |
| Mutable content vs preserved revision history is unresolved | Model decision | Can harmless edits be distinguished from changes of meaning? |
| Deferred generated keywords and review scheduling remain in the property list | Draft inconsistency | Which fields are baseline, optional experiments, or deferred? |
| Taxonomy parent edge is unnamed | Draft omission | Can peers write the same simple traversal without guessing? |
| Missing applicability scope has undefined meaning | Model decision | Is it global, unscoped, or invalid, particularly for CAPAs? |
| Scope nesting appears as both explicit edges and path containment | Model decision | Which representation is authoritative, and when is a second one derived? |
| Several relationship types may overlap | Simplification hypothesis | Do GOVERNS, FILED_UNDER, ABOUT, RELATED_TO, and derivation edges earn distinct queries? |

## Questions sent back to the team

```text
# Do not choose a simpler representation without testing its counterexamples.
# A preference can influence behavior without being a mandatory CAPA.
# A writer's classification alone does not confer authority on inferred text.
# An inbound SUPERSEDES edge may be future-dated or limited to one scope.
# Do not suppress an older claim globally if it remains applicable elsewhere.
# Retirement without a replacement needs a defined representation.
```

DMTS is reconsidering its five-value `form` facet, including a possible simpler
behavioral distinction. This remains a hypothesis, not a replacement for Persona
or CAPA semantics.

## Senior DBA interim

- Logical graph validity and index freshness are separate obligations. Triggers
  can maintain FTS while direct writers still create invalid taxonomy parents,
  missing scopes, or invalid supersession. A controlled CLI writer with
  transactional validation is now the DBA/DMTS preferred candidate, not a decision.
- A smaller search candidate uses one content-bearing literal FTS table keyed
  by internal node ID. Public IDs and applicable scopes can be resolved from the
  authoritative graph. Add a separate scope/filter projection only if measured
  query plans and timing justify its synchronization cost.
- GraphQLite Cypher `CREATE INDEX` records metadata; it does not create a new
  physical SQLite index or guarantee a better query plan. Base physical indexing
  decisions on the actual EAV queries and `EXPLAIN QUERY PLAN`.
- Historical retrieval must not discard a formerly effective claim solely
  because its current disposition is superseded or retired. Future replacements,
  expiry, retirement, retraction, and reinstatement need explicit query semantics.
- Deferring scope-limited replacement means rejecting unsupported partial
  replacements clearly; it must not mean treating them as global replacement.

No experiments or implementation were performed by the DBA in this pass.

## Researcher interim

- Summary-only indexing has a discovery limit: names, identifiers, exceptions,
  negations, or conditions absent from every indexed summary cannot help lexical
  candidate generation. Opening a file after selecting it does not recover a
  source that was never selected. This is a measurable limitation within the
  accepted summary-only design, not a proposal to index document bodies.
- A source reference locates a document but does not establish that its current
  contents still support the summary. Distinguish candidate-summary hits from
  source-verified answers. Prefer reporting evidence availability at read time
  before adding persistent freshness fields or historical digests.
- LongMemEval and doc2query retain original values/documents in their tested
  designs. Neither directly validates summary-only document FTS. Evaluate our
  design separately rather than transferring their gains or expansion failures.
- A fair summary experiment freezes summaries before evaluation questions are
  exposed and holds indexed-text budget constant. Compare generic summaries with
  summaries retaining literal entities/identifiers, exceptions, and conditions.
  Optional predicted-question expansion is another hypothesis, not a proven winner.
- Measure document discovery separately from answer quality after source reads:
  intended-source recall, wrong-source candidates, source-read count, and
  unsupported answers, including rare-term and polarity/condition cases.

No experiments were run by the researcher in this pass.

## DMTS final: proposals and withdrawals

- Withdraw `form` (and its proposed binary replacement) as the deciding filter
  for required behavioral recall. Fine-grained form can remain an optional tag.
- Prefer a controlled, validating CLI command as the sanctioned writer. Triggers
  are optional index-maintenance insurance, not proof that graph invariants hold.
- Required CAPA recall should use explicit CAPA membership, applicable scope and
  active/effective state, with an inventory/paging policy on overflow. Form and
  action kinds must not silently filter out applicable CAPAs.
- Propose deriving supersession from replacement relationships and effective
  dates rather than separately storing a contradictory superseded status.
  Future replacements must leave the old instruction effective until activation.
- Propose simplifying relationship inventory: remove GOVERNS if filing supplies
  the topical link, use one derivation relationship where typed derivation is
  unnecessary, and defer generic RELATED_TO until a concrete traversal earns it.
- Correct documentation inconsistencies separately from choosing these models.

Unresolved after team exchange:

1. Whether to represent retraction now or choose it after a temporal truth-table
   experiment. Retraction of an erroneous assertion is different from a claim
   that was valid and later stopped being valid.
2. Where proactive standing instructions live. A user obligation must not vanish
   from required recall because it was labeled Persona rather than CAPA. Widening
   CAPA versus a separate explicit-instruction mechanism remains open.
3. How timed expiry differs from deliberate retirement, and whether either can
   revive an older instruction. Choose semantics using counterexamples first.
4. Summary-only discovery and faithfulness limits, measured within the accepted
   design rather than treated as grounds to index full documents.

## Opportunities for experiments

- Before writing a correction, look for an existing applicable CAPA to reduce
  duplicates and identify recurrence. A text match alone does not prove that an
  existing rule applied or failed; compare scope, trigger, effective time, and behavior.
- An optional source digest and summary timestamp could identify an in-place
  document change on the next source read. This is distinct from tracking moves;
  it is not yet a baseline requirement.
- Compare alternative form/lifecycle representations on ambiguous behavioral
  memories and scope-limited/future revisions before selecting one.

Nine experiment candidates, fixtures, metrics, and decision rules are now
recorded in [the experiment proposal](proposal-experiments.md). None were run.

## Senior DBA final additions

- Eligibility must precede every lossy candidate limit, not just the final top-k.
  Out-of-scope global top hits can otherwise hide eligible records. Test each
  exact/alias/FTS route; deduplicate multi-scope hits by public memory identity.
- Keep explicit global scope distinct from missing scope. Directory membership,
  uncertain paths, and broader-scope lookup need an explicit contract.
- A single literal content-bearing FTS table and authoritative graph joins are
  the smaller candidate. Copied metadata and scope tables require evidence from
  inner query plans and timings, not assumptions about performance.
- Internal node IDs are suitable local FTS rowids, not portable identity. Public
  IDs survive import/recreation; rebuilding FTS is part of that transition.
  Source references are not unique identity and must not merge distinct claims.
- Compare FTS integrity separately from graph-to-FTS agreement. A self-consistent
  index can still represent stale graph content.
- DBA D1/D2/D3/D5 refine E7/E1/E3/E5 respectively; D4 becomes the separate E9
  physical plan/timing experiment. This avoids duplicating the semantic fixtures.

## Temporal and instruction amendments

- Unknown start is not an explicitly unbounded start. A proposed minimal encoding
  uses an absent start for unknown and a timestamp for known; beginningless
  validity would need an explicit separate representation if a real query needs it.
- A missing end needs a declared policy. The team's candidate is no declared end,
  not a claim of proven eternal validity. Unknown-end handling remains a separate
  semantic choice. Do not backfill an unknown start from created_at.
- Retrieval distinguishes known applicable from possibly applicable. Preserve
  possibly-applicable CAPAs in the inventory with uncertainty visible.
- Retirement with a known end must preserve prior valid-time answers. Retirement
  without an end leaves precise historical applicability unresolved. Retraction
  distinguishes accepted truth from what was asserted; a current status cannot
  reconstruct every prior belief transition.
- Instruction preservation is the invariant under either label encoding.
  Explicit imperative meaning and provenance both matter; a user-stated fact is
  not automatically a directive and an inferred preference is not an obligation.
- Scope-relative replacement semantics remain proposed; unsupported partial
  replacement must be rejected before any graph mutation.

## Summary faithfulness audit

The researcher checked FABLES, a study of book-length summaries using older
models. It documents unsupported, partially supported, unverifiable, and omitted
content; those are distinct outcomes, not all hallucinations. Its fiction corpus
and model versions do not establish error rates for our technical documents.

The agreed design implication is a result-time distinction, not a new confidence
field: generated summary, source opened, and answer supported by that source.
Opening a source alone does not verify a summary. Record generation provenance
through the summarizer identity; do not automatically classify a faithful summary
of explicit source statements as logically inferred.

Doc2query appends predicted questions to original documents, so it motivates an
optional experiment rather than validating our summary-only design. LongMemEval
Table 10 also cautions that extra representations and rank merging can hurt in
its evaluated setup; it does not decide our weighted FTS or typo-route design.
The researcher's Q1/Q2 now replace the original E4 fixture as E4a/E4b; Q3 replaces
the original E5 fixture. The DBA identity extension remains attached to E5.

The proposal draft's stale wording has been reconciled with these review
alternatives: no action-tag gating of required CAPA recall, no mandatory generated
keyword or review-scheduling fields, no movement inference, a document-summary
exception to single-claim segmentation, and explicit separation of stored-memory
summaries from external-document references. These are consistency edits, not
selection of the remaining lifecycle, scope, label, or writer designs.

## References

- [Memory model under review](memory-model-proposal.md)
- [Academic evidence and limits](../research/memory-facets-research.md)
- [Search and index-consistency alternatives](../research/search-options.md)
- [Nine consolidated experiments and decision criteria](proposal-experiments.md)
- [GraphQLite Cypher index and constraint behavior](../../source/graphqlite/docs/src/content/docs/reference/cypher-clauses.md)
- [GraphQLite schema-object executor](../../source/graphqlite/src/backend/executor/executor_schema_objects.c)
- [FABLES: faithfulness and content-selection audit, Table 2 and Section 5](https://arxiv.org/html/2404.01261v2)
- [Doc2query: document expansion procedure, Section 3](https://arxiv.org/pdf/1904.08375)
- [LongMemEval v2: rank-merging comparison, Appendix E.3 and Table 10](https://arxiv.org/html/2410.10813v2)
- [SQLite index-prefix and range constraints](https://sqlite.org/optoverview.html)
