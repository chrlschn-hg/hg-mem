# Technical discovery

Authorized by the user on 2026-10-23. Execute disposable prototypes and experiment
fixtures; do not implement the production schema or modify the existing memory
database. Lead owns coordination, advisor requests, shared decisions, and synthesis.

## Ownership

| Track | Owner | Experiments | Writable area |
| --- | --- | --- | --- |
| Runtime, atomic writes, physical plans | Principal Engineer, runtime | E7, E9; database support for E1 | `discovery/runtime/` |
| Applicability, instruction and revision semantics | Principal Engineer, semantics | E1, E2, E3, E6, E8 | `discovery/semantics/` |
| Summary discovery and evidence | Staff Engineer II, retrieval | E4a/E4b, E5 | `discovery/retrieval/` |

Separate directories provide isolation; this workspace is not a Git repository,
so do not initialize Git or create worktrees just for these probes. Engineers may
read each other's published artifacts; all changes stay within assigned areas.
Agent IDs:

- Runtime Principal: `1fd427dc-d9cf-4768-b16c-c5c479d32998`.
- Semantics Principal: `a0f5fec7-a9f1-4306-b06d-ac1eef563bbd`.
- Retrieval Staff Engineer II: `7bb564dc-c290-446c-9816-968566666bd9`.

## Initial runtime milestone

Runtime owner reports verified official GraphQLite 0.12.0 macOS ARM64 library:
`discovery/runtime/vendor/graphqlite-0.12.0-macos-arm64/graphqlite.dylib`.
SHA-256: `46ff8b643847840a48806bfa1ed1bb27762cdbd08a72d7d3b04b4bbae0b2e886`.
Homebrew SQLite 3.53.4 loads it; Cypher CREATE/MATCH and FTS5 coexistence passed
in a disposable database. This does not yet establish E7 atomicity or E9 performance.
See the runtime owner's provenance record for exact acquisition details.

## Shared constraints

```text
# Accepted: Domain -> Area -> Topic; three allowed levels, populated as needed.
# Large external documents: searchable summary + source_ref only.
# Source bodies may be read for authoring/evidence; never indexed or embedded.
# No relocation tracking/repair. Unavailable does not prove moved.
# No vectors, embedding models, or vector dependencies.
# No edits to data/memories.db, bin/, source/graphqlite/, skills, or canonical docs.
# No production model decisions inferred from small synthetic fixture results.
# No arbitrary environment/package installation; use local tooling first.
# Report required dependency/runtime work to lead before changing shared tooling.
```

## Execution and communication

Each owner first sends a concise plan, assumptions, and questions to the lead.
Proceed on independent reversible work while awaiting answers. Route cross-track
requests and advisor questions through the lead rather than making competing
schema contracts. Lead will consult DMTS, researcher, Senior DBA, or Build
Assistant as appropriate. Do not create additional agents.

Paseo endpoint: `127.0.0.1:6767`. Lead agent:
`f4310fc3-8e45-4739-ada6-cb0d50709557`.

Reports belong in each track's `REPORT.md`; end with descriptive Markdown
reference links. Include exact commands, runtime/dependency versions, fixture
sizes and hashes, result counts/metrics, failures, unsupported cases, and concrete
recommendations. Preserve raw machine-readable outputs beside the report.
Clearly separate executed results, hand-authored oracles, model-authored outputs,
simulations, proposals and untested assumptions.

## Runtime track

Use the real pinned GraphQLite 0.12.0 with a SQL-capable runtime. Start with
`/opt/homebrew/opt/sqlite/bin/sqlite3` (3.53.4, FTS5 and extension loading enabled).
`/usr/bin/sqlite3` and native `bin/gqlite` use system SQLite with FTS5 but no
extension loading. Native `gqlite` has no SQL/.load and query errors can exit 0.

Own acquisition of a GraphQLite loadable release artifact if needed, under
`discovery/runtime/vendor/`; publish its absolute path, platform, version and
hash. Prefer the pinned official macOS ARM64 release over a source build; local
Bison 2.3 is below the documented build prerequisite. No edits to upstream source.

Prototype controlled graph mutation + validation + FTS maintenance on one
connection/transaction. Exercise real mutation paths, failure injection, rollback,
and concurrency. Verify graph-derived rows AND search results after transitions;
FTS integrity alone is insufficient. Native-write/trigger comparison is a
disposable competing experiment, not a supported production writer decision.

Then run E9 at 64/1,000/10,000 records with correctness-equivalent queries. Capture
inner plans and warm/reopened timings. Direct authoritative graph joins are the
baseline; admit one narrow copy/index only against predeclared exploratory
latency/space/write budgets. Budget choices are engineering assumptions, not SLAs.

## Semantics track

Build explicit fixtures and executable oracles before encoding a final model.
Start with E3 boundary/unknown-time/retraction/revival cases and E1 scope/top-k
eligibility. Current applicability, past validity and assertion history are
different questions. Unknown is not unbounded; created_at does not invent validity.
If partial replacement is unsupported, reject it before any state mutation.

For E2/E8, distinguish deterministic routing tests from actual LLM writer runs.
Do not report mocked classifications as measured model reliability. Human keys
are not available: mark engineer-authored expected answers provisional and ask
lead/DMTS to review ambiguous cases. Explicit instructions must survive either
encoding; inferred preferences must not become obligations. Overflow must be
visible; headings alone do not prove the agent read or obeyed the full rule.

Use fixture JSON as the first cross-track artifact. Add a database-backed probe
only after the runtime owner publishes the shared library path through the lead;
do not duplicate runtime setup. E6/E8 remain exploratory if the core semantics
expose unresolved product choices; report alternatives instead of choosing them.

## Retrieval track

Implement E4a/E4b and E5 within summary-only constraints using local FTS5. Write
the six source documents and manifest first, without evaluation queries. Send
their paths to lead. Freeze equal-budget generic/literal-preserving summaries
and optional expansion arms with hashes before opening held-out query fixtures.
Lead owns query/oracle authoring from the source documents, independently of the
summaries. Send the summary freeze signal before asking for query release.

Use separate source and index directories; prove source bodies are absent from
the indexed rows. Record source-level recall separately from source-supported
answers. Summaries/model answers authored by the engineer are not independent
model evaluations; record provenance. Do not use fabricated judge scores.

E5 includes source V1/V2 condition reversal, formatting-only change and unavailable
source. Digest is only an optional byte-change comparison, not semantic truth.
Identity checks cover shared source_ref, stable public IDs and summary refresh.
Do not download large public corpora in this first pass; report a bounded follow-on
LongMemEval/HotpotQA adaptation after the tiny falsification fixture is working.

## Advisors

- DMTS `a7b7a819-c7ec-485a-ab31-5f7932449e03`: architecture and unresolved semantics.
- Researcher `50a3a726-10bb-435a-937d-6a18dd45d0c4`: evidence, summary fixtures and evaluation.
- Senior DBA `d75a957f-d755-4494-9541-bf4879db8491`: actual query plans and transaction probes.

## Coordination decisions and pending questions

- Semantics fixtures use fixed `NOW=2026-10-23T12:00:00Z`, not wall-clock time.
- Unknown-start -> possibly-applicable is an advisor-agreed fixture assumption,
  not selected product behavior. Tag dependent cases for re-scoring.
- Oracle cases distinguish binding choices, logical preconditions, provisional
  assumptions, and open product alternatives. Date-only expiry needs an explicit
  normalization/timezone; raw date/timestamp string order cannot choose semantics.
- Product-level expected outcomes stay separate from candidate representations'
  computed outputs and information limits. Do not invent gold that assumes an
  unapproved richer schema; do not give each candidate self-validating gold either.
- Current applicability, valid-time queries, assertion history, and historical
  belief reconstruction are distinct. Belief-as-of is unsupported absent transition
  evidence. Unsupported partial replacement is rejected before mutation.
- E3 fixture v3 and first executed candidate results are published under
  `discovery/semantics/`; DMTS is reviewing the counterexamples and scoring.
  Richer prototypes were written after their author saw the fixtures; their
  passing scores are not independent validation or a schema selection.
  DMTS found write-policy confounds, a policy-dependent expected answer, and
  mixed aggregate scoring in v3. Corrected comparisons must separate those
  causes before claiming additional fields are necessary. In particular,
  encoding retraction as an end timestamp caused failures that do not alone
  establish a representational limitation.
  DMTS accepts V4's corrected comparison with qualifications: no unsafe validity
  answers for the safe minimal-time arms holds only under `V_base`. Treating
  unknown ends as undeclared makes the endpoint-kind arm overclaim validity for
  retirement with unknown effective time; that arm also gives a wrong lifecycle
  answer rather than abstaining. The minimal arm rejects that retirement write,
  an explicit capability cost. Distinct revival policies, unknown retirement
  disposition and historical questions remain conditional requirements, not
  selected product semantics.
- Runtime saved 139 heterogeneous checks, not 139 independent mutation cases.
  DBA audit counts 34 committed, 37 rejected, 20 invariant failures, one error,
  nine read/diagnostic and 38 injected failures. The 37-boundary injection matrix
  includes eight pre-mutation boundaries; one further injection is separate.
  Shared-view rebuild comparisons test maintenance drift, not independent
  projection correctness. Failed concurrent attempts are not acknowledged lost
  updates. Runtime reproduced the core-property override committing an unindexed
  node and reports a whitelist plus missing-node guard fix with preserved
  regression evidence (142 updated checks). DBA reviewed the baseline, not those
  repairs. Typed-property helper identity changes and endpoint scope comparisons
  still need an explicit supported-API boundary. Rejecting a `scope_limit`
  argument alone does not establish semantic partial-replacement rejection.
  Native-trigger synchronization and graph validity remain separate concerns.
- Scope-revision alternatives remain open: equal canonical scope sets only,
  or full coverage with separate explicit authorization for broader applicability.
  Coverage alone does not authorize added scopes. Broader directives may conflict
  with active rules there; no automatic precedence is selected. Both alternatives
  reject unsupported narrowing and unknown scope relations before mutation.
  This is a bounded contract comparison, not authorization to implement a general
  scope algebra or new scope topology. Symlink, filesystem case and cross-checkout
  canonicalization remain unverified.
- Lead-authored retrieval questions and oracle are frozen under
  `discovery/evaluation/retrieval/`: 26 queries, 18 positive targets and eight
  unsupported premises. Lead read originals without reading summary text.
  Lead verified all 22 baseline artifact hashes and held-out hashes, then
  explicitly released queries after the final summary/protocol/index freeze.
  The release record is `discovery/evaluation/retrieval/freeze.json`.
  Unsupported-premise source recall is N/A;
  retrieved counterevidence does not itself constitute an answer failure.
- Frozen retrieval baseline reports all 18 positive targets in the top three in
  every arm. There was no baseline Recall@3 miss to recover, so the preregistered
  improvement gate is unmet. Intended-source top-one counts are descriptive:
  generic 9/18, literal-preserving 13/18, keywords 9/18, predicted questions 11/18.
  Every positive query also returned the contrast sibling in the top three.
  Researcher audit confirms every target was rank one or two: this is a ceiling
  effect, not broad discrimination evidence. Generic and keyword summaries are
  identical within pairs, so their top-one results reflect the ID tie-break.
  Literal E4a gains occur on identifiers; negation and condition results remain
  tied. Literal-preserving and literal-expansion arms are the same treatment,
  not independent replications. No answer-support or abstention behavior was
  measured. E5 source-state and identity probes are complete: changed bytes can
  preserve or reverse a condition, missing sources report unavailable, and two
  public claim IDs can share a source reference across local index rebuilds.
  These are deterministic fixture checks, not reader-model support scores.
  A fresh, more crowded generic-versus-literal
  fixture is a proposed follow-on, not started work or an adopted default.

## References

- [Combined discovery findings, limitations and proposed implementation boundary](technical-discovery-results.md)
- [Completed runtime discovery, atomic writes and physical query measurements](../../discovery/runtime/REPORT.md)
- [Completed semantics discovery report and reproducible commands](../../discovery/semantics/REPORT.md)
- [Completed retrieval discovery, source-state probes and frozen artifacts](../../discovery/retrieval/REPORT.md)
- [Experiment hypotheses and decision rules](../archive/proposal-experiments.md)
- [Second-review findings and open decisions](../archive/proposal-challenge-review.md)
- [Current memory model proposal](../archive/memory-model-proposal.md)
- [Academic evidence and transfer limits](memory-facets-research.md)
- [GraphQLite CLI and runtime source review](graphqlite-reference.md)
- [Search and synchronization options](search-options.md)
- [Runtime release provenance and initial coexistence evidence](../../discovery/runtime/vendor/PROVENANCE.md)
