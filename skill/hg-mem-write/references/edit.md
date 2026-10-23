# Presentation-only edit

Request `id`, `meaning_unchanged:true`, and text `title`, `content` or `source_ref`.
For changed meaning, replace instead. No identity, scope, authority or validity edits.

```sql
INSERT INTO _guard VALUES(NOT EXISTS(SELECT 1 FROM json_each(@p)
 WHERE key NOT IN ('id','meaning_unchanged','title','content','source_ref')));
INSERT INTO _guard VALUES(json_type(@p,'$.meaning_unchanged')='true');
INSERT INTO _guard VALUES((SELECT count(*)=1 FROM hg_memory WHERE id=json_extract(@p,'$.id')));
INSERT INTO _guard VALUES(NOT EXISTS(SELECT 1 FROM json_each(@p)
 WHERE key IN ('title','content','source_ref') AND type<>'text'));
SELECT cypher('MATCH (m:Memory {id:$id}) SET m += $props',
 json_object('id',json_extract(p,'$.id'),'props',json_patch(json_object('updated_at',now),
 json_patch(CASE WHEN json_type(p,'$.title')='text' THEN json_object('title',json_extract(p,'$.title')) ELSE '{}' END,
 json_patch(CASE WHEN json_type(p,'$.content')='text' THEN json_object('content',json_extract(p,'$.content')) ELSE '{}' END,
 CASE WHEN json_type(p,'$.source_ref')='text' THEN json_object('source_ref',json_extract(p,'$.source_ref')) ELSE '{}' END)))))
 FROM _request;
INSERT INTO _result VALUES(json_extract(@p,'$.id'),'edit');
```

## References

- [Replacement for meaning changes](replace-start.md)
- [Lifecycle and identity rules](../../hg-mem/references/schema.md)
