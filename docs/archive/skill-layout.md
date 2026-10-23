# Text-only skill layout

Shipped bundle: five skill entry points with Markdown SQL references. The tree
below describes responsibilities; see the package links for actual recipe files.
Runtime binaries and database files are external prerequisites. No Python runtime.

```text
skill/
  hg-mem/
    SKILL.md                     # Root: route task; common operating sequence.
    references/
      schema.md                  # One versioned graph contract.
      runtime.md                 # CLI selection, extension loading, parameters.
  hg-mem-init/
    SKILL.md                     # Runtime setup, new DB, schema, smoke check.
  hg-mem-write/
    SKILL.md                     # Create/update workflow; choose operation.
    references/
      create.md                  # Claims, preferences, directives, summaries.
      revise.md                  # Correct, supersede, retire, retract.
      transaction.md             # Embedded atomic write/validation examples.
  hg-mem-recall/
    SKILL.md                     # Search -> read -> optional navigation.
    references/
      search.md                  # Literal FTS + eligibility before LIMIT.
      read.md                    # Full record; source support on demand.
      navigate.md                # Bounded, typed paths; explain connections.
      directives.md              # Applicable inventory independent of search.
  hg-mem-maintain/
    SKILL.md                     # Inspect/verify; explicit rebuild operation.
    references/
      verify.md                  # Graph invariants + projection agreement.
      rebuild.md                 # Rebuild derived search state atomically.
```

Ship as one bundle; preserve sibling paths. Each task skill links directly to
the shared schema/runtime and works when invoked without loading the root first.
Split a reference only when its operation warrants the extra file.

## Root workflow

```text
# Root SKILL.md: routing and sequence, not duplicated command bodies.
1. Resolve database, operator and working context.
2. Read schema version and relevant runtime contract.
3. Initialize only when setup is requested or the chosen DB is absent.
4. Before acting: recall required/possibly applicable directives; expose overflow.
5. Route: write | recall | maintain. Load only that operation's references.
6. Execute CLI examples with bound values; inspect result payloads.
7. Return public memory IDs, evidence state and unresolved conflicts.
```

Loading the root does not authorize creating a database, recording new memories,
running repairs or changing an unrelated workspace. Use the user's task scope.
Write operations can retrieve for duplicate/correction checks without recursively
invoking the entire root workflow.

## Shared graph contract

```text
# schema.md: operational contract, not the research/proposal history.
schema_version
nodes: labels, required/optional properties, public identity
relationships: direction, allowed endpoints, cardinality
taxonomy: Domain -> Area -> Topic; populate branches as needed
filing: relevance/organization; never applicability by itself
scope: explicit global versus missing; path resolution policy
time: units, UTC representation, boundaries, unknown values
lifecycle: allowed transitions; supersession and scope rules
search: canonical graph versus rebuildable FTS; indexed fields
results: public IDs, match reason, source availability/support, conflicts
```

Record only selected semantics in the shipped contract. Resolve outstanding
scope/lifecycle choices before publishing mutation recipes. Examples must not
silently select an OPEN discovery alternative.

## CLI examples and embedded programs

```text
# No packaged .py/.sh/.sql executables, generated wrappers or scripts/ directory.
# Use sqlite3 CLI blocks for SQL + Cypher on one connection.
# Use extension-enabled sqlite3 directly; no Python or custom command dispatcher.
# .bail on; one transaction; validation + FTS maintenance before COMMIT.
# Bound input values. Do not build Cypher by interpolating user content.
# Check outputs, not only native gqlite exit status.
# Keep runnable blocks complete; never call an unshipped helper command.
# No implicit package installs, vector extension or separate graph engine.
```

Runtime instructions must explain that native `gqlite` has no SQL interface;
FTS and coordinated transactions use extension-enabled SQLite. Text-only shipping
does not mean a dependency-free runtime. Provide acquisition/verification commands
in initialization rather than relying on this workspace's discovery files.

Keep repeated fragile code in one referenced Markdown recipe. Prefer CLI-native
examples over a large embedded application that the agent must reconstruct.

## Writing convention

```text
---
name: hg-mem-<operation>
description: <capability and activation condition>
---

# <Operation>
<One essential instruction if needed.>

<Commented, runnable CLI block.>

## References
- <Descriptive link to the shared schema.>
- <Descriptive link to the exact operation/runtime/source reference.>
```

Essential rules stay in the skill or shared contract; upstream links supply detail,
not missing operational instructions. End each document with descriptive reference
links. No generic exposition, copied manual, standalone script or bundled binary.

## References

- [Existing initialization skill](../../skill/hg-mem-init/SKILL.md)
- [Shipped bundle entry points](../../SKILL-PACKAGE.md)
- [Completed technical discovery and unresolved implementation contracts](../research/technical-discovery-results.md)
- [Algorithm/function integration candidates and compatibility findings](../research/graph-algorithms-review.md)
- [Memory model proposal and accepted taxonomy](memory-model-proposal.md)
