# E7 and E9: GraphQLite 0.12.0 runtime discovery

Owner: Principal Engineer, runtime. Scope: disposable prototypes under `discovery/runtime/` only. No canonical docs, skills, `bin/`, `data/`, `source/graphqlite/` or other tracks were modified. The existing `data/memories.db` and `bin/gqlite` were only read (`bin/gqlite` SHA-256 `7b2c591f…` matches the release digest in `graphqlite-release.json`).

All results below are **provisional runtime-isolation evidence**. Semantic choices (scope algebra, public-ID policy, lifecycle, tag/kind rules) were not decided here. Where a probe needed one, it is labeled as a provisional contract.

## Environment and artifacts

| Item | Value | Evidence |
|---|---|---|
| GraphQLite library | official v0.12.0 macOS arm64 `graphqlite.dylib`, 854,528 bytes, SHA-256 `46ff8b643847840a48806bfa1ed1bb27762cdbd08a72d7d3b04b4bbae0b2e886` | [vendor/PROVENANCE.md](vendor/PROVENANCE.md); digest matches release metadata |
| Native CLI (read-only) | `bin/gqlite`, SHA-256 `7b2c591f67101dbb…` | `shasum -a 256 bin/gqlite` |
| Python harness | mise CPython 3.13.16, linked SQLite 3.53.1, `enable_load_extension` available, FTS5 enabled | `~/.local/share/mise/installs/python/3.13.16/bin/python3 -I` |
| Shell SQLite | `/opt/homebrew/opt/sqlite/bin/sqlite3` 3.53.4, `.load` works | used for CLI-script writer and the trigger/native arms |
| System SQLite (for native CLI) | 3.54.0, no extension loading | `/usr/bin/sqlite3`, native `gqlite` |

Fixtures are deterministic (`lib/e9data.py`, seed 7). Generator content hashes (taxonomy + memories) are in [results/e9_fixture_meta.json](results/e9_fixture_meta.json). Build command: `python3 -I e9_build.py`.

| Fixture | Memories | Scope membership (global / project / dir-a / dir-b) | Generator SHA-256 (prefix) | Verify |
|---|---|---|---|---|
| 64 base | 64 | 48 / 19 / 10 / 1 | 21154e99… | pass |
| 1,000 base | 1,000 | 696 / 403 / 155 / 43 | c362643f… | pass |
| 1,000 skewed | 1,000 | 961 / 525 / 16 / 1 | dd1cbb75… | pass |
| 10,000 base | 10,000 | 6,936 / 3,792 / 1,564 / 375 | bd22caaa… | pass |
| 10,000 skewed | 10,000 | 9,649 / 5,094 / 196 / 18 | eb5ea7dc… | pass |

Provisional fixture semantics (runtime isolation only): public ID = text property `id`; `Memory` plus one kind label (`Persona`, `CAPA`, `Operational`); `APPLIES_TO` memory→scope; `FILED_UNDER` for operational, `GOVERNS` for CAPA, both to a `Topic`; `CHILD_OF` for Topic→Area→Domain; one `fts5(title, content, aliases)` table keyed by internal node id.

## E7 — write validation and atomic search maintenance

### E7a. Controlled writer (Python driver, one connection, `BEGIN IMMEDIATE` … `COMMIT`)

Command: `~/.local/share/mise/installs/python/3.13.16/bin/python3 -I e7_writer.py` → [results/e7_writer.jsonl](results/e7_writer.jsonl), [results/e7_writer_summary.json](results/e7_writer_summary.json).

- 154 recorded checks, **154 passed**. Actual statuses: committed 37, rejected 41, failed_invariant 20, failed_injected 43, failed_error 2, failed_commit 1, failed_busy 1, read/diagnostic 9.
- Each committed state is compared with a fresh rebuild (rows, per-term results, FTS integrity) and with an independent Python projection of the EAV rows.
- Injection boundaries: 42 (8 before any mutation, 34 after at least one mutation; figures from `make_tables.py`). Every injected failure left graph and FTS digests byte-identical to the pre-operation state.
- Coverage: same-type SET, type change (int/real/bool/list/map), NULL and REMOVE, map `+=` and `=`, aliases add/remove, label/kind changes, scope edge add/remove, delete, invalid IDs/types/parents, supersede cycle/self/cross-kind/duplicate, scope-set mismatch, public-ID rename, COMMIT failure (deferred FK), lock timeout.

Findings from this run:

1. **Writer hole, reproduced and fixed.** `create_memory(props={"id": "other"})` on a Persona committed a valid but unindexed node in the pre-fix writer. Evidence: [results/e7_regression_props_override.json](results/e7_regression_props_override.json), pre-fix copy at `scratch/prefix/hgrt.py`. Fix: non-allowlisted props rejected before mutation, plus a refresh guard. Public ID is not writable through `update_prop_typed` (regression `C04k`/`C04l`).
2. **Public-ID immutability is not enforced by post-validation.** `C04l` (raw bypass of the allowlist) commits and renames the node; only the API allowlist protects it. The harness restores the ID afterward. Do not claim immutable IDs from this probe.
3. **Parameters inside specific literal contexts evaluate to NULL without error (GraphQLite 0.12.0, tested cases only).** Observed: `SET m += {title:$t}` and `SET m = {id:$id,...}` drop the parameterized values silently; `[$a,$b]` inside a `CREATE` property becomes `[null,null]`. Not observed in this probe: `CREATE (n:T {id:$id, title:$title})` property-map parameters, `SET n.prop = $v`, and whole-map `SET m += $map`, all of which worked. This is context-specific and is not established for other constructors (for example, the lead's note that `date($parts)` returned null while `date({year:$year,...})` worked is a separate observation). Minimal counterexample with output: [results/counterexamples/param_in_literal_is_null.sql](results/counterexamples/param_in_literal_is_null.sql) / [.out](results/counterexamples/param_in_literal_is_null.out). Raw semantics probe: [results/e7_raw_semantics.json](results/e7_raw_semantics.json).
4. **`SET m += $map` ignores null.** The writer converts `None` to an explicit `REMOVE`.
5. **Failed `cypher()` inside an open transaction rolls back only that statement.** The transaction stays open, so the writer must roll back explicitly.
6. **Busy/lock errors surface as generic "Failed to set property …" text**, not SQLITE_BUSY. The bin/gqlite CLI has no busy timeout.

Scope limits, stated per the DBA audit: the validator is a self-consistency check against this spec (maintenance drift), not proof of product-spec correctness. Dirty-input repair is not tested. Writer validation covers touched nodes only (see scoped validator below).

### E7b. Native writes, triggers and constraints

Command: `python3 -I e7_native.py` → [results/e7_native.jsonl](results/e7_native.jsonl), [results/e7_native_summary.json](results/e7_native_summary.json). Each op runs on a fresh copy of the seeded database. "ext" arms use Python with the dylib; "gqlite" arms pipe Cypher through `bin/gqlite`. Trigger catalog: `lib/triggers.py` (recompute-by-node refresh on the five property tables, `node_labels`, `property_keys` for title/content/aliases, and `nodes` deletes).

| Arm | Ops | Blocked by engine | Index ≠ rebuild after op | Committed-invalid, detected by verify | Committed-invalid, missed | FTS integrity OK but index stale |
|---|---|---|---|---|---|---|
| A plain, ext | 40 | 2 | 28 | 20 | 0 | 28 |
| A plain, gqlite | 33 | 2 | 21 | 16 | 0 | 21 |
| B triggers, ext | 40 | 2 | 0 | 20 | 0 | 0 |
| B triggers, gqlite | 33 | 2 | 0 | 16 | 0 | 0 |
| C triggers + UNIQUE/NOT NULL, ext | 40 | 7 | 0 | 15 | 0 | 0 |
| C triggers + UNIQUE/NOT NULL, gqlite | 33 | 7 | 0 | 11 | 0 | 0 |
| D triggers, no constraints, ext | 40 | 1 | 0 | 21 | 0 | 0 |

Reading: without maintenance, FTS integrity passes while the index is stale, so integrity alone is insufficient. Triggers keep the index equal to the rebuild in every arm. Triggers do not prevent invalid graph states; verify catches the committed ones. Blocked operations are separated and not counted as verifier misses.

### E7c. Controlled CLI writer (pure `sqlite3` script, no Python in the write path)

Command: `python3 -I e7_cli_writer.py` → [results/e7_cli_writer.json](results/e7_cli_writer.json), scripts in [results/e7_cli_scripts/](results/e7_cli_scripts). Result: 12 of 13 checks passed; the one "failure" is the intentional `.bail off` negative control, which shows partial commit when `.bail on` is absent. Concurrent CLI writers: 8 processes, one final winner, no corruption. SIGKILL test now uses a shell marker that proves the mutation ran inside the open transaction before the kill.

### E7d. Crash and concurrency

Command: `python3 -I e7_concurrency.py` → [results/e7_concurrency.json](results/e7_concurrency.json). Start barrier used for all workers and readers.

- SIGKILL at pre-commit (WAL and DELETE journal): state unchanged, new content invisible, verify clean. SIGKILL after commit: new state present, verify clean. (Process-kill evidence only; no power-loss test.)
- Four concurrent immediate-mode writers × 15 ops: 60/60 acknowledged alias updates retained, 60 unique creates present, one winner for a contested ID. Concurrent reader: about 50–55k snapshots, zero stored-content or postings mismatches.
- Naive deferred transaction (read then write): 40/60 (WAL) and 38/60 (DELETE) attempts failed with snapshot-upgrade errors. No acknowledged updates were lost (0 in all arms).
- Native `bin/gqlite`, three processes: failed statements per worker, e.g. 24/0/24 with no triggers, and index inconsistency; with triggers, index consistent.
- Lock interplay: a native write during an open controlled-writer transaction fails immediately (`Query failed`, exit 0). Readers during the open transaction see only committed content; the FTS term from the uncommitted change returns no hits.

### E7 limitations

- `search()` orders by public ID with a default limit of 50; it does not test ranked-top-k starvation under large candidate sets.
- No injection between `DELETE` and `INSERT` was forced inside every path. The DELETE/INSERT split is injected (`fts_refresh_delete` / `fts_refresh_insert`) for the create path only.
- Disk-full or I/O errors were not simulated. No power-loss test.
- Scope-set mismatch is rejected by the provisional narrow contract (identical scope-ID sets only). No scope algebra, containment, symlink, case or multi-checkout behavior was tested or selected.
- Trigger catalog does not cover every possible raw writer to internal tables.

## E9 — physical query plans, correctness and timing

### Protocol

1. Correctness first: each query shape has at least two implementations plus a Python oracle computed from the generated fixture (not from the database). A timing is only meaningful for an arm that equals the oracle.
2. Budgets were written before any timing: `results/e9_budgets.json`, declared `2026-10-23T10:32:47-0400`, SHA-256 prefix `da9c8bcf…`. They are engineering assumptions, not SLAs: warm p95 read budget 5/15/50 ms at 64/1,000/10,000 rows; reopen first-query p50 250 ms at 10,000 rows; write p95 create 100 ms, update 50 ms; narrow-copy extra space ≤25% and write ≤25%.
3. Admission rule for a narrow copy/index: direct joins miss a read budget at 10,000 rows in ≥3 repeated blocks; the copy meets budget in all three blocks with ≥2× block-p50 improvement; caps met; maintenance and rebuild equivalence pass.

### Correctness

Command: `python3 -I e9_run.py …` (direct, `analyze` and `copy` variants) → [results/e9_reads_direct.jsonl](results/e9_reads_direct.jsonl), [results/e9_reads_analyze.jsonl](results/e9_reads_analyze.jsonl), [results/e9_reads_copy.jsonl](results/e9_reads_copy.jsonl). Plans: [results/e9_plans/](results/e9_plans).

| Variant | Arms | Equal to oracle | Not equal |
|---|---|---|---|
| direct (64, 1,000, 10,000 × base/skewed) | 414 | 409 | 5, all the deliberate negative control (`NEG_overfetch50_then_filter`, which applies eligibility after the global LIMIT) |
| analyze (1,000, 10,000) | 276 | all except negative control | — |
| copy (1,000, 10,000) | 312 | all except negative control | — |

The negative control is the expected failure: filtering eligibility after a global top-k drops eligible memories. Increasing k is not a fix.

Oracle check of the tokenizer: the Python token match equals the FTS match for all three terms (`tokenizer_oracle_matches_fts: True` in every plan file).

### Plans (10,000 rows, base distribution)

Inner plans were captured with `EXPLAIN QUERY PLAN` for SQL and `PROFILE` for Cypher. Representative findings:

- `fts_scope_topk` SQL `EXISTS` form: FTS virtual-table scan, then correlated `idx_edges_source` and `idx_node_props_text_key_value` searches; temp B-tree for `ORDER BY`.
- `fts_scope_topk` via Cypher-composed `cypher_rows`: the inner Cypher plan uses `idx_node_labels_label`, `idx_edges_source`, and correlated property subqueries. Compiled SQL is roughly 1.3 KB, with about 15 subqueries.
- `recorded_range` and `valid_overlap` via Cypher: correlated subqueries against `npt`/`npi`/`npr`/`npb`/`npj` (one per property type). Each row is checked through every property table.
- SQL EAV forms use `idx_node_props_text_key_value` and autoindex lookups. `valid_overlap` start-led and end-led are both index-backed; start-led was the faster of the two in this fixture.

### Read timings (warm p50 / p95, ms, 10,000 rows, direct arms)

| Shape / case | Implementation | Base p50 | Base p95 | Skewed p50 | Budget p95 | Meets budget |
|---|---|---|---|---|---|---|
| FTS × scope, top-10, common term, dense scope | SQL `EXISTS` on edges | 3.55 | ~3.6 | 3.85 | 50 | yes |
| same | Cypher-composed (`cypher_rows`) | 348 | ~355 | 464 | 50 | **no** (7–9× over) |
| same | host: FTS ids + Cypher eligibility | ~9,200 | — | ~9,100 | 50 | **no** (≈180×) |
| FTS × scope, rare term | SQL `EXISTS` | 0.006 | — | 0.010 | 50 | yes |
| FTS × scope, rare term | Cypher-composed | 57 | — | 69 | 50 | **no** |
| CAPA inventory, dense | SQL EAV | 1.99 | — | 2.08 | 50 | yes |
| CAPA inventory, dense | Cypher `WHERE` / map | 8.73 / 8.21 | — | 9.86 / 9.42 | 50 | yes |
| Recorded-time range, narrow | SQL EAV | 0.47 | — | 0.51 | 50 | yes |
| Recorded-time range, narrow | Cypher `WHERE` | 8.19 | — | 8.11 | 50 | yes |
| Valid-time overlap, wide | start-led SQL | 8.0 | — | 7.9 | 50 | yes |
| Valid-time overlap, wide | Cypher `WHERE` | 19.1 | — | 18.9 | 50 | yes |
| Taxonomy Area members | SQL EAV | 3.07 | — | 3.07 | 50 | yes |
| Taxonomy Area members | Cypher | 4.84 | — | 4.74 | 50 | yes |
| Exact ID | Cypher or SQL | 0.005 / 0.002 | — | 0.005 / 0.002 | 50 | yes |
| Combined FTS × scope × kind × active × valid | SQL | 6.43 | — | 7.38 | 50 | yes |

Key result: the direct SQL joins meet budget at 10,000 rows in this fixture. The Cypher-composed FTS × scope join misses budget by a wide margin in both distributions. The cause is Cypher compiled SQL overhead (1–2 M VM steps versus ~0.2 M for the SQL form), not a missing index. The host composition is far too slow and is not a viable candidate.

Variability: these are one block of 40 repetitions per arm. The admission rule requires three independent blocks; that was not run. Treat the numbers as single-run observations.

### Narrow copy (`memory_scope(memory_nid, scope_pid)` WITHOUT ROWID, PK `(scope_pid, memory_nid)`)

| Case (10k base, FTS × scope, SQL) | Direct `EXISTS` p50 | Copy p50 | Oracle equal |
|---|---|---|---|
| common-dense | 3.55 | 1.71 | yes |
| common-two | 4.64 | 2.09 | yes |
| mid-two | 0.36 | 0.18 | yes |
| rare-two | 0.006 | 0.005 | yes |

The copy is about 2× faster than the direct SQL form on common-term cases, and it is correct. It was **not admitted**: the direct SQL form already meets budget at 10,000 rows, so admission condition (1) is not satisfied for that arm. The arm that misses budget is the Cypher-composed join, and this probe did not test a copy against it directly. Extra storage: +2.9% file size at 10,000 rows. Copy maintenance was exercised only on the create path in the write benchmark; scope-edge churn and copy maintenance on scope changes were not tested.

Recommendation: keep the graph-join SQL form as the authoritative candidate for FTS scope filtering; do not add the copy on this evidence.

### Reopened-connection timings

Command: `python3 -I e9_reopen.py` → [results/e9_reopen.json](results/e9_reopen.json). Each trial opens a new connection (including extension load), then times the first and second query. Page cache is warm; OS cache purge needs sudo and was not attempted.

- Connect + extension load: 1.2–2.8 ms p50.
- 10,000 rows, first query p50: SQL FTS `EXISTS` 3.4 ms; SQL EAV 0.1–2.1 ms; Cypher CAPA inventory 9.1 ms; Cypher FTS × scope 47 ms (rare-two) and 9.2 s (host composition). All within the 250 ms reopen budget except the host composition.

### Writes and space

Command: `python3 -I e9_write.py 1000 30` and `python3 -I e9_write.py 10000 30` → [results/e9_write.json](results/e9_write.json). Single-process, 30 creates and 30 content updates per arm, each as one transaction, on copies of the fixtures.

| Arm | Create p50 / p95 ms (10k) | Update p50 / p95 ms (10k) | Meets budget (create 100 / update 50 p95) |
|---|---|---|---|
| Native Cypher, constraints | 34.7 / 36.2 | 8.6 / 8.9 | yes |
| Native Cypher, no constraints | 1.1 / 1.5 | 0.15 / 0.18 | yes |
| Native Cypher + triggers | 36.2 / 39.2 | 9.5 / 10.8 | yes (index consistent after run) |
| Controlled writer, full-graph validation | 301 / 321 | 273 / 290 | **no** |
| Controlled writer, scoped validation | 36.2 / 37.7 | 9.0 / 9.1 | yes (index consistent after run) |
| Controlled writer, scoped, no constraints | 1.4 / 2.3 | 0.29 / 0.40 | yes |
| Controlled writer, scoped + narrow copy | 36.0 / 37.6 | 9.2 / 9.6 | yes |

Scoped validation is checked for equivalence with the full view on 54 corruption cases across three memory kinds (`e9_scoped_equiv.py`, zero mismatches; [results/e9_scoped_equiv.json](results/e9_scoped_equiv.json)). It is local to touched memories; the full view stays for ops without a watched node.

Space at 10,000 rows: file 15.6 MB (about 1.56 KB per memory); FTS about 4.0 MB; graph EAV and indexes about 11.5 MB. Narrow copy adds +2.9% file size.

## Summary by question

| Question | Result | Status |
|---|---|---|
| Does the official dylib load and coexist with SQL, Cypher and FTS5 in one connection? | Yes | executed |
| Can the controlled writer keep graph and FTS consistent across sanctioned operations and failures? | Yes, on this fixture and provisional contract (154 checks; injection boundaries rolled back) | executed; provisional spec |
| Do native writes plus triggers keep FTS consistent? | Yes for the tested Cypher and raw SQL paths; no for native writes without triggers | executed |
| Do triggers enforce graph invariants? | No; verify is still required | executed |
| Is a CLI-only (sqlite3 script) writer possible? | Yes for the tested paths; `.bail on` must be in the script | executed |
| Are direct SQL joins sufficient for FTS × scope at 10k? | Yes (≈3.5 ms common term, <0.01 ms rare) | executed |
| Are Cypher-composed FTS × scope joins sufficient at 10k? | No (≈50–470 ms against 50 ms assumed budget) | executed |
| Should a narrow copy be admitted? | No on this evidence | executed, admission rule not met |
| Does an analyze/`ANALYZE` pass change plans or results? | Results equal; no material timing change | executed |
| Are writes within budget at 10k? | Native and scoped writer yes; full-graph validation no | executed |

## Open items and recommendations

1. Decide the public-ID immutability policy; currently only the writer allowlist enforces it.
2. Replace `props` / `SET +=` literal patterns in any future writer with whole-map parameters, or with per-property SET, to avoid silent NULLing.
3. For E9 admission decisions, repeat timings in three blocks and add a Cypher-level narrow copy if the Cypher path is retained.
4. Scope algebra, scope containment, and scope-relative supersession are not decided. The narrow contract (identical scope-ID sets only) is provisional.
5. Writer-origin detection is not possible via verify; an audit or enforcement design is a separate decision.

## Files

- Runtime library: [lib/hgrt.py](lib/hgrt.py), [lib/e9data.py](lib/e9data.py), [lib/e9q.py](lib/e9q.py), [lib/scoped.py](lib/scoped.py), [lib/triggers.py](lib/triggers.py), [lib/fixture.py](lib/fixture.py)
- E7 probes: [e7_writer.py](e7_writer.py), [e7_native.py](e7_native.py), [e7_cli_writer.py](e7_cli_writer.py), [e7_concurrency.py](e7_concurrency.py), [e7_raw_semantics.py](e7_raw_semantics.py), [e7_regression_props_override.py](e7_regression_props_override.py)
- E9 probes: [e9_build.py](e9_build.py), [e9_run.py](e9_run.py), [e9_reopen.py](e9_reopen.py), [e9_write.py](e9_write.py), [e9_scoped_equiv.py](e9_scoped_equiv.py), [e9_budgets.py](e9_budgets.py)
- Aggregates: [results/tables.md](results/tables.md), generated by [make_tables.py](make_tables.py)
- Provenance: [vendor/PROVENANCE.md](vendor/PROVENANCE.md)
- Checked-in raw results: [results/](results)

## Reproduction notes

- Use the mise CPython 3.13.16 (`-I`) for all probes. The PATH `python3` lacks `enable_load_extension`.
- Library path is fixed at `discovery/runtime/vendor/graphqlite-0.12.0-macos-arm64/graphqlite.dylib`.
- `scratch/` (≈263 MB of databases, the fixture copies and logs) is disposable and not part of the report evidence.
