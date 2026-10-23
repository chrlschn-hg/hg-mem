# hg-mem skills v1

Local release: `dist/hg-mem-skills-v1.zip`. Five sibling skill folders;
25 Markdown files, no executable scripts, binaries or database files inside.
Install the folders together. Start with `hg-mem/SKILL.md`.

```text
# Runtime: extension-enabled sqlite3 + official GraphQLite 0.12.0.
# Tested: macOS ARM64, Homebrew SQLite 3.53.4; no Python dependency.
# New managed database only. No existing-data migration or live DB modification.
# V1 lifecycle/scope defaults and unsupported cases are explicit in schema.md.
# Full-store validation/index rebuild favors small stores; not a 10k performance claim.
```

## Verification

- Ran the actual Markdown SQL through the shipped CLI loader: initialize, reopen,
  create context/memory, directive inventory, search, read, navigate, edit, replace,
  retract, inspect, verify and rebuild.
- Guard checks: authority/identity edits, inferred obligation, invalid filing after
  mutation and null validity rejected; complete SQL dumps remained unchanged.
- Checked unknown start remains POSSIBLE, directory boundary exclusion, retirement
  current/history behavior, drift detection, rebuild and invalid-graph rejection.
- Independent writer check preserved apostrophes, Unicode and shell-like text;
  recalled the stored preference and required CAPA; rejected identity mutation.
- Static DBA audit found no remaining critical issue in reviewed write blocks.
- Validated five frontmatters, 25 Markdown-only files, 88 bundled relative links,
  balanced fences and final reference sections. System skill validator lacked
  PyYAML; equivalent package checks used Ruby's standard YAML library instead.
- Archive integrity check passed; runtime dependencies remain external.

```sh
# Development checks are outside the shipped archive.
ruby discovery/skill-package/validate.rb
unzip -t dist/hg-mem-skills-v1.zip
shasum -a 256 dist/hg-mem-skills-v1.zip
# Expected archive SHA-256:
# 7a2eb6d3d469262c79b202392ed33575358ff2da2cc6fc0239a9dc71b6f14479
```

## References

- [Packaged skill archive](../../dist/hg-mem-skills-v1.zip)
- [Root skill and operational routing](../../skill/hg-mem/SKILL.md)
- [SQLite CLI runtime and inline block loader](../../skill/hg-mem/references/runtime.md)
- [Version-one schema and lifecycle contract](../../skill/hg-mem/references/schema.md)
- [End-to-end CLI check harness](../../discovery/skill-package/check.sh)
- [Failure, scope, time and rebuild checks](../../discovery/skill-package/guards.sh)
- [Independent authoring and recall evaluation](../../discovery/skill-package/semantics-eval/EVAL_REPORT.md)
