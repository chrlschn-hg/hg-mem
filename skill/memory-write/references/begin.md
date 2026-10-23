# Begin a write

Prepend to exactly one mutation recipe, then append commit. A failed assertion
aborts the CLI connection; the open transaction rolls back.

```sql
PRAGMA foreign_keys=ON;
BEGIN IMMEDIATE;
CREATE TEMP TABLE _guard(ok INTEGER NOT NULL CHECK(ok=1));
INSERT INTO _guard VALUES((SELECT count(*)=1 AND min(version)=1 FROM hg_meta));
INSERT INTO _guard VALUES(json_valid(@p) AND json_type(@p)='object');
INSERT INTO _guard VALUES(NOT EXISTS(SELECT 1 FROM hg_violation));
INSERT INTO hg_fts(hg_fts) VALUES('integrity-check');
INSERT INTO _guard VALUES(NOT EXISTS(
 SELECT nid,title,content FROM hg_memory EXCEPT SELECT rowid,title,content FROM hg_fts));
INSERT INTO _guard VALUES(NOT EXISTS(
 SELECT rowid,title,content FROM hg_fts EXCEPT SELECT nid,title,content FROM hg_memory));
CREATE TEMP TABLE _request AS SELECT json(@p) AS p,strftime('%Y-%m-%dT%H:%M:%SZ','now') AS now;
CREATE TEMP TABLE _result(id TEXT NOT NULL, operation TEXT NOT NULL);
```

## References

- [Commit and atomic search maintenance](commit.md)
- [Version-one invariants](../../memory-workflow/references/schema.md)
