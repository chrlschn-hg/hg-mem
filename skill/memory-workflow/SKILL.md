---
name: memory-workflow
description: Use memory before a task and save durable learning afterward. Recall applicable instructions, retrieve context, and autonomously capture useful facts, preferences, decisions, and corrections for human review.
---

# Memory workflow

Start here. [Recall](../memory-recall/SKILL.md) before acting;
[write](../memory-write/SKILL.md) when you learn something worth keeping.

```text
# Required: HG_SKILLS, HG_DB, HG_SQLITE, HG_EXT, HG_OPERATOR.
# HG_AGENT identifies this agent for observed/inferred claims.
# HG_MEMORY_ERROR set or missing environment/database: stop memory operations and report it.
# Do not parse Paseo settings, reconstruct HG_* values, or initialize to recover.
```

Run the environment check in [runtime.md](references/runtime.md), then define its
two functions directly in your shell call. No script file or loader is needed.
Retain supplied `HG_*` values. Use `pwd -P` for `cwd` and `HG_SCOPE_IDS` for `scopes`.
Read [schema.md](references/schema.md) for scope, authority, time, and graph rules.

## Before acting

```sh
test -f "$HG_DB"
export HG_INPUT=$(mktemp)
# Example: replace cwd and scopes with the actual task context.
cat > "$HG_INPUT" <<'JSON'
{"cwd":"/work/project","scopes":[],"limit":50,"offset":0}
JSON
{ hgblock memory-workflow/references/eligible.md;
  hgblock memory-recall/references/directives.md; } | hgsql
rm -f "$HG_INPUT"; unset HG_INPUT
# Repeat with offset += limit until total is exhausted. Read full instruction bodies.
```

Then search for task context. Follow filing or subject links when useful; read the
full record before relying on it. Report conflicting or possibly applicable rules.
Search never replaces the complete instruction inventory.

## Save without asking each time

Enabled agent integration authorizes useful durable saves. Honor opt-outs. Search
for duplicates/corrections first; keep one independent claim per memory. Skip
progress logs, secrets, unsupported guesses, and repeated summaries.

| Keep | Example |
| --- | --- |
| Observed fact | “This service requires extension-enabled SQLite.” |
| Decision with evidence | “Use Reagraph; the tested Sigma renderer emitted GL errors.” |
| Inferred preference | “The operator seems to prefer concise answers.” |
| Explicit human instruction | “Ask for approval before running migrations.” |

- Own observation/inference: use the actual `HG_AGENT`, `observed`/`inferred`, `required=false`. Missing identity: report unavailable; do not write under the human's identity.
- Human statement: `HG_OPERATOR` + `explicit` only with direct evidence. Required is only for a real human imperative.
- Choose the narrowest justified scope. Filing organizes; it does not grant applicability.
- Never autonomously replace or withdraw human-authored/required memories. Do not recreate known removals to evade review.
- Prefer a few useful saves over a transcript. Briefly report saved IDs and uncertainty.

## Other workflows

| Need | Skill |
| --- | --- |
| Search, exact read, related paths, history | [memory-recall](../memory-recall/SKILL.md) |
| Create, correct, replace, withdraw | [memory-write](../memory-write/SKILL.md) |
| Explicit new-store setup | [memory-setup](../memory-setup/SKILL.md) |
| Inspect, verify, requested search rebuild | [memory-maintain](../memory-maintain/SKILL.md) |

Use the CLI recipes; no Python, source checkout, or separate MCP server is needed.
On failure, stop and report. Do not blindly retry an uncertain write.
