# Proposed memory editing

Design only. The raw skills support presentation edits and replacement; the current
plugin has create/retire RPCs, without an edit form or edit/replace RPC.

| Field | Suggested UI behavior |
| --- | --- |
| Title, content, source locator | Edit a draft; preview the diff; default content changes to a new version |
| Filing breadcrumb | Explicit Move action; preserve identity and applicability |
| Scope, ABOUT subject, purpose, required | Explicit change workflow; never incidental text-form updates |
| Status | Named Retire or Withdraw actions |
| Validity dates | Advanced lifecycle workflow |
| Public ID, original asserted_by, creation time | Read-only |

## Persistence

Use typed plugin RPCs and the existing controlled SQLite CLI writer. Bind request
JSON, BEGIN IMMEDIATE, compare the expected prior record/relationships, apply the
edit or replacement, validate graph invariants, refresh FTS, then COMMIT. Re-read
the saved record and invalidate browse/detail/explore caches. Preserve the draft on failure.

An in-place wording correction uses `begin.md + edit.md + commit.md`, with explicit
`meaning_unchanged:true`. A changed claim uses `replace-start.md + create.md +
replace-link.md + commit.md`, preserving the old Memory and linking new → old.
The recommended default is a new version for body changes, particularly required
instructions. Do not use word overlap to infer that meaning stayed unchanged.

The concurrency guard compares expected prior values inside the transaction.
Second-resolution updated_at is insufficient by itself. Include the relevant text,
status, filing and scope set, so an agent or another UI cannot silently overwrite
a newer edit. On conflict show the current record beside the preserved draft.
After a timeout, check the operation's stable target ID before retrying.

## Boundaries

Current replacement permits only identical purpose and scope sets, effective now.
Purpose/scope/authority changes are not automatically supported by exposing more
fields in an edit form. They need explicit product semantics and controlled commands.
Filing changes do not grant applicability. Status and provenance are not free-form
fields; preserve the original assertion's author rather than replacing it with the editor.
