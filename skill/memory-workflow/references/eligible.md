# Eligible retrieval snapshot

Prepend to search, directives or navigation; those recipes finish the transaction.
Request: canonical `cwd`, optional `scopes` array of project/session IDs, UTC `at`,
`limit` (1–500), `offset` (>=0), `depth` (1–3). Resolve cwd with `pwd -P` first.

```sql
PRAGMA foreign_keys=ON;
BEGIN;
CREATE TEMP TABLE _guard(ok INTEGER NOT NULL CHECK(ok=1));
INSERT INTO _guard VALUES((SELECT count(*)=1 AND min(version)=1 FROM hg_meta));
INSERT INTO _guard VALUES(json_valid(@p) AND json_type(@p)='object');
CREATE TEMP TABLE _ctx AS SELECT json(@p) AS p,
 json_extract(@p,'$.cwd') AS cwd,
 coalesce(json_extract(@p,'$.at'),strftime('%Y-%m-%dT%H:%M:%SZ','now')) AS at,
 json_type(@p,'$.at') IS NOT NULL AS history,
 coalesce(json_extract(@p,'$.limit'),50) AS lim,
 coalesce(json_extract(@p,'$.offset'),0) AS off,
 coalesce(json_extract(@p,'$.depth'),2) AS depth;
INSERT INTO _guard SELECT typeof(cwd)='text' AND substr(cwd,1,1)='/'
 AND (cwd='/' OR substr(cwd,-1)<>'/') AND instr(cwd,'//')=0
 AND instr(cwd||'/','/../')=0 AND instr(cwd||'/','/./')=0
 AND typeof(at)='text' AND strftime('%Y-%m-%dT%H:%M:%SZ',at)=at
 AND typeof(lim)='integer' AND lim BETWEEN 1 AND 500
 AND typeof(off)='integer' AND off>=0
 AND typeof(depth)='integer' AND depth BETWEEN 1 AND 3 FROM _ctx;
INSERT INTO _guard VALUES(json_type(@p,'$.scopes') IS NULL OR json_type(@p,'$.scopes')='array');
-- An explicit unknown scope is an error, never a request for broader retrieval.
INSERT INTO _guard SELECT NOT EXISTS(
 SELECT 1 FROM json_each(coalesce(json_extract(@p,'$.scopes'),'[]')) j
 WHERE j.type<>'text' OR NOT EXISTS(
  SELECT 1 FROM hg_node s JOIN node_labels l ON l.node_id=s.nid AND l.label='Scope'
  WHERE s.id=j.value AND (s.scope_kind IN ('global','project','session') OR
   (s.scope_kind='directory' AND (s.root='/' OR (SELECT cwd FROM _ctx)=s.root
    OR substr((SELECT cwd FROM _ctx),1,length(s.root)+1)=s.root||'/')))));
CREATE TEMP TABLE _scope AS
 SELECT s.nid FROM hg_node s JOIN node_labels l ON l.node_id=s.nid AND l.label='Scope'
 WHERE s.scope_kind='global'
 OR (s.scope_kind='directory' AND (s.root='/' OR (SELECT cwd FROM _ctx)=s.root
   OR substr((SELECT cwd FROM _ctx),1,length(s.root)+1)=s.root||'/'))
 OR (s.scope_kind IN ('project','session') AND s.id IN
   (SELECT value FROM json_each(coalesce(json_extract(@p,'$.scopes'),'[]'))));
CREATE TEMP VIEW _eligible AS SELECT m.*,
 CASE WHEN m.valid_from IS NULL THEN 'POSSIBLE' ELSE 'APPLIES' END AS validity
 FROM hg_memory m CROSS JOIN _ctx c
 WHERE (CASE WHEN c.history THEN m.status<>'retracted' ELSE m.status='active' END)
 AND (m.valid_from IS NULL OR m.valid_from<=c.at)
 AND (m.valid_to IS NULL OR m.valid_to>c.at)
 AND EXISTS(SELECT 1 FROM edges e JOIN _scope s ON s.nid=e.target_id
   WHERE e.source_id=m.nid AND e.type='APPLIES_TO');
```

## References

- [Scope, validity and required-inventory semantics](schema.md)
- [SQLite CLI request binding](runtime.md)
