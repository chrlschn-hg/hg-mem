# Create a memory

Request: `id`, `kind` (Persona/CAPA/Operational), `title`, `content`, `asserted_by`,
`assertion_kind`, boolean `required`, `scopes` IDs; optional `filing`, `subject`,
`source_ref`, `valid_from`, `valid_to`, boolean `unknown_start`.
Default start is explicitly activated now. Unknown start must be requested.

```sql
INSERT INTO _guard VALUES(NOT EXISTS(SELECT 1 FROM json_each(@p) WHERE key NOT IN
 ('id','kind','title','content','asserted_by','assertion_kind','required','scopes',
  'filing','subject','source_ref','valid_from','valid_to','unknown_start')));
INSERT INTO _guard VALUES(json_extract(@p,'$.kind') IN ('Persona','CAPA','Operational'));
INSERT INTO _guard VALUES(json_type(@p,'$.required') IN ('true','false'));
INSERT INTO _guard VALUES(NOT EXISTS(SELECT 1 FROM json_each(@p)
 WHERE key IN ('id','kind','title','content','asserted_by','assertion_kind',
 'source_ref','valid_from','valid_to','filing','subject') AND type<>'text'));
INSERT INTO _guard VALUES(json_type(@p,'$.unknown_start') IS NULL
 OR json_type(@p,'$.unknown_start') IN ('true','false'));
INSERT INTO _guard VALUES(json_type(@p,'$.scopes')='array' AND json_array_length(@p,'$.scopes')>0);
INSERT INTO _guard VALUES(NOT EXISTS(SELECT 1 FROM hg_node WHERE id=json_extract(@p,'$.id')));
INSERT INTO _guard VALUES(NOT (json_extract(@p,'$.unknown_start')=1 AND json_type(@p,'$.valid_from') IS NOT NULL)
 OR json_extract(@p,'$.unknown_start') IS NULL);
INSERT INTO _guard VALUES(NOT EXISTS(SELECT 1 FROM json_each(@p,'$.scopes') s
 WHERE s.type<>'text' OR NOT EXISTS(SELECT 1 FROM hg_node n JOIN node_labels l ON l.node_id=n.nid
  WHERE n.id=s.value AND l.label='Scope')));
CREATE TEMP TABLE _create AS SELECT json_object('id',json_extract(p,'$.id'),
 'props',json_patch(json_object('title',json_extract(p,'$.title'),'content',json_extract(p,'$.content'),
 'created_at',now,'updated_at',now,'asserted_by',json_extract(p,'$.asserted_by'),
 'assertion_kind',json_extract(p,'$.assertion_kind'),
 'required',json(CASE WHEN json_extract(p,'$.required') THEN 'true' ELSE 'false' END),
 'status','active'),json_patch(
 CASE WHEN json_extract(p,'$.unknown_start')=1 THEN '{}' ELSE
  json_object('valid_from',coalesce(json_extract(p,'$.valid_from'),now)) END,
 json_patch(CASE WHEN json_type(p,'$.valid_to')='text' THEN json_object('valid_to',json_extract(p,'$.valid_to')) ELSE '{}' END,
 CASE WHEN json_type(p,'$.source_ref')='text' THEN json_object('source_ref',json_extract(p,'$.source_ref')) ELSE '{}' END)))) AS p
 FROM _request;
SELECT cypher(CASE json_extract(@p,'$.kind')
 WHEN 'Persona' THEN 'CREATE (m:Memory:Persona {id:$id}) SET m += $props'
 WHEN 'CAPA' THEN 'CREATE (m:Memory:CAPA {id:$id}) SET m += $props'
 WHEN 'Operational' THEN 'CREATE (m:Memory:Operational {id:$id}) SET m += $props' END,p) FROM _create;
SELECT cypher('MATCH (m:Memory {id:$id}),(s:Scope {id:$scope}) CREATE (m)-[:APPLIES_TO]->(s)',
 json_object('id',json_extract(@p,'$.id'),'scope',value)) FROM json_each(@p,'$.scopes');
SELECT cypher('MATCH (m:Memory {id:$id}),(t {id:$filing}) CREATE (m)-[:FILED_UNDER]->(t)',@p)
 WHERE json_type(@p,'$.filing')='text';
SELECT cypher('MATCH (m:Memory {id:$id}),(s:Operator {id:$subject}) CREATE (m)-[:ABOUT]->(s)',@p)
 WHERE json_type(@p,'$.subject')='text';
-- Missing optional endpoints must fail, rather than silently omit the requested link.
INSERT INTO _guard VALUES(json_type(@p,'$.filing') IS NULL OR EXISTS(
 SELECT 1 FROM edges e JOIN hg_node m ON m.nid=e.source_id JOIN hg_node t ON t.nid=e.target_id
 WHERE m.id=json_extract(@p,'$.id') AND e.type='FILED_UNDER' AND t.id=json_extract(@p,'$.filing')));
INSERT INTO _guard VALUES(json_type(@p,'$.subject') IS NULL OR EXISTS(
 SELECT 1 FROM edges e JOIN hg_node m ON m.nid=e.source_id JOIN hg_node s ON s.nid=e.target_id
 WHERE m.id=json_extract(@p,'$.id') AND e.type='ABOUT' AND s.id=json_extract(@p,'$.subject')));
INSERT INTO _result VALUES(json_extract(@p,'$.id'),'create');
```

## References

- [Required fields and explicit-instruction policy](../../hg-mem/references/schema.md)
- [Atomic transaction preconditions](begin.md)
- [Validation and search maintenance](commit.md)
