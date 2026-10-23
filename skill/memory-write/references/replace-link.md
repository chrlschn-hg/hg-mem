# Replace: link and close

Run after replace-start and create in the same connection.

```sql
SELECT cypher('MATCH (m:Memory {id:$id}) SET m.valid_to=$now, m.updated_at=$now',
 json_object('id',o.id,'now',r.now)) FROM _old o CROSS JOIN _request r;
SELECT cypher('MATCH (n:Memory {id:$id}),(o:Memory {id:$old}) CREATE (n)-[:SUPERSEDES]->(o)',
 json_object('id',json_extract(@p,'$.id'),'old',id)) FROM _old;
UPDATE _result SET operation='replace';
```

## References

- [Replacement preconditions](replace-start.md)
- [Final validation and atomic search rebuild](commit.md)
