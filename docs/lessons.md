# Lessons from the first iteration

## Runtime

- Use one writer contract: UI and skills both call the SQLite CLI recipes. A second SDK writer would need invariant and transaction parity.
- With this SQLite build, `-bail` plus SQL in `-cmd` can skip stdin without an error. Put only dot commands in `-cmd`; put PRAGMAs in stdin.
- Short-lived CLI connections avoid the observed GraphQLite rollback/cache problems. Keep values parameterized, not shell-interpolated.
- Validate capability and extension digest. System SQLite is not a substitute for the tested Homebrew runtime.

## Recall and history

- Eligibility is scope + status + effective interval, applied before LIMIT. Do not ask the agent to remember a filter.
- Search prefix tokens: `arch` should find `architecture`. UI and skills share the recipe.
- Required instructions need a separate complete, paged inventory. Search hits are not an instruction inventory.
- Current is derived, not a stored boolean. Replaced predecessors can remain status=active with an ended interval.
- Retraction does not revive the old assertion. Keep history explicit; never infer current truth from the newest node.
- History uses a bounded recursive walk, not a growing SQL JOIN statement. Full history and full-index FTS costs still grow with stored versions.
- FTS BM25 statistics are table-wide even when results are eligibility-filtered. Measure version-growth effects before adding another derived index.

## Graph exploration

- Use typed, bounded paths: filing ancestry, ABOUT subject, separate replacement history.
- Scope is an attribute, not a generic traversal hub. Subject is not author. Filing is not applicability.
- Return public properties explicitly. GraphQLite path objects and comprehension `x.id` can expose internal IDs.
- Show named paths, direction, total, and partial coverage. Select inspects; Expand fetches a bounded page.

## Paseo UI

- Pin SDK/app compatibility to 0.12; current public docs may describe 0.13 features.
- Plugin RPC serves app UI. Agent-facing access needs skills or explicit MCP integration; plugin slash commands do not prompt the agent.
- DOM/WebGL graph libraries need a browser prebundle; lazy loading alone does not resolve forbidden Node `events` imports.
- Reagraph works on tested web/desktop after prebundling. Native uses List. Private ReactDOM needs an exact host React guard.
- React boundaries caught tested scene-render errors; frame callbacks, workers, and GPU/process crashes are different failure classes.
- Real context loss needs explicit handling. Retry and Use list must retain the user's task.
- Core RN Modal passed pointer tests but leaked keyboard focus. Use honest bounded disclosures in this iteration.
- Set ARIA expanded/selected props explicitly; the tested host did not translate all RN accessibilityState values.
- One toolbar above both panes; one inspector for every node kind. Percent-based Split avoids transient measured-width fallback errors.
- Freeze draft fields while saving. A timeout can mean commit unknown, so do not auto-retry.
- The same-second retirement test uses wall time and can cross a UTC-second boundary. It failed once and passed twice during cleanup; make its clock deterministic in a test-focused change.
- Composer attachments are snapshots. Staged text does not update, and Paseo 0.12 chips cannot reopen local memories.

## Evidence limits

Tested: disposable backend stores, pure graph model, desktop/compact browser states,
local renderer faults, actual WebGL context loss. Physical native devices, large
production stores, all async failures, and fully offline graph labels are unverified.
