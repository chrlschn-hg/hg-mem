# Verify graph and FTS agreement

This is read-only apart from the temporary assertion guard and FTS5's non-persistent `integrity-check` command. It prints graph violations and both directions of row drift before asserting schema and index consistency. With `hgsql`'s `-bail`, a failed guard exits nonzero; closing the CLI rolls back the open transaction.

```sql
PRAGMA foreign_keys=ON;
BEGIN;

SELECT code, nid, detail
FROM hg_violation
ORDER BY code, nid, detail;

SELECT 'missing_from_hg_fts' AS issue, drift.nid, drift.title, drift.content
FROM (
  SELECT nid, title, content FROM hg_memory
  EXCEPT
  SELECT rowid, title, content FROM hg_fts
) AS drift
ORDER BY drift.nid;

SELECT 'extra_in_hg_fts' AS issue, drift.nid, drift.title, drift.content
FROM (
  SELECT rowid AS nid, title, content FROM hg_fts
  EXCEPT
  SELECT nid, title, content FROM hg_memory
) AS drift
ORDER BY drift.nid;

INSERT INTO hg_fts(hg_fts) VALUES('integrity-check');

CREATE TEMP TABLE temp_guard (
  ok INTEGER NOT NULL CHECK (ok = 1)
);

INSERT INTO temp_guard(ok)
SELECT CASE WHEN
  (SELECT COUNT(*) FROM hg_meta) = 1
  AND (SELECT COUNT(*) FROM hg_meta WHERE version = 1) = 1
  AND NOT EXISTS (SELECT 1 FROM hg_violation)
  AND NOT EXISTS (
    SELECT nid, title, content FROM hg_memory
    EXCEPT
    SELECT rowid, title, content FROM hg_fts
  )
  AND NOT EXISTS (
    SELECT rowid, title, content FROM hg_fts
    EXCEPT
    SELECT nid, title, content FROM hg_memory
  )
THEN 1 ELSE 0 END;

SELECT 'verify_ok' AS result FROM temp_guard;
ROLLBACK;
```

## References

- [Graph invariants and derived search state](../../hg-mem/references/schema.md)
- [Rebuild search after confirmed projection drift](rebuild.md)
