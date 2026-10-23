# Rebuild the derived FTS index

Run only for an existing managed database when rebuild is requested and graph validation passes. The transaction changes `hg_fts` only. Any SQL, validation, integrity, or agreement failure stops the `-bail` CLI; closing it rolls back the open transaction.

```sql
PRAGMA foreign_keys=ON;
BEGIN IMMEDIATE;

SELECT code, nid, detail
FROM hg_violation
ORDER BY code, nid, detail;

CREATE TEMP TABLE temp_guard (
  ok INTEGER NOT NULL CHECK (ok = 1)
);

-- Check metadata and the graph before touching the derived index.
INSERT INTO temp_guard(ok)
SELECT CASE WHEN
  (SELECT COUNT(*) FROM hg_meta) = 1
  AND (SELECT COUNT(*) FROM hg_meta WHERE version = 1) = 1
  AND NOT EXISTS (SELECT 1 FROM hg_violation
    WHERE code NOT IN ('fts_missing','fts_extra','fts_stale'))
THEN 1 ELSE 0 END;

DELETE FROM hg_fts;

INSERT INTO hg_fts(rowid, title, content)
SELECT nid, title, content
FROM hg_memory
ORDER BY nid;

INSERT INTO hg_fts(hg_fts) VALUES('integrity-check');
INSERT INTO temp_guard(ok) SELECT NOT EXISTS(SELECT 1 FROM hg_violation);

-- Verify the rebuilt FTS rows equal the graph projection in both directions.
INSERT INTO temp_guard(ok)
SELECT CASE WHEN
  NOT EXISTS (
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

SELECT 'rebuild_ok' AS result, COUNT(*) AS fts_rows
FROM hg_fts;

COMMIT;
```

## References

- [Verify graph and index agreement](verify.md)
- [Graph-canonical search contract](../../hg-mem/references/schema.md)
