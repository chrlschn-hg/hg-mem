# Retire now

Request `{"id":"..."}`. This action explicitly ends applicability now; it does
not infer a historical end from recording time. Future-start retirement is rejected.
End must follow start at UTC-second precision; same-second retirement may be rejected.

```sql
INSERT INTO _guard VALUES(NOT EXISTS(SELECT 1 FROM json_each(@p) WHERE key<>'id'));
INSERT INTO _guard VALUES((SELECT count(*)=1 FROM hg_memory,_request
 WHERE id=json_extract(p,'$.id') AND status='active'
 AND (valid_from IS NULL OR valid_from<now) AND (valid_to IS NULL OR valid_to>now)));
SELECT cypher('MATCH (m:Memory {id:$id}) SET m.status=$status, m.valid_to=$now, m.updated_at=$now',
 json_object('id',json_extract(p,'$.id'),'status','retired','now',now)) FROM _request;
INSERT INTO _result VALUES(json_extract(@p,'$.id'),'retire');
```

## References

- [Retirement versus retraction semantics](../../memory-workflow/references/schema.md)
- [Retracting a mistaken assertion](retract.md)
