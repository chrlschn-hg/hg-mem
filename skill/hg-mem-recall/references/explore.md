# Explore recipe

Runs after the shared eligibility prefix (`hg-mem/references/eligible.md`). Request keys: `id` (seed
public id), `relation` (`filing`, `subject` or `revisions`), plus the common `cwd`, `scopes`, `limit`,
`offset`. The the recipe prints the page below from the temp tables it builds.

```text
# Seeds: a Memory (any purpose) or a taxonomy node (Domain, Area, Topic) for filing; a Memory or an
# Operator for subject; a Memory for revisions. Scope seeds and any other combination are rejected.
# filing: memory seed -> memories filed on the same node (eligible only, before LIMIT).
#         taxonomy seed -> memories filed under its subtree (CHILD_OF, at most two levels down).
# subject: Operator seed or memory seed -> memories ABOUT the same Operator (not asserted_by).
# revisions: memory seed (historical allowed) -> SUPERSEDES chain up to three steps each direction;
#            history only, retired and retracted included, no items.
# Current channels need an eligible memory seed. Revision history is not eligibility-filtered.
# Traversal never passes through a hub: each item is at most one edge from its anchor node.
```

```sql
CREATE TEMP TABLE _xp_chk(x);
CREATE TEMP TRIGGER _xp_chk_t BEFORE INSERT ON _xp_chk BEGIN SELECT RAISE(ABORT, 'explore: seed missing, unknown, or unsupported for this relation'); END;
INSERT INTO _xp_chk SELECT 1 WHERE json_type(@p, '$.relation') IS NOT 'text'
  OR coalesce(json_extract(@p, '$.relation') NOT IN ('filing', 'subject', 'revisions'), 1)
  OR json_type(@p, '$.id') IS NOT 'text';
CREATE TEMP TABLE _xp_seed AS
SELECT n.nid AS nid, n.id AS id, coalesce(n.title, n.name) AS name,
  (SELECT l.label FROM hg_label l WHERE l.nid = n.nid
    AND l.label IN ('Persona', 'CAPA', 'Operational', 'Domain', 'Area', 'Topic', 'Operator')) AS label
FROM hg_node n WHERE json_type(@p, '$.id') = 'text' AND n.id = json_extract(@p, '$.id');
INSERT INTO _xp_chk SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM _xp_seed WHERE label IS NOT NULL);
-- Seed/relation matrix: unsupported combinations (for example a Scope seed or an Operator seed for filing) are errors.
INSERT INTO _xp_chk SELECT 1 FROM _xp_seed s WHERE NOT (
  (json_extract(@p, '$.relation') = 'filing' AND s.label IN ('Operational', 'Persona', 'CAPA', 'Domain', 'Area', 'Topic'))
  OR (json_extract(@p, '$.relation') = 'subject' AND s.label IN ('Operational', 'Persona', 'CAPA', 'Operator'))
  OR (json_extract(@p, '$.relation') = 'revisions' AND s.label IN ('Operational', 'Persona', 'CAPA')));
-- Current channels: a memory seed must be eligible in this context.
INSERT INTO _xp_chk SELECT 1 FROM _xp_seed s
WHERE json_extract(@p, '$.relation') <> 'revisions' AND s.label IN ('Operational', 'Persona', 'CAPA')
  AND NOT EXISTS (SELECT 1 FROM _eligible e WHERE e.nid = s.nid);
-- Taxonomy subtree with the typed route from the seed down to each node (CHILD_OF, at most two levels).
CREATE TEMP TABLE _xp_sub AS
WITH RECURSIVE down(nid, depth, path) AS (
  SELECT nid, 0, id FROM _xp_seed WHERE label IN ('Domain', 'Area', 'Topic')
  UNION
  SELECT e.source_id, down.depth + 1, down.path || ' <-[CHILD_OF]- ' || c.id
  FROM down JOIN edges e ON e.target_id = down.nid AND e.type = 'CHILD_OF'
  JOIN hg_node c ON c.nid = e.source_id
  WHERE down.depth < 2)
SELECT nid, min(depth) AS depth, path FROM down GROUP BY nid;
-- Anchor nodes with the typed route from the seed to each anchor (bounded path text, public ids only).
CREATE TEMP TABLE _xp_anchor AS
SELECT u.anchor AS anchor, u.path AS path FROM (
  SELECT nid AS anchor, path FROM _xp_sub WHERE json_extract(@p, '$.relation') = 'filing'
  UNION
  SELECT t.nid, s.id || ' -[FILED_UNDER]-> ' || t.id
  FROM _xp_seed s JOIN edges e ON e.source_id = s.nid AND e.type = 'FILED_UNDER' JOIN hg_node t ON t.nid = e.target_id
  WHERE json_extract(@p, '$.relation') = 'filing' AND s.label IN ('Operational', 'Persona', 'CAPA')
  UNION
  SELECT s.nid, s.id FROM _xp_seed s WHERE json_extract(@p, '$.relation') = 'subject' AND s.label = 'Operator'
  UNION
  SELECT o.nid, s.id || ' -[ABOUT]-> ' || o.id
  FROM _xp_seed s JOIN edges e ON e.source_id = s.nid AND e.type = 'ABOUT' JOIN hg_node o ON o.nid = e.target_id
  WHERE json_extract(@p, '$.relation') = 'subject' AND s.label IN ('Operational', 'Persona', 'CAPA')
) u;
-- Current items: eligible members, one row each, with the full typed route to the member.
CREATE TEMP TABLE _xp_items AS
SELECT e.nid AS nid, min(a.path || ' <-[FILED_UNDER]- ' || e.id) AS via FROM _eligible e
  JOIN edges f ON f.source_id = e.nid AND f.type = 'FILED_UNDER' AND json_extract(@p, '$.relation') = 'filing'
  JOIN _xp_anchor a ON a.anchor = f.target_id
  WHERE e.nid NOT IN (SELECT nid FROM _xp_seed)
  GROUP BY e.nid
UNION ALL
SELECT e.nid, min(a.path || ' <-[ABOUT]- ' || e.id) FROM _eligible e
  JOIN edges f ON f.source_id = e.nid AND f.type = 'ABOUT' AND json_extract(@p, '$.relation') = 'subject'
  JOIN _xp_anchor a ON a.anchor = f.target_id
  WHERE e.nid NOT IN (SELECT nid FROM _xp_seed)
  GROUP BY e.nid;
-- Revision history: SUPERSEDES chain up to three steps each direction (any status, no bodies).
-- Each route starts at the public seed id.
CREATE TEMP TABLE _xp_hist AS
WITH RECURSIVE pred(nid, depth, via) AS (
  SELECT e.target_id, 1, s.id || ' -[SUPERSEDES]-> ' || n.id
  FROM _xp_seed s JOIN edges e ON e.source_id = s.nid AND e.type = 'SUPERSEDES' JOIN hg_node n ON n.nid = e.target_id
  WHERE json_extract(@p, '$.relation') = 'revisions'
  UNION
  SELECT e.target_id, pred.depth + 1, pred.via || ' -[SUPERSEDES]-> ' || n.id
  FROM pred JOIN edges e ON e.source_id = pred.nid AND e.type = 'SUPERSEDES' JOIN hg_node n ON n.nid = e.target_id
  WHERE pred.depth < 3
), succ(nid, depth, via) AS (
  SELECT e.source_id, 1, s.id || ' <-[SUPERSEDES]- ' || n.id
  FROM _xp_seed s JOIN edges e ON e.target_id = s.nid AND e.type = 'SUPERSEDES' JOIN hg_node n ON n.nid = e.source_id
  WHERE json_extract(@p, '$.relation') = 'revisions'
  UNION
  SELECT e.source_id, succ.depth + 1, succ.via || ' <-[SUPERSEDES]- ' || n.id
  FROM succ JOIN edges e ON e.target_id = succ.nid AND e.type = 'SUPERSEDES' JOIN hg_node n ON n.nid = e.source_id
  WHERE succ.depth < 3
)
SELECT nid, depth, via, 'predecessor' AS direction FROM pred
UNION ALL SELECT nid, depth, via, 'successor' FROM succ;

-- Page output (one JSON document, printed by this recipe): seed, relation, total, offset, limit,
-- contextLabel, items (eligible members with their typed route), history (revisions only).
.headers off
.mode list
SELECT json_object(
'seed', json((SELECT json_object('id', s.id, 'name', s.name, 'label', s.label) FROM _xp_seed s)),
'relation', json_extract(@p, '$.relation'),
'total', CASE WHEN json_extract(@p, '$.relation') = 'revisions'
THEN (SELECT count(*) FROM _xp_hist) ELSE (SELECT count(*) FROM _xp_items) END,
'offset', (SELECT off FROM _ctx),
'limit', (SELECT lim FROM _ctx),
'contextLabel', 'explore ' || json_extract(@p, '$.relation'),
'items', json(coalesce((SELECT json_group_array(json(x) ORDER BY rk) FROM (
SELECT json_object('memory', json(json_object(
'id', e.id, 'title', e.title, 'content', e.content, 'purpose', e.purpose,
'required', json(CASE WHEN e.required=1 THEN 'true' ELSE 'false' END),
'status', e.status, 'createdAt', e.created_at, 'updatedAt', e.updated_at,
'assertedBy', e.asserted_by, 'assertionKind', e.assertion_kind,
'sourceRef', e.source_ref, 'validFrom', e.valid_from, 'validTo', e.valid_to,
'validity', e.validity,
'scopes', json((SELECT coalesce(json_group_array(json(sc) ORDER BY sid), json('[]')) FROM (
SELECT json_object('id', sn.id, 'name', sn.name, 'kind', sn.scope_kind, 'root', sn.root,
'matched', json(CASE WHEN EXISTS (SELECT 1 FROM _scope x WHERE x.nid = sn.nid) THEN 'true' ELSE 'false' END)) AS sc, sn.id AS sid
FROM edges esc JOIN hg_node sn ON sn.nid = esc.target_id
WHERE esc.source_id = e.nid AND esc.type = 'APPLIES_TO'))),
'filing', json((SELECT json_object('id', tf.id, 'name', tf.name,
'label', (SELECT l.label FROM hg_label l WHERE l.nid = tf.nid AND l.label IN ('Domain', 'Area', 'Topic')))
FROM edges ef JOIN hg_node tf ON tf.nid = ef.target_id
WHERE ef.source_id = e.nid AND ef.type = 'FILED_UNDER' ORDER BY tf.id LIMIT 1)),
'subjectId', (SELECT o.id FROM edges eid JOIN hg_node o ON o.nid = eid.target_id
WHERE eid.source_id = e.nid AND eid.type = 'ABOUT' ORDER BY o.id LIMIT 1),
'filingPath', json((SELECT coalesce(json_group_array(json(g) ORDER BY d DESC, id), json('[]')) FROM (
WITH RECURSIVE up(nid, depth) AS (
SELECT efp.target_id, 0 FROM edges efp WHERE efp.source_id = e.nid AND efp.type = 'FILED_UNDER'
UNION ALL SELECT chp.target_id, up.depth + 1 FROM up JOIN edges chp ON chp.source_id = up.nid AND chp.type = 'CHILD_OF' WHERE up.depth < 2)
SELECT json_object('id', n.id, 'name', coalesce(n.title, n.name),
'label', (SELECT l.label FROM hg_label l WHERE l.nid = n.nid AND l.label IN ('Domain', 'Area', 'Topic'))) AS g,
u.d AS d, n.id AS id
FROM (SELECT nid, max(depth) AS d FROM up GROUP BY nid) u JOIN hg_node n ON n.nid = u.nid))),
'subject', json((SELECT json_object('id', o.id, 'name', coalesce(o.title, o.name), 'label', 'Operator')
FROM edges eab JOIN hg_node o ON o.nid = eab.target_id JOIN hg_label l ON l.nid = o.nid AND l.label = 'Operator'
WHERE eab.source_id = e.nid AND eab.type = 'ABOUT' ORDER BY o.id LIMIT 1)),
'revisions', json((SELECT coalesce(json_group_array(json(u.rv) ORDER BY u.ord), json('[]')) FROM (SELECT json_object('id', p1.id, 'title', p1.title, 'status', p1.status, 'validity', CASE WHEN p1.status='retracted' THEN 'RETRACTED'
WHEN p1.status<>'active' OR (p1.valid_from IS NOT NULL AND p1.valid_from>strftime('%Y-%m-%dT%H:%M:%SZ','now'))
OR (p1.valid_to IS NOT NULL AND p1.valid_to<=strftime('%Y-%m-%dT%H:%M:%SZ','now')) THEN 'INACTIVE'
WHEN p1.valid_from IS NULL THEN 'POSSIBLE' ELSE 'APPLIES' END,
'createdAt', p1.created_at, 'validFrom', p1.valid_from, 'validTo', p1.valid_to,
'direction', 'predecessor', 'depth', 1, 'via', '-[SUPERSEDES]-> ' || p1.id) AS rv, 0 AS ord
FROM (SELECT ed.target_id AS nid FROM edges ed WHERE ed.source_id = e.nid AND ed.type = 'SUPERSEDES' LIMIT 1) x
JOIN hg_memory p1 ON p1.nid = x.nid UNION ALL SELECT json_object('id', s1.id, 'title', s1.title, 'status', s1.status, 'validity', CASE WHEN s1.status='retracted' THEN 'RETRACTED'
WHEN s1.status<>'active' OR (s1.valid_from IS NOT NULL AND s1.valid_from>strftime('%Y-%m-%dT%H:%M:%SZ','now'))
OR (s1.valid_to IS NOT NULL AND s1.valid_to<=strftime('%Y-%m-%dT%H:%M:%SZ','now')) THEN 'INACTIVE'
WHEN s1.valid_from IS NULL THEN 'POSSIBLE' ELSE 'APPLIES' END,
'createdAt', s1.created_at, 'validFrom', s1.valid_from, 'validTo', s1.valid_to,
'direction', 'successor', 'depth', 1, 'via', '<-[SUPERSEDES]- ' || s1.id) AS rv, 1 AS ord
FROM (SELECT ed.source_id AS nid FROM edges ed WHERE ed.target_id = e.nid AND ed.type = 'SUPERSEDES' LIMIT 1) y
JOIN hg_memory s1 ON s1.nid = y.nid) u))
)),
'via', i.via) AS x,
row_number() OVER (ORDER BY e.id) AS rk
FROM _xp_items i JOIN _eligible e ON e.nid = i.nid
WHERE json_extract(@p, '$.relation') <> 'revisions'
ORDER BY e.id LIMIT (SELECT lim FROM _ctx) OFFSET (SELECT off FROM _ctx))), json('[]'))),
'history', json(coalesce((SELECT json_group_array(json(h) ORDER BY rk) FROM (
SELECT json_object('id', m.id, 'title', m.title, 'status', m.status, 'validity', CASE WHEN m.status='retracted' THEN 'RETRACTED'
WHEN m.status<>'active' OR (m.valid_from IS NOT NULL AND m.valid_from>strftime('%Y-%m-%dT%H:%M:%SZ','now'))
OR (m.valid_to IS NOT NULL AND m.valid_to<=strftime('%Y-%m-%dT%H:%M:%SZ','now')) THEN 'INACTIVE'
WHEN m.valid_from IS NULL THEN 'POSSIBLE' ELSE 'APPLIES' END,
'createdAt', m.created_at, 'validFrom', m.valid_from, 'validTo', m.valid_to,
'direction', xh.direction, 'depth', xh.depth, 'via', xh.via) AS h,
row_number() OVER (ORDER BY xh.depth, xh.direction, m.id) AS rk
FROM _xp_hist xh JOIN hg_memory m ON m.nid = xh.nid
ORDER BY xh.depth, xh.direction, m.id LIMIT (SELECT lim FROM _ctx) OFFSET (SELECT off FROM _ctx))), json('[]')))
) AS page;
COMMIT;
```

## References

- [Eligibility snapshot and request validation](../../hg-mem/references/eligible.md)
- [Typed edges, taxonomy and applicability policy](../../hg-mem/references/schema.md)
- [SQLite recursive common table expressions](https://sqlite.org/lang_with.html)
