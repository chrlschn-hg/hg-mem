# Read recipe (standalone)

Does not use the eligibility prefix: an exact public-id read returns the record in **any** status
(active, retired, retracted) and any scope, with its direct edges. Request key: `id`.

```text
# Missing, non-text or unknown id is an error, not an empty result.
# Retracted means withdrawn as mistaken; do not present it as a current fact.
# Reading a Memory's source_ref file is a separate step (see SKILL.md).
```

```sql
PRAGMA foreign_keys=ON;
BEGIN;
.headers on
.mode json
CREATE TEMP TABLE _rd_chk(x);
CREATE TEMP TRIGGER _rd_chk_t BEFORE INSERT ON _rd_chk BEGIN SELECT RAISE(ABORT, 'read: request id missing, not a string, or unknown'); END;
CREATE TEMP TABLE _rd_seed AS
  SELECT n.nid, n.id FROM hg_node n WHERE json_valid(@p) AND json_type(@p, '$.id') = 'text' AND n.id = json_extract(@p, '$.id');
INSERT INTO _rd_chk SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM _rd_seed);

SELECT m.*, (SELECT group_concat(l.label, ':') FROM node_labels l WHERE l.node_id = m.nid) AS labels
FROM hg_memory m JOIN _rd_seed s ON s.nid = m.nid;

SELECT n.*, (SELECT group_concat(l.label, ':') FROM node_labels l WHERE l.node_id = n.nid) AS labels
FROM hg_node n JOIN _rd_seed s ON s.nid = n.nid
WHERE NOT EXISTS (SELECT 1 FROM hg_memory m WHERE m.nid = n.nid);

SELECT 'out' AS direction, e.type, o.id AS other_id, o.name AS other_name
FROM edges e JOIN _rd_seed s ON s.nid = e.source_id JOIN hg_node o ON o.nid = e.target_id
UNION ALL
SELECT 'in', e.type, o.id, o.name
FROM edges e JOIN _rd_seed s ON s.nid = e.target_id JOIN hg_node o ON o.nid = e.source_id
ORDER BY 1, 2, 3;
COMMIT;
```

## References

- [Record layout, status and time fields](../../hg-mem/references/schema.md)
- [SQLite CLI parameters and dot commands](https://sqlite.org/cli.html)
