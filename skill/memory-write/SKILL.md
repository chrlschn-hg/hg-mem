---
name: memory-write
description: Autonomously save durable observations and decisions in an existing managed store. Create context, correct wording, replace eligible own observations, or explicitly withdraw a record through atomic CLI recipes.
---

# Write memory

Load [runtime](../memory-workflow/references/runtime.md) and
[schema](../memory-workflow/references/schema.md). Recall directives, search for
duplicates/corrections, then read close matches. Honor opt-outs and known removals.

Search one distinctive token or identifier per query, then another if needed.
Multiple words use OR, so a common word can return unrelated hits. Read
close hits: same claim and scope → skip; changed own observation → replace; unrelated
claim → create. A fresh ID does not prevent duplicates. These are agent decisions,
not content-deduplication guarantees from the store.

```sh
test -f "$HG_DB"
printf '%s\n' "$HG_AGENT"  # Use this actual identity for your observation.
export HG_INPUT=$(mktemp)
# Example values only: substitute actual identity, existing scope/filing, real source.
# Quoted heredoc preserves shell metacharacters. Escape quotes/backslashes as JSON.
cat > "$HG_INPUT" <<'JSON'
{"id":"memory:new-unique-id","kind":"Operational","title":"SQLite runtime","content":"This project requires extension-enabled SQLite.","asserted_by":"agent:provided-session-id","assertion_kind":"observed","required":false,"source_ref":"file:/work/project/docs/runtime.md","scopes":["scope:project"],"filing":"domain:software"}
JSON
{ hgblock memory-write/references/begin.md;
  hgblock memory-write/references/create.md;
  hgblock memory-write/references/commit.md; } | hgsql
rm -f "$HG_INPUT"; unset HG_INPUT
# Require exit 0 and a public id + operation receipt. Otherwise stop; do not claim Saved.
```

## Pick the right claim

| Evidence | `asserted_by` / `assertion_kind` | `required` |
| --- | --- | --- |
| You observed it | actual `HG_AGENT` / `observed` | false |
| You inferred it | actual `HG_AGENT` / `inferred` | false |
| Human directly stated it | actual `HG_OPERATOR` / `explicit`, direct source evidence | false |
| Human gave an imperative | actual `HG_OPERATOR` / `explicit`, direct source evidence | true |

Use a fresh ID and one independent claim. Persona needs `subject` = an existing
Operator; the observing agent remains the assertion source. Operational needs one
filing node. CAPA is a corrective purpose, not an automatic instruction.
Use the narrowest justified scope; never default project knowledge to global.

Find existing context IDs before inventing nodes:

```sh
hgsql "SELECT n.id,l.label,n.name,n.scope_kind,n.root
 FROM hg_node n JOIN hg_label l ON l.nid=n.nid
 WHERE l.label IN ('Scope','Operator','Domain','Area','Topic') ORDER BY n.id LIMIT 100;"
# Page with OFFSET if needed. Directory scopes must match the real task directory.
```

Missing context? Run each new context through
`begin.md + context.md + commit.md` before creating its memory:

```json
{"id":"operator:evaluator","label":"Operator","name":"Evaluator"}
```

Use the configured human ID and confirmed name, not the sample identity. An agent
assertion ID is not an Operator subject.

```json
{"id":"scope:project","label":"Scope","name":"Project directory","kind":"directory","root":"/work/project"}
```

```json
{"id":"domain:software","label":"Domain","name":"Software"}
```

Do not paste the sample directory root. Use the actual output of `pwd -P` in the
target directory; the store checks path syntax, not directory existence.
Domain → Area → Topic is optional depth,
not three mandatory placeholders. [Context fields](references/context.md).

## Revise deliberately

| Need | Middle recipe; always surround with begin + commit |
| --- | --- |
| New claim | [create.md](references/create.md) |
| Same meaning, typo/presentation only | [edit.md](references/edit.md): `id`, `meaning_unchanged:true`, changed text |
| Own observation changed meaning | [replace-start.md](references/replace-start.md) + create + [replace-link.md](references/replace-link.md): old/new request |
| Explicitly end applicability | [retire.md](references/retire.md): `id` |
| Explicitly remove from recall | [retract.md](references/retract.md): `id`; evidence stays, predecessors do not revive |

Autonomous replacement is only for your own non-required observation, with identical
purpose and exact scope set. Do not autonomously end/replace human-authored rules.
No raw graph edits, public-ID changes, deletion, migration, or automatic broadening.
Keep literal identifiers, conditions, and negation. Store a document summary plus
source locator, not its body. Never invent evidence or claim a source was checked.
The store records `source_ref`; it does not check that the file or URL exists.
Attribution rules here guide the caller; direct CLI access is not an identity boundary.

Report the saved ID, scope, and uncertainty. Human review does not require waiting
for approval on each useful durable save.

`CHECK constraint failed: ok=1` means a guard rejected the request, but does not
name the rule. Check request fields against the recipe and schema, confirm referenced
IDs with exact reads/context lookup, and run maintain verification. Do not bypass
the guard or blindly repeat the write; report the request ID and error if unresolved.
