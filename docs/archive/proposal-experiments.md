# Proposal experiments

Second-review experiment candidates from DMTS, the topical researcher and Senior
DBA, with lead qualifications. The user has authorized technical-discovery
execution in disposable track directories; no production design is selected.
Small fixtures screen designs; passing them does not prove general recall or
correctness. Choose quality thresholds before running and report absolute counts.

Binding constraints: summary-only indexing of large external documents; no body
indexes or vectors; no relocation tracking. Originals may be opened to establish
gold answers and assess summaries. Freeze summaries before exposing test queries.

## E1: Required directive coverage

- Hypothesis: loading the applicable CAPA inventory preserves every required
  directive, including untagged records, under a bounded context budget.
- Fixture: 30 directives, including 10 untagged and five global; 15 scenarios
  with hand-labeled applicability, effective-time uncertainty, and conflicts.
  Force three scenarios to overflow.
- Compare: inventory plus headings/paging; action-tag filtering; lexical top-k.
- Observe: applicable and possibly-applicable directive coverage, tokens,
  overflow visibility, and actual instruction adherence as separate outcomes.
- Decision: no known-applicable directive may disappear on the fixture. A heading
  is not proof that its full conditions were read. If headings lose adherence,
  require paging or explicit narrowing; do not silently filter. Conflicting
  instructions require a conflict result rather than impossible joint adherence.

DBA eligibility extension:

```text
# Three lexical hits: top two out of scope, global rank three eligible.
# Also: one memory in two applicable scopes; one untagged CAPA with no term hit.
# Directory fixture: /repo/a includes /repo/a/src, excludes /repo/abc.
# Compare global LIMIT-then-filter against eligibility before each route's LIMIT.
# Cover exact, alias and FTS routes, plus independent CAPA inventory.
# Pass: all intended eligible records, no duplicates or sibling leakage.
# Distinguish missing scope from explicit global scope.
# Increasing k is not a correctness fix for eligibility applied too late.
```

## E2: Instruction preservation

- Hypothesis: an explicit user instruction survives authoring and retrieval
  under either purpose labels or a form-based encoding.
- Fixture: 40 statements including corrections, proactive instructions, explicit
  preferences, inferred preferences, ordinary facts, and ambiguous wording.
  Two independent writer runs; human key with unresolved cases marked separately.
- Compare: Persona/CAPA/Operational purpose routing against proposed form or
  behavioral encodings.
- Observe: critical omissions, inferred preferences promoted to obligations,
  inter-run agreement, and retrieved source/meaning.
- Decision: any omission on the ten explicit-instruction cases rejects that
  routing policy. Explicit source provenance alone does not make a fact an
  imperative. Keep the encoding open; do not fix failures by assuming one label
  is intrinsically authoritative.

## E3: Temporal and revision oracle

- Hypothesis: a small explicit revision model answers current, historical-valid,
  and assertion-history queries without silently restoring or suppressing rules.
- Fixture: at least 12 cases covering future starts, expiry, retirement,
  retraction, mistaken assertions, unknown start, unknown end, and explicitly
  unbounded time. Include a scope-limited replacement as a supported-or-rejected
  operation, not an implicit global replacement.
- Compare: status-only, edge/effective-time semantics, and an end-reason model.
  Include a no-automatic-revival candidate; do not assume any replacement ending
  automatically restores its predecessor.
- Observe: answers against an operator-labeled truth table, separately for
  current applicability, past validity, and what was asserted. Unknown must stay
  distinct from false and from unbounded.
- Decision: reject any model that returns an instruction the oracle says should
  not guide action, or confidently reconstructs unknown history. Add state only
  when a failing case needs it. If partial replacement is unsupported, reject it
  before mutation and preserve the prior state.

## E4: Summary-only discovery

E4a replaces the original DMTS fixture with researcher Q1:

- Hypothesis: a bounded summary preserving identifiers, restrictions and
  conditions improves discovery without distorting claims.
- Fixture: six 800-1,200-word documents in three near-duplicate pairs. Each pair
  differs in a rare identifier, negated rule, or conditional exception; place the
  distinguishing content at beginning/middle/end. Twelve independently authored
  queries plus two false-premise questions, hidden from the summarizer.
- Compare: a generic 150-word overview against an equal-budget literal-preserving
  summary, with the same literal index, title, scope and filing.
- Observe: source Recall@3 by category, source-supported answer accuracy, and
  condition/negation reversals. Audit supported/partly-supported/unsupported/
  unverifiable claims separately, with source checks and human adjudication.
- Decision: recover a pre-registered miss without a new critical miss or reversal
  before expanding the trial. Revise the brief/budget or retain the simpler arm
  if it fails. Do not add body indexing or assume more links solve omitted evidence.

E4b incorporates researcher Q2 without adding a duplicate experiment family:

- Hypothesis: optional keywords/questions recover vocabulary mismatch beyond
  source-literal summary terms.
- Fixture: E4a documents plus six independent paraphrase and six near-miss/
  false-premise queries.
- Compare: frozen 120-word core plus 30 words of source-literal terms, generated
  keywords, or predicted questions; freeze any separate FTS weighting first.
- Observe: Recall@3, irrelevant sources, unsupported generated cues, and losses
  on critical conditions, at the same budget.
- Decision: advance an arm only if it recovers a pre-registered miss without new
  critical losses or unsupported cues, then validate on more sources. Failure
  leaves generated expansion absent by default. Query-aware text produced after
  source selection is a reading aid, not evidence of improved initial discovery.

## E5: Source change and evidence state

Researcher Q3 replaces the original DMTS source-state fixture:

- Hypothesis: reading and checking the source prevents unsupported current
  answers while preserving useful navigation.
- Fixture: one known candidate summary; source V1, same-reference V2 reversing a
  condition, formatting-only revision, and inaccessible state. Ask both what
  applies now and what the stored summary says.
- Compare: summary-only answers against source-read-and-check answers; optional
  stored-digest comparison on the latter. No source version is search-indexed.
- Observe: current claims contradicted by source, qualification on unavailable
  support, correct supported answers, source-read cost, and unnecessary refresh
  prompts after formatting-only changes.
- Decision: zero unqualified contradicted current claims on the fixture; no
  movement claims. Tighten the answer/check contract or abstain on unsupported
  detail if it fails. If summary-only answers pass a narrow question class,
  record that class rather than claiming source reads are always necessary.
  A digest proves byte change, not semantic staleness or faithfulness; omit it
  if it adds no useful decision beyond reading. Neither arm repairs paths.
- Preserve generation provenance separately from logical inference: a summary is
  generated, but can faithfully paraphrase explicitly asserted source material.
  No numerical trust discount or persistent confidence field is assumed.

DBA identity extension: two claims may share a source reference. Edit source
bytes in place, rename a taxonomy node/alias, and refresh one summary. Public IDs
and graph links must remain stable, with no unintended merging or sibling-claim
rewrite. After export/recreation, rebuild FTS and verify the same public IDs
resolve even if local numeric rowids differ. Source paths are not unique identity.

## E6: Relationship simplification

- Hypothesis: fewer relationship types preserve required traversals.
- Fixture: the 20 labeled recall queries and E1 pre-action scenarios; include
  source derivation, summaries, taxonomy ancestors, subjects and scope.
- Compare: current GOVERNS/RELATED_TO/SUMMARIZES/RESULTED_IN alternatives against
  a reduced relation set with an explicit derivation direction.
- Observe: intended-memory and directive coverage, source-context retrieval,
  query complexity, and whether peers can express each traversal consistently.
- Decision: remove a relation only if the fixture loses no required meaning or
  result. If merging relations requires adding equivalent type properties or
  extra interpretation rules, count that complexity too.

## E7: Write validation and atomic search maintenance

- Hypothesis: a controlled CLI writer validates graph invariants and updates
  search state atomically using one connection and transaction.
- Fixture: disposable database; create/update/delete, invalid parent/scope and
  revision operations, failed writes, label/type changes, and interleaved native
  writes. Record graph and FTS state before/after failed operations.
- Include same-type SET, type changes, NULL/removal, map replacement, label and
  alias add/remove, scope-edge changes, invalid IDs/types, and rejected partial
  replacements. Give each searchable state distinct old/new marker terms.
- Compare: controlled writer; native writes with proposed triggers; verify-only
  detection. Run in the actual intended SQLite/GraphQLite runtime.
- Observe: invariant violations, search drift, rollback completeness, and
  concurrent-write results. Include failed verification and query-error handling.
- Decision: zero invalid or partially committed sanctioned operations on the
  fixture. Verification must find invalid states or drift; it cannot identify
  writer origin when an external write leaves indistinguishable valid data.
  Actual writer-origin detection would require a separate audit/enforcement
  design. Trigger maintenance does not solve transaction failure or invariant
  validation by itself; fix the writer contract first.
- Compare complete canonical projection rows and old/new search results against
  a fresh rebuild after every committed transition. FTS internal integrity and
  graph-to-index agreement are separate checks. Failed commands must change neither.

## E8: Optional form usefulness

- Hypothesis: form metadata improves recall/ranking enough to justify storing it.
- Fixture: 20 labeled queries with ambiguous/multi-form memories and two writer
  annotations; reuse E2 instruction cases.
- Compare: no form, form as a boost, form as a filter.
- Observe: Recall@5, intended-memory rank, annotation agreement, authoring effort,
  and lost intended records.
- Decision: retain only demonstrated benefit; remove a default filter if it
  drops intended records. Required CAPA recall and authority never depend on form.

## E9: Physical query plans and performance

- Hypothesis: existing graph indexes plus one literal FTS index meet the workload
  without copied scope/subject/status/time columns.
- Fixture: 64 memories across four scopes, sparse/dense membership, 1-3 scopes
  per memory, rare/common terms, and active/inactive directives. Scale the same
  distribution to 1,000 and 10,000, including skewed-scope cases.
- Compare: eligible FTS top-k with graph joins; independent CAPA inventory;
  equivalent label/property filters; recorded-time ranges and valid-time interval
  overlap. Change one physical index or narrow projection at a time.
- Observe: inner generated SQL, EXPLAIN QUERY PLAN, scanned/visited rows where
  available, warm/reopened p50/p95 timings, result equivalence, database size,
  and write overhead. Use Cypher EXPLAIN/PROFILE; EXPLAIN of an outer SELECT
  cypher(...) alone does not expose the inner query plan.
- Decision: predeclare latency, write, and space budgets. Admit a materialization
  only when direct joins miss a budget, the change repeatedly meets it beyond
  run variability, and correctness/maintenance tests pass. Cypher CREATE INDEX
  is metadata-only in the pinned GraphQLite; inspect physical SQL indexes.
- If interval queries fail, compare start-led and end-led narrowing. A composite
  index does not automatically tightly bound two independent endpoint ranges.
  Add only the narrowest measured improvement; do not redesign taxonomy for it.

## Suggested order

```text
# Resolve semantics before benchmarking implementation details.
E2 instruction preservation + E3 temporal oracle
  -> E1 required directive coverage
  -> E4 document discovery + E5 evidence state
  -> E6 relation simplification + E8 optional form
  -> E7 actual-runtime write and index consistency
  -> E9 query plans, timing, and materialization admission

# Discovery execution is authorized under docs/technical-discovery.md.
# Results do not imply approval to adopt a production schema or change live data.
```

## References

- [Second-review findings and open decisions](proposal-challenge-review.md)
- [Memory model under review](memory-model-proposal.md)
- [Academic evidence and transfer limits](../research/memory-facets-research.md)
- [Search options and runtime constraints](../research/search-options.md)
- [FABLES: summary faithfulness and omission failure modes, not hg-mem error rates](https://arxiv.org/html/2404.01261v2)
- [GraphQLite EXPLAIN, PROFILE, index metadata and constraints](../../source/graphqlite/docs/src/content/docs/reference/cypher-clauses.md)
- [GraphQLite physical EAV and traversal indexes](../../source/graphqlite/docs/src/content/docs/reference/database-schema.md)
- [GraphQLite SET mutation paths](../../source/graphqlite/src/backend/transform/transform_set.c)
- [SQLite index prefix and range constraints](https://sqlite.org/optoverview.html)
- [Technical-discovery ownership and execution boundaries](../research/technical-discovery.md)
