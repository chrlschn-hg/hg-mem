# Search recipe

Runs after the shared eligibility prefix. Request keys: `query` (raw text), plus the common
`cwd`, `scopes`, `at`, `limit`, `offset`. The raw query is only bound as `@p`; it is tokenized by
SQLite itself, never spliced into SQL.

```text
# Tokens: unicode61 remove_diacritics 2 (must match hg_fts), each token quoted with a prefix *, joined with OR.
# Example: arch -> "arch"* finds architecture. The * is outside the quotes.
# No stemming, synonyms, expansion or fuzzy rewrite. Empty token list is an error.
# Ranked rows are joined to _eligible BEFORE LIMIT/OFFSET; BM25 then public id breaks ties.
# Hits are candidates from titles/contents (summaries), not source-supported answers.
# This is not the directive channel: use directives.md.
```

```sql
.headers on
.mode json
CREATE TEMP TABLE _rq_chk(x);
CREATE TEMP TRIGGER _rq_chk_t BEFORE INSERT ON _rq_chk BEGIN SELECT RAISE(ABORT, 'search: query has no searchable tokens'); END;
CREATE VIRTUAL TABLE temp._qt USING fts5(t, tokenize='unicode61 remove_diacritics 2');
INSERT INTO temp._qt(rowid, t) VALUES (1, CAST(json_extract(@p, '$.query') AS TEXT));
CREATE VIRTUAL TABLE temp._qv USING fts5vocab('_qt', 'row');
CREATE TEMP TABLE _qm AS
  SELECT group_concat('"' || replace(term, '"', '""') || '"*', ' OR ') AS q FROM (SELECT term FROM temp._qv ORDER BY term);
INSERT INTO _rq_chk SELECT 1 WHERE (SELECT q FROM _qm) IS NULL;

SELECT count(*) AS total_eligible_matches, (SELECT lim FROM _ctx) AS "limit", (SELECT off FROM _ctx) AS "offset",
       (SELECT q FROM _qm) AS match_expression
FROM hg_fts JOIN _eligible e ON e.nid = hg_fts.rowid
WHERE hg_fts MATCH (SELECT q FROM _qm);

SELECT e.id, e.purpose, e.required, e.status, e.validity, e.title, substr(e.content, 1, 240) AS excerpt,
       e.source_ref, round(bm25(hg_fts), 4) AS score,
       json((SELECT coalesce(json_group_array(json(g) ORDER BY d DESC, id), json('[]')) FROM ( WITH RECURSIVE up(nid, depth) AS ( SELECT efp.target_id, 0 FROM edges efp WHERE efp.source_id = e.nid AND efp.type = 'FILED_UNDER' UNION ALL SELECT chp.target_id, up.depth + 1 FROM up JOIN edges chp ON chp.source_id = up.nid AND chp.type = 'CHILD_OF' WHERE up.depth < 2) SELECT json_object('id', n.id, 'name', coalesce(n.title, n.name), 'label', (SELECT l.label FROM hg_label l WHERE l.nid = n.nid AND l.label IN ('Domain', 'Area', 'Topic'))) AS g, u.d AS d, n.id AS id FROM (SELECT nid, max(depth) AS d FROM up GROUP BY nid) u JOIN hg_node n ON n.nid = u.nid))) AS filing_path,
       json((SELECT json_object('id', tf.id, 'name', tf.name, 'label', (SELECT l.label FROM hg_label l WHERE l.nid = tf.nid AND l.label IN ('Domain', 'Area', 'Topic'))) FROM edges ef JOIN hg_node tf ON tf.nid = ef.target_id WHERE ef.source_id = e.nid AND ef.type = 'FILED_UNDER' ORDER BY tf.id LIMIT 1)) AS filing,
       json((SELECT json_object('id', o.id, 'name', coalesce(o.title, o.name), 'label', 'Operator') FROM edges eab JOIN hg_node o ON o.nid = eab.target_id JOIN hg_label l ON l.nid = o.nid AND l.label = 'Operator' WHERE eab.source_id = e.nid AND eab.type = 'ABOUT' ORDER BY o.id LIMIT 1)) AS subject,
       json((SELECT coalesce(json_group_array(json(sc) ORDER BY sid), json('[]')) FROM ( SELECT json_object('id', sn.id, 'name', sn.name, 'kind', sn.scope_kind, 'root', sn.root, 'matched', json(CASE WHEN EXISTS (SELECT 1 FROM _scope x WHERE x.nid = sn.nid) THEN 'true' ELSE 'false' END)) AS sc, sn.id AS sid FROM edges esc JOIN hg_node sn ON sn.nid = esc.target_id WHERE esc.source_id = e.nid AND esc.type = 'APPLIES_TO'))) AS scopes,
       json((SELECT coalesce(json_group_array(json(u.rv) ORDER BY u.ord), json('[]')) FROM (SELECT json_object('id', p1.id, 'title', p1.title, 'status', p1.status, 'validity', CASE WHEN p1.status='retracted' THEN 'RETRACTED' WHEN p1.status<>'active' OR (p1.valid_from IS NOT NULL AND p1.valid_from>strftime('%Y-%m-%dT%H:%M:%SZ','now')) OR (p1.valid_to IS NOT NULL AND p1.valid_to<=strftime('%Y-%m-%dT%H:%M:%SZ','now')) THEN 'INACTIVE' WHEN p1.valid_from IS NULL THEN 'POSSIBLE' ELSE 'APPLIES' END, 'createdAt', p1.created_at, 'validFrom', p1.valid_from, 'validTo', p1.valid_to, 'direction', 'predecessor', 'depth', 1, 'via', '-[SUPERSEDES]-> ' || p1.id) AS rv, 0 AS ord FROM (SELECT ed.target_id AS nid FROM edges ed WHERE ed.source_id = e.nid AND ed.type = 'SUPERSEDES' LIMIT 1) x JOIN hg_memory p1 ON p1.nid = x.nid UNION ALL SELECT json_object('id', s1.id, 'title', s1.title, 'status', s1.status, 'validity', CASE WHEN s1.status='retracted' THEN 'RETRACTED' WHEN s1.status<>'active' OR (s1.valid_from IS NOT NULL AND s1.valid_from>strftime('%Y-%m-%dT%H:%M:%SZ','now')) OR (s1.valid_to IS NOT NULL AND s1.valid_to<=strftime('%Y-%m-%dT%H:%M:%SZ','now')) THEN 'INACTIVE' WHEN s1.valid_from IS NULL THEN 'POSSIBLE' ELSE 'APPLIES' END, 'createdAt', s1.created_at, 'validFrom', s1.valid_from, 'validTo', s1.valid_to, 'direction', 'successor', 'depth', 1, 'via', '<-[SUPERSEDES]- ' || s1.id) AS rv, 1 AS ord FROM (SELECT ed.source_id AS nid FROM edges ed WHERE ed.target_id = e.nid AND ed.type = 'SUPERSEDES' LIMIT 1) y JOIN hg_memory s1 ON s1.nid = y.nid) u)) AS revisions
FROM hg_fts JOIN _eligible e ON e.nid = hg_fts.rowid
WHERE hg_fts MATCH (SELECT q FROM _qm)
ORDER BY bm25(hg_fts), e.id
LIMIT (SELECT lim FROM _ctx) OFFSET (SELECT off FROM _ctx);
COMMIT;
```

## References

- [Request, eligibility and snapshot prefix](../../hg-mem/references/eligible.md)
- [Record layout and retrieval policy](../../hg-mem/references/schema.md)
- [SQLite FTS5 tokenizers, fts5vocab and bm25](https://sqlite.org/fts5.html)
