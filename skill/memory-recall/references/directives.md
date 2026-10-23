# Required-directive inventory recipe

Runs after the shared eligibility prefix. Request keys: common `cwd`, `scopes`, `at`, plus `limit`
(1..500) and `offset`. No query text is used.

```text
# Inventory = _eligible rows with required=1. No FTS, purpose, tag, topic or form filter.
# `total` counts ALL matching rows before pagination; read every page until offset+returned >= total.
# validity shows whether a row is known applicable or only possibly applicable (e.g. unknown start).
# Full bodies are returned; headings alone do not prove a rule was read.
# Conflicting rules are not detected by SQL: compare returned rows and report conflicts to the user.
```

```sql
.headers on
.mode json
SELECT (SELECT count(*) FROM _eligible WHERE required = 1) AS total,
       (SELECT off FROM _ctx) AS "offset", (SELECT lim FROM _ctx) AS "limit",
       (SELECT count(*) FROM _eligible WHERE required = 1) > (SELECT off + lim FROM _ctx) AS more_pages;

SELECT e.id, e.purpose, e.validity, e.status, e.assertion_kind, e.asserted_by, e.valid_from, e.valid_to,
       e.source_ref, e.title, e.content,
       (SELECT group_concat(s.id, ',') FROM edges ed JOIN hg_node s ON s.nid = ed.target_id
         WHERE ed.source_id = e.nid AND ed.type = 'APPLIES_TO') AS scope_ids
FROM _eligible e
WHERE e.required = 1
ORDER BY e.id
LIMIT (SELECT lim FROM _ctx) OFFSET (SELECT off FROM _ctx);
COMMIT;
```

## References

- [Request, eligibility and snapshot prefix](../../memory-workflow/references/eligible.md)
- [Authority, time and required-inventory policy](../../memory-workflow/references/schema.md)
