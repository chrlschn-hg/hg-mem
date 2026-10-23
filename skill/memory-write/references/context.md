# Create context

Request keys: `id`, `label`, `name`; Scope adds `kind`, optional directory `root`;
Area/Topic add `parent`. Use an explicit existing Operator for user assertions.

```sql
INSERT INTO _guard VALUES(NOT EXISTS(SELECT 1 FROM json_each(@p)
 WHERE key NOT IN ('id','label','name','kind','root','parent')));
INSERT INTO _guard VALUES(json_extract(@p,'$.label') IN ('Operator','Scope','Domain','Area','Topic'));
INSERT INTO _guard VALUES(NOT EXISTS(SELECT 1 FROM json_each(@p) WHERE type<>'text'));
INSERT INTO _guard VALUES(json_type(@p,'$.parent') IS NULL OR json_extract(@p,'$.label') IN ('Area','Topic'));
INSERT INTO _guard VALUES((json_type(@p,'$.kind') IS NULL AND json_type(@p,'$.root') IS NULL)
 OR json_extract(@p,'$.label')='Scope');
INSERT INTO _guard VALUES(NOT EXISTS(SELECT 1 FROM hg_node WHERE id=json_extract(@p,'$.id')));
CREATE TEMP TABLE _context AS SELECT json_object('id',json_extract(p,'$.id'),
 'props',json_patch(json_object('name',json_extract(p,'$.name')),
  CASE WHEN json_extract(p,'$.label')='Scope'
   THEN json_object('kind',json_extract(p,'$.kind'),'root',json_extract(p,'$.root'))
   ELSE '{}' END)) AS p FROM _request;
SELECT cypher(CASE json_extract(@p,'$.label')
 WHEN 'Operator' THEN 'CREATE (n:Operator {id:$id}) SET n += $props'
 WHEN 'Scope' THEN 'CREATE (n:Scope {id:$id}) SET n += $props'
 WHEN 'Domain' THEN 'CREATE (n:Domain {id:$id}) SET n += $props'
 WHEN 'Area' THEN 'CREATE (n:Area {id:$id}) SET n += $props'
 WHEN 'Topic' THEN 'CREATE (n:Topic {id:$id}) SET n += $props' END,p) FROM _context;
SELECT cypher('MATCH (n {id:$id}), (p {id:$parent}) CREATE (n)-[:CHILD_OF]->(p)',@p)
 WHERE json_extract(@p,'$.label') IN ('Area','Topic');
INSERT INTO _result VALUES(json_extract(@p,'$.id'),'context');
```

## References

- [Transaction preconditions](begin.md)
- [Taxonomy, subjects and scope nodes](../../memory-workflow/references/schema.md)
