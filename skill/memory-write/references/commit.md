# Validate and commit

```sql
-- Graph validation covers the whole small store, including endpoint cardinality.
SELECT * FROM hg_violation WHERE code NOT IN ('fts_missing','fts_extra','fts_stale');
INSERT INTO _guard VALUES(NOT EXISTS(SELECT 1 FROM hg_violation
 WHERE code NOT IN ('fts_missing','fts_extra','fts_stale')));
DELETE FROM hg_fts;
INSERT INTO hg_fts(rowid,title,content) SELECT nid,title,content FROM hg_memory;
INSERT INTO hg_fts(hg_fts) VALUES('integrity-check');
INSERT INTO _guard VALUES(NOT EXISTS(SELECT 1 FROM hg_violation));
INSERT INTO _guard VALUES(NOT EXISTS(
 SELECT nid,title,content FROM hg_memory EXCEPT SELECT rowid,title,content FROM hg_fts));
INSERT INTO _guard VALUES(NOT EXISTS(
 SELECT rowid,title,content FROM hg_fts EXCEPT SELECT nid,title,content FROM hg_memory));
COMMIT;
.mode json
SELECT id,operation FROM _result;
```

## References

- [Begin and preconditions](begin.md)
- [Graph and derived-search contract](../../memory-workflow/references/schema.md)
