# Paseo Memory 0.1: first working iteration

Local plugin source: [paseo-hg-mem](../../paseo-hg-mem/paseo-plugin.json). Runtime ID `hg-mem`; app display name **Memory**. Targets Paseo 0.12, macOS Apple Silicon, Homebrew SQLite and the pinned official GraphQLite 0.12.0 library.

Handoff state: plugin installed and running; synthetic test-store integration switched off, operator identity cleared, and database selection returned to the suggested fresh location. Test data and screenshots remain under `discovery/plugin-v1/`; they are not the live store. Confirm your own operator and store in Memory setup before enabling memory.

## Operator workflow

1. Open Command Center → **Open memory**, or enter `/memory [search]` in a workspace composer.
2. Open **Memory setup**. Choose a database, SQLite CLI and extension; confirm operator name and stable identifier. Save setup, explicitly create/connect the managed store, and enable memory.
3. Use **Memories** for recent items, search and detail. New memory has independent purpose, scope and required-instruction choices. Operational memories select a filing container.
4. Use **Instructions** for the complete active/possibly-applicable inventory, independent of search. Page until the total is exhausted.
5. Review the exact attachment snapshot in detail. Select Memory in the native composer attachment picker. Selection stages context; explicit message submission sends it.

Directory scope covers that directory and descendants. It does not promise coverage across worktrees. The human-operated attachment picker deliberately searches active memories across all scopes because Paseo 0.12 sends only a query; snapshots say composer applicability has not been checked.

## Agent workflow

New agents receive a short system-prompt pointer plus `HG_DB`, `HG_EXT`, `HG_SQLITE`, `HG_SKILLS`, `HG_OPERATOR` and `HG_SCOPE_IDS`. The private skill install contains a Paseo entry point and the 25 raw Markdown recipes. Skills remain text-only. No Python or local MCP server is required.

Agents run the same SQLite CLI recipes. Required-instruction inventory is independent of lexical search; source content is data, not proof of operator authority. No turn-ended ingestion, automatic memory write, permission approval or extra follow-up loop is installed.

Existing agents need a session refresh for environment changes and must be told to read the installed `paseo-memory/SKILL.md` once. The automatic prompt pointer applies to newly created agents. Disabled/unavailable memory must not block agent creation or session opening.

## Runtime contract

- One SQLite CLI process per operation. Bound JSON parameters, no shell interpolation of content.
- One transaction for a memory save, scope resolution, validation and FTS maintenance. Success requires confirmed command completion.
- Graph remains canonical; literal FTS5 is rebuildable.
- Full validation/rebuild favors small stores. The discovery harness measured growing write cost at hundreds of records; large-store performance is not a release claim.
- Setup is explicit, idempotent and staged: skills install, bootstrap if absent, operator and filing seed. It does not migrate arbitrary existing databases.
- Scope is applicability, not an access-control boundary. The plugin is trusted host-local code.

## Verification

All execution uses disposable stores under `discovery/plugin-v1/`. The original `data/memories.db` was not used.

| Check | Evidence |
|---|---|
| CLI service tests | [Release check output](../../discovery/plugin-v1/release-checks.txt): 31/31 pass; real Homebrew SQLite and official extension |
| New-agent hook and skills | [Actual agent result](../../discovery/plugin-v1/agent-smoke-result.json): full inventory and preference read, CLI exit 0 |
| Skills install | 26 Markdown files, 25 raw hashes identical, 97 relative links resolve; [installer test](../../discovery/plugin-v1/skills/test-install.mts) |
| Instruction paging | [Results](../../discovery/plugin-v1/paging-results.json): 31 total, pages of 30 and 1, 31 unique IDs |
| Exact attachment preview | [Parity result](../../discovery/plugin-v1/attachment-preview-parity.json): UI text equals API snapshot |
| Running UI | Native Paseo browser driving the installed Paseo 0.12 web client against the local daemon; desktop and compact screenshots reviewed by Designer and Advocate |
| Human save/read | Preference saved through UI as advisory/global; correction saved as required/directory with source; exact values checked through plugin RPC |
| Composer | Two memories staged, one removed, remaining item preserved; no test message submitted |

Browser testing used a temporary loopback static server for the installed Paseo web client. That is development infrastructure, not a plugin dependency. No daemon restart was required.

## Limits

- Native Paseo 0.12 attachment chips do not reopen plugin-local memories. Review the exact text in Memory before attaching. The opaque `hgmem:` locator is an identity reference, not an external web link.
- Only active, in-window memories appear in the attachment picker. Exact read can show historical records.
- UI editing, replacement and retirement are not exposed in this iteration; raw write skills retain their supported operations.
- Project bindings are host settings; no project-binding editor or worktree inference ships.
- New-agent behavior was exercised with Claude. Other provider launch paths and resumed pre-plugin sessions are not covered by that smoke result.
- Summary sources are not opened or verified by this panel. Unknown save outcomes preserve the draft and require checking before another save.
- Theme/compact checks are browser checks, not physical iOS/Android or screen-reader certification.

## Critique and follow-through

Screens were attached to messages to the End-User Advocate, Visual Product Designer and UI Engineer. Their critique led to foreground navigation text, readable authority/scope attachment labels, an earlier exact-text preview, a shorter compact header, inline instruction counts, selected tab accessibility state, and instruction paging above and below results. Updated dark/light wide/compact screenshots were reviewed; no blocking UX issue was observed in those states.

Evidence: [compact dark aftershot](../../discovery/plugin-v1/after-dark-compact-list-default.png), [compact light aftershot](../../discovery/plugin-v1/after-light-compact-list-default.png), [preview placement](../../discovery/plugin-v1/after-dark-compact-detail-action.png), [native staged attachments](../../discovery/plugin-v1/attachments-after-critique.png), [instruction pager aftershot](../../discovery/plugin-v1/pager-after-critique.png).

Nonblocking follow-ups: distinguish browsing context from each record's applicability more clearly; label preview as text for a new attachment; add source-copy convenience; improve uncertain-save recovery with a stable request identity. No fake external URL was introduced to mask the Paseo 0.12 attachment navigation limit.

## References

- [Plugin integration entry](../../paseo-hg-mem/index.server.ts)
- [RPC contracts and memory records](../../paseo-hg-mem/shared/contracts.ts)
- [CLI-backed memory service](../../paseo-hg-mem/server/memory-store.ts)
- [Paseo agent skill entry](../../discovery/plugin-v1/skills/paseo-memory/SKILL.md)
- [Graph schema and lifecycle](../../skill/hg-mem/references/schema.md)
- [Designer critique](plugin-ux-review.md), [operator critique](plugin-operator-review.md)
- [Paseo plugin reference](https://paseo.sh/docs/plugins/reference.md)
- [Paseo coordination skill](../../../../../../.agents/skills/paseo/SKILL.md), [Paseo plugin workflow](../../../../../../.agents/skills/paseo-plugin/SKILL.md)
