# Memory facets: research and design synthesis

Reviewed 2026-10-23 by the project topical researcher and DMTS; synthesized by
the lead. These are recommendations, not accepted schema changes. Vector
retrieval remains explicit opt-in. Accepted taxonomy: Domain -> Area -> Topic,
exactly three allowed levels, populated as needed.

## Useful retrieval questions

| Facet | Question | Small representation |
| --- | --- | --- |
| Form | Is this a fact, preference, how-to, directive, or episode? | Proposed `form` property with a small vocabulary |
| Subject | Who or what is it about? | `ABOUT` edge to an identified subject |
| Applicability | Where/when should this influence action? | `APPLIES_TO` scope plus directive status and trigger |
| Filing | Where would a peer look for it? | One canonical `FILED_UNDER` edge |
| Time | When recorded, when happened, when effective? | Separate temporal fields; derived calendar views |
| Evidence | Who asserted it, and where is the source? | `asserted_by`, `assertion_kind`, `source_ref`, accessible source context |
| Revision | What replaced this claim or instruction? | `SUPERSEDES`, with effective dates and lifecycle state |

```text
# Form and purpose are different questions.
# Persona can contain a fact or preference.
# Operational knowledge can be a fact, procedure, decision, or episode.
# A CAPA's preventive instruction is a directive; its source may be an episode.

# Candidate simplification: one Memory label + form and ordinary graph relations.
# Alternative: retain Persona/CAPA labels as useful specialized retrieval hooks.
# The user has not chosen between these encodings.
# Research does not prescribe this exact vocabulary or label arrangement.
```

## Primary evidence and transfer limits

| Work | Finding or contribution | Implication for hg-mem | Limit |
| --- | --- | --- | --- |
| [CoALA](https://arxiv.org/abs/2309.02427) | Conceptual framework separates memory components and action types | Distinguish memory form from topical classification | Not an ablation of our schema; its procedural memory includes executable code/weights, unlike our textual how-to |
| [LongMemEval v2](https://arxiv.org/html/2410.10813v2) | Evaluates temporal reasoning, updates, cross-session reasoning, and abstention; compares indexing and reading designs | Preserve temporal cues, revision information, and source context | Conversational benchmark; temporal Table 4 uses dense retrieval; no proof of calendar-node or label benefits |
| [Generative Agents](https://arxiv.org/abs/2304.03442) | Uses observations, reflections, planning and retrieval combining recency, importance and embedding relevance | Summaries/reflections can remain derived, evidence-linked views | Human-rated simulation believability; does not isolate importance or validate lexical ranking |
| [Reflexion](https://arxiv.org/abs/2303.11366) | Reuses verbal feedback during task retries | CAPA can preserve a concise lesson with supporting evidence | Last few reflections on the same task, not retrieval over hundreds of durable directives |
| [ExpeL](https://arxiv.org/abs/2308.10144) | Combines extracted insights with successful experiences | Distinguish an enduring instruction from supporting episodes | Its successful-trajectory retrieval uses vectors; not evidence for our default implementation |
| [Document Expansion by Query Prediction](https://arxiv.org/abs/1904.08375) | Predicted queries improve lexical retrieval in evaluated document-search settings | Test natural-question expansion alongside other search keys | Trained query prediction is not equivalent to LLM-generated keyword lists |
| [A-MEM](https://arxiv.org/abs/2502.12110) and [HippoRAG](https://arxiv.org/abs/2405.14831) | Explore memory linking/evolution and graph-based multi-hop retrieval | Candidate graph-navigation ideas, optional evaluation paths | Dense retrieval participates; no demonstrated non-vector parity or independent benefit for our proposed facets |
| [Zep](https://arxiv.org/abs/2501.13956) | Temporal graph architecture tracks world validity and transaction history | Full bitemporal history is an option for historical-knowledge audit queries | Composite system; no ablation isolating transaction-time fields |
| [MemoryBank](https://arxiv.org/abs/2305.10250) | Explores conversational memory with forgetting-inspired updates | Consider lifecycle management separately from retrieval ranking | No isolated forgetting ablation; companion-chat goals differ from enduring CAPAs |

## Indexing is not reading

LongMemEval v2 finds round-sized values useful, but fact-only compression can
lose context and hurt overall QA. Fact-augmented indexing keys improve recall.
In its BM25 Table 9, session Recall@5 rises from 0.634 to 0.683 with fact
augmentation; keyphrase augmentation yields 0.632. These expansions prepend
text to one key, unlike our proposed separately weighted FTS column.

```text
# Proposed segmentation: one independently useful claim or instruction per Memory.
# This is a scope/update design choice, not proof that smaller always wins.
# Preserve a source excerpt or link to the source episode.
# Return supporting context to the reader; do not replace evidence with keywords.
```

User decision for large external documents: index a summary and document
reference, without indexing the document body. The source is read on demand.
Moved-file tracking and reference repair are outside scope; report an unavailable
source instead. Preserving access to evidence does not require copying it into
the database or index.

## Keep, derive, defer

| Treatment | Candidates |
| --- | --- |
| Keep in the next model discussion | Form, subject, scope, filing, provenance, effective time, explicit supersession; active/proposed/retired/superseded directive states |
| Derive or evaluate | Calendar buckets, recency/usage signals, summaries, co-filing/graph signals, generated expansion terms or questions |
| Defer without a demonstrated query | Full transaction-time intervals, dedicated Incident nodes, importance scores, automatic links, forgetting schedules, rationale subgraphs |

Generated keywords remain an experiment rather than an accepted default or a
rejected technique. Test an independently weighted field against literal text,
curated aliases, fact augmentation, and predicted questions.

Decision rationale can initially use a body pattern rather than new labels or
an IBIS graph:

```text
Decision: use FTS5 for lexical recall.
Why: keyword retrieval without embedding dependencies.
Consequence: index synchronization and lexical expansion need evaluation.
Source: source_ref / supporting source context.
```

The researcher found rationale capture and knowledge-transfer evidence, but no
isolated retrieval gain from dedicated rationale fields. Placement and concise
content may supply the value without another persistent facet.

## Recall patterns to evaluate

```text
# Persona: explicitly asserted preferences for this operator and applicable scope.
# Action: active CAPAs that apply before changing the SQLite runtime.
# Temporal: what was true during a date range, and what later superseded it?
# Rationale: why was this design selected, and what evidence supports the decision?
# Episode: which earlier failure or successful procedure informs this task?
# Unknown: is there sufficient evidence to answer at all?
```

CAPA retrieval is a local design proposal: load all active applicable directives
when they fit. On overflow, show an inventory and page or narrow explicitly;
never silently discard directives. Optional action tags must preserve untagged
and always-applicable rules. Research supplies no universal threshold.

The smallest exploratory comparison can use about 50 memories and 20 labeled
recall queries, plus temporal, contradiction/update, pre-action, and unknown
cases. Measure evidence recall and rank separately from answer correctness,
stale-claim handling, directive coverage, and abstention. Expand the corpus before
making broad performance claims. LongMemEval tests false-premise abstention, but
does not establish that a particular facet solves it.

## References

- [Current memory model proposal](../archive/memory-model-proposal.md)
- [Search options and runtime constraints](search-options.md)
- [CoALA: conceptual cognitive architecture for language agents](https://arxiv.org/abs/2309.02427)
- [LongMemEval v2: Section 5.2–5.5, Appendix D and E](https://arxiv.org/html/2410.10813v2)
- [Generative Agents: observations, reflection, planning and retrieval](https://arxiv.org/abs/2304.03442)
- [Reflexion: verbal feedback and episodic retry memory](https://arxiv.org/abs/2303.11366)
- [ExpeL: extracting insights from agent experience](https://arxiv.org/abs/2308.10144)
- [Doc2query: document expansion using predicted queries](https://arxiv.org/abs/1904.08375)
- [A-MEM: dynamic agent memory linking and evolution](https://arxiv.org/abs/2502.12110)
- [HippoRAG: graph-supported multi-hop retrieval](https://arxiv.org/abs/2405.14831)
- [Zep: temporal graph memory and historical relationships](https://arxiv.org/abs/2501.13956)
- [MemoryBank: long-term conversational memory](https://arxiv.org/abs/2305.10250)
- [IBIS industrial field trial: design rationale capture](https://www.tandfonline.com/doi/abs/10.1080/07370024.1991.9667172)
- [Controlled study of rationale usefulness by task](https://art.torvergata.it/handle/2108/98790)
- [ADRs in practice: knowledge transfer and document placement](https://research.chalmers.se/publication/542849)
- [Architecture-documentation organization and retrieval effectiveness](https://www.sciencedirect.com/science/article/pii/S0167642315003172)
