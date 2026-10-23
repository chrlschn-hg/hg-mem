# Retract an assertion

Request `{"id":"..."}`. Withdraw accepted truth; preserve its record and sources.
Does not reopen predecessors or reconstruct historical beliefs.

```sql
INSERT INTO _guard VALUES(NOT EXISTS(SELECT 1 FROM json_each(@p) WHERE key<>'id'));
INSERT INTO _guard VALUES((SELECT count(*)=1 FROM hg_memory
 WHERE id=json_extract(@p,'$.id') AND status<>'retracted'));
SELECT cypher('MATCH (m:Memory {id:$id}) SET m.status=$status, m.updated_at=$now',
 json_object('id',json_extract(p,'$.id'),'status','retracted','now',now)) FROM _request;
INSERT INTO _result VALUES(json_extract(@p,'$.id'),'retract');
```

## References

- [Accepted truth versus retained evidence](../../hg-mem/references/schema.md)
- [Retiring a formerly applicable record](retire.md)
