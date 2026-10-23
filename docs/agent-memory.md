# Agent-first memory

The enabled Paseo agent integration is standing authorization to save useful
durable context. Agents need not ask for approval for each memory. A human can
review the full record and remove it from recall.

| Claim | Attribution | Required |
| --- | --- | --- |
| Agent saw a project fact or preference | `HG_AGENT`, observed | false |
| Agent interprets a pattern | `HG_AGENT`, inferred | false |
| Human directly stated a fact | `HG_OPERATOR`, explicit, direct source evidence | false |
| Human directly gave an imperative | `HG_OPERATOR`, explicit, direct source evidence | true |

Do not manufacture human attribution from an inference. ABOUT names the subject,
not the writer. Missing `HG_AGENT` requires refreshing the session before an agent
writes its own observations.

## Save

1. Read applicable directives and search for close/contradictory memories.
2. Keep one durable claim per memory; skip progress logs, secrets, unsupported guesses, and duplicate summaries.
3. Choose the narrowest justified scope and real filing. Do not make project facts global by default.
4. Write through the canonical CLI recipes. Include honest evidence and agent attribution.
5. Briefly report the saved IDs. Prefer a few useful claims over a transcript.

Only replace your own non-required observation under the existing exact-scope
replacement contract. Do not autonomously end or replace human-authored rules.
Respect explicit opt-outs and known human removals; never deliberately recreate
a withdrawn assertion to evade removal.

## Review and remove

Open a memory in List or Graph. Read its complete text, source, scope, timing, and
Observed/Inferred/Explicit attribution. No new Reviewed flag implies verified truth.

Remove from recall uses retraction: normal search, instructions, and current
exploration exclude the record. Exact reads and revision evidence retain it as
withdrawn. This is not permanent erasure and does not revive a predecessor. There
is no automatic ingestion of whole conversations or hidden background extraction;
the agent chooses and writes memories while doing its task.

## Activation

In Memory setup, save settings and choose **Install or update memory skills**.
This publishes `memory-workflow`, `memory-recall`, `memory-write`, `memory-setup`,
and `memory-maintain` to the configured primary folder and host discovery folders
(`~/.agents/skills`, configured Claude, and an absolute `CODEX_HOME` when set).
The plugin tracks file hashes under `~/.paseo/hg-mem/skill-installs` and archives
recognized old copies there. Modified or unrecognized copies are preserved and
reported. This action does not open or modify the database.

New agents receive the agent-first prompt pointer. Refresh existing sessions for
the current skill assets and `HG_AGENT` environment. A saved system prompt from an
older installation may still forbid automatic writes; start a newly configured
agent rather than assuming a refresh rewrites that prompt.

Session launch supplies `HG_DB`, `HG_SQLITE`, `HG_EXT`, `HG_SKILLS`, `HG_OPERATOR`,
`HG_AGENT`, and `HG_SCOPE_IDS`. It checks configuration files and workspace context,
without opening the database. A busy or unhealthy database therefore does not erase
valid launch configuration. CLI recipes still validate the store before using it.

Setup → Agent sessions shows recent interactive launch results and the last failure
since plugin load. Diagnostics retain up to 50 agent/purpose entries; the screen
shows five interactive entries. History opens do not replace the latest interactive
result. Delivery to the provider is not proof that its shell sees the variables.

| Symptom | Next step |
| --- | --- |
| Existing shell lacks `HG_*` | Start a new agent session or use Paseo's agent reload. Plugin reload and Memory's Refresh cannot alter an existing process. |
| Launch delivered, shell still lacks values | Check the provider's shell environment policy. Do not parse Paseo settings or reconstruct identity. |
| `HG_MEMORY_ERROR` set | Report it and fix Setup/context. Do not retry with empty/global scopes. |
| Provider denies writes outside the workspace | Follow its permission flow. This plugin does not expand sandbox access. |

Recall needs no script file: run the environment check, define the two inline CLI
functions, then execute the recipe with a JSON request. No `source`, shell-code
loader, `jq` settings lookup, or separate executable is needed.

## Verification

- Skill installer: six disposable-directory tests passed (ownership, modified files, updates, aliases, stale lock). Real Setup action installed five skills in both discovery folders and archived 12 recognized old entries; repeat action was idempotent. Status verifies current file hashes. The database remained empty and ready.
- Backend: 48 tests passed, including withdrawal, retained attribution/source, no predecessor revival, and duplicate-removal handling.
- Pure graph model: three tests passed; TypeScript passed.
- Real Paseo UI, disposable store: observed agent claim reviewed; Keep memory cancelled; confirmed removal cleared results and retained the withdrawn detail and evidence.
- Confirmation and result screenshots reviewed separately; failed-status-read UI branches were source-reviewed, not live fault-tested.
- Session environment checks: fresh Codex and Claude shells received all seven keys; native refresh and persistence resume also passed with the actual agent identity. Codex passed in login and non-login shells. Claude's tool has no separate login option.
- Direct CLI forward test: disposable store only; preflight, directives, prefix search, and exact read passed using inline functions, without a script file or settings lookup.
- No user-store fixtures or writes were used for these integration checks.
