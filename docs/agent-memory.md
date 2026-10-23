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

## Verification

- Skill installer: six disposable-directory tests passed (ownership, modified files, updates, aliases, stale lock). Real Setup action installed five skills in both discovery folders and archived 12 recognized old entries; repeat action was idempotent. Status verifies current file hashes. The database remained empty and ready.
- Backend: 48 tests passed, including withdrawal, retained attribution/source, no predecessor revival, and duplicate-removal handling.
- Pure graph model: three tests passed; TypeScript passed.
- Real Paseo UI, disposable store: observed agent claim reviewed; Keep memory cancelled; confirmed removal cleared results and retained the withdrawn detail and evidence.
- Confirmation and result screenshots reviewed separately; failed-status-read UI branches were source-reviewed, not live fault-tested.
- The configured home-folder store was not seeded for this test and remains empty.
