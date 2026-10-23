# Navigate recipe

Runs after the shared eligibility prefix. Request keys: `id` (seed public id), `depth` (1..3), common
`cwd`, `scopes`, `at`, `limit`, `offset`.

```text
# Edge types only: FILED_UNDER, CHILD_OF, ABOUT, SUPERSEDES; followed in both directions.
# Seed must exist; a Memory seed must be eligible (else error). Context nodes (Domain/Area/Topic/Operator)
# are always traversable. Any Memory that is not eligible is skipped, including as an intermediate.
# Filing and ancestry give context, not applicability. Public ids are deduplicated (shortest path)
# before LIMIT/OFFSET. `via` explains the path.
```

```sql
.headers on
.mode json
CREATE TEMP TABLE _nv_chk(x);
CREATE TEMP TRIGGER _nv_chk_t BEFORE INSERT ON _nv_chk BEGIN SELECT RAISE(ABORT, 'navigate: seed missing, not a string, or not eligible'); END;
CREATE TEMP TABLE _nv_seed AS
  SELECT n.nid, n.id FROM hg_node n WHERE n.id = json_extract(@p, '$.id') AND json_type(@p, '$.id') = 'text';
INSERT INTO _nv_chk SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM _nv_seed);
INSERT INTO _nv_chk SELECT 1 FROM _nv_seed s
  WHERE EXISTS (SELECT 1 FROM node_labels l WHERE l.node_id = s.nid AND l.label = 'Memory')
    AND NOT EXISTS (SELECT 1 FROM _eligible e WHERE e.nid = s.nid);

CREATE TEMP TABLE _nv_ok AS
  SELECT n.nid FROM hg_node n
   WHERE NOT EXISTS (SELECT 1 FROM node_labels l WHERE l.node_id = n.nid AND l.label = 'Memory')
  UNION SELECT nid FROM _eligible;
CREATE TEMP TABLE _nv_step AS
  SELECT source_id AS a, target_id AS b, '-[' || type || ']->' AS arrow FROM edges
   WHERE type IN ('FILED_UNDER', 'CHILD_OF', 'ABOUT', 'SUPERSEDES')
  UNION ALL
  SELECT target_id, source_id, '<-[' || type || ']-' FROM edges
   WHERE type IN ('FILED_UNDER', 'CHILD_OF', 'ABOUT', 'SUPERSEDES');

CREATE TEMP TABLE _nv_found AS
WITH RECURSIVE walk(nid, id, depth, path, via) AS (
  SELECT nid, id, 0, '|' || id || '|', id FROM _nv_seed
  UNION ALL
  SELECT n.nid, n.id, w.depth + 1, w.path || n.id || '|', w.via || ' ' || st.arrow || ' ' || n.id
  FROM walk w
  JOIN _nv_step st ON st.a = w.nid
  JOIN _nv_ok ok ON ok.nid = st.b
  JOIN hg_node n ON n.nid = st.b
  WHERE w.depth < (SELECT depth FROM _ctx) AND instr(w.path, '|' || n.id || '|') = 0
),
ranked AS (
  SELECT nid, id, depth, via, row_number() OVER (PARTITION BY nid ORDER BY depth, via) AS rn FROM walk WHERE depth > 0
)
SELECT nid, id, depth, via FROM ranked WHERE rn = 1;

SELECT (SELECT id FROM _nv_seed) AS seed, count(*) AS total_reachable, (SELECT depth FROM _ctx) AS max_depth,
       (SELECT lim FROM _ctx) AS "limit", (SELECT off FROM _ctx) AS "offset"
FROM _nv_found;

SELECT f.id, f.depth,
       (SELECT group_concat(l.label, ':') FROM node_labels l WHERE l.node_id = f.nid) AS labels,
       coalesce(m.title, n.name) AS title_or_name, m.required, m.status, m.validity, f.via
FROM _nv_found f
JOIN hg_node n ON n.nid = f.nid
LEFT JOIN _eligible m ON m.nid = f.nid
ORDER BY f.depth, f.id
LIMIT (SELECT lim FROM _ctx) OFFSET (SELECT off FROM _ctx);
COMMIT;
```

## References

- [Request, eligibility and snapshot prefix](../../memory-workflow/references/eligible.md)
- [Typed edges, taxonomy and applicability policy](../../memory-workflow/references/schema.md)
- [SQLite recursive common table expressions](https://sqlite.org/lang_with.html)
