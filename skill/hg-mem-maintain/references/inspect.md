# Inspect the selected database

Run through `hgblock` and `hgsql` after loading the shared runtime. This recipe is read-only and reports the schema version, managed schema objects, node-label counts, edge-type counts, and Memory count.

```sql
PRAGMA foreign_keys=ON;
BEGIN;

SELECT version AS schema_version FROM hg_meta;

SELECT type, name, sql
FROM sqlite_schema
WHERE name IN (
  'hg_meta', 'hg_node', 'hg_memory', 'hg_violation', 'hg_fts',
  'node_labels', 'edges'
)
ORDER BY type, name;

SELECT label, COUNT(*) AS node_count
FROM node_labels
GROUP BY label
ORDER BY label;

SELECT type AS edge_type, COUNT(*) AS edge_count
FROM edges
GROUP BY type
ORDER BY type;

SELECT COUNT(*) AS memory_count
FROM hg_memory;

COMMIT;
```

## References

- [Versioned graph and search contract](../../hg-mem/references/schema.md)
- [SQLite CLI session](../../hg-mem/references/runtime.md)
