# Replace: validate endpoints

Request `{"old":"old-id","new":{...create request...}}`. New ID, same purpose,
same exact scope-ID set, effective now. Append create, replace-link, then commit.
Reject future/narrower/broader/unknown-start replacements before mutation.

```sql
INSERT INTO _guard VALUES(NOT EXISTS(SELECT 1 FROM json_each(@p) WHERE key NOT IN ('old','new')));
INSERT INTO _guard VALUES(json_type(@p,'$.old')='text' AND json_type(@p,'$.new')='object');
CREATE TEMP TABLE _old AS SELECT m.* FROM hg_memory m,_request r
 WHERE m.id=json_extract(r.p,'$.old') AND m.status='active'
 AND m.valid_from IS NOT NULL AND m.valid_from<r.now
 AND (m.valid_to IS NULL OR m.valid_to>r.now);
INSERT INTO _guard VALUES((SELECT count(*)=1 FROM _old));
INSERT INTO _guard VALUES((SELECT purpose FROM _old)=json_extract(@p,'$.new.kind'));
INSERT INTO _guard VALUES(json_type(@p,'$.new.valid_from') IS NULL
 AND json_type(@p,'$.new.unknown_start') IS NULL);
INSERT INTO _guard VALUES(NOT EXISTS(
 SELECT s.id FROM edges e JOIN _old o ON o.nid=e.source_id JOIN hg_node s ON s.nid=e.target_id
 WHERE e.type='APPLIES_TO' EXCEPT SELECT value FROM json_each(@p,'$.new.scopes')));
INSERT INTO _guard VALUES(NOT EXISTS(
 SELECT value FROM json_each(@p,'$.new.scopes') EXCEPT
 SELECT s.id FROM edges e JOIN _old o ON o.nid=e.source_id JOIN hg_node s ON s.nid=e.target_id
 WHERE e.type='APPLIES_TO'));
-- Change only the bound JSON envelope, not interpolated SQL/Cypher.
UPDATE temp.sqlite_parameters SET value=json_extract(@p,'$.new') WHERE key='@p';
UPDATE _request SET p=json(@p);
```

## References

- [New-memory creation block](create.md)
- [Link and close predecessor](replace-link.md)
- [Conservative scope and lifecycle contract](../../memory-workflow/references/schema.md)
