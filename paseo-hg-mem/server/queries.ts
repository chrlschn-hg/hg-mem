// Trusted read/projection SQL owned by the service. Each builder returns SQL text only; every
// user value reaches SQL through the bound @p/@q JSON parameters or FTS tokenization of @p.

export const NOW = "strftime('%Y-%m-%dT%H:%M:%SZ','now')";

// Read-time validity for records outside an eligibility request (scope-agnostic: status and time only).
export function readValidity(a: string): string {
  return `CASE WHEN ${a}.status='retracted' THEN 'RETRACTED'
    WHEN ${a}.status<>'active' OR (${a}.valid_from IS NOT NULL AND ${a}.valid_from>${NOW})
      OR (${a}.valid_to IS NOT NULL AND ${a}.valid_to<=${NOW}) THEN 'INACTIVE'
    WHEN ${a}.valid_from IS NULL THEN 'POSSIBLE' ELSE 'APPLIES' END`;
}

// matched: 'context' reads the eligibility temp table _scope (request context known);
// 'none' reports null (picker or read with no context).
export type Matched = 'context' | 'none';

// Filing ancestry root -> leaf, at most three nodes (Domain, Area, Topic). Bounded by the taxonomy invariant.
export function filingPathSql(a: string): string {
  return `(SELECT coalesce(json_group_array(json(g) ORDER BY d DESC, id), json('[]')) FROM (
    WITH RECURSIVE up(nid, depth) AS (
      SELECT efp.target_id, 0 FROM edges efp WHERE efp.source_id = ${a}.nid AND efp.type = 'FILED_UNDER'
      UNION ALL SELECT chp.target_id, up.depth + 1 FROM up JOIN edges chp ON chp.source_id = up.nid AND chp.type = 'CHILD_OF' WHERE up.depth < 2)
    SELECT json_object('id', n.id, 'name', coalesce(n.title, n.name),
      'label', (SELECT l.label FROM hg_label l WHERE l.nid = n.nid AND l.label IN ('Domain', 'Area', 'Topic'))) AS g,
      u.d AS d, n.id AS id
    FROM (SELECT nid, max(depth) AS d FROM up GROUP BY nid) u JOIN hg_node n ON n.nid = u.nid))`;
}

// ABOUT subject (an Operator), or null. Only ABOUT edges count, never asserted_by.
export function subjectSql(a: string): string {
  return `(SELECT json_object('id', o.id, 'name', coalesce(o.title, o.name), 'label', 'Operator')
    FROM edges eab JOIN hg_node o ON o.nid = eab.target_id JOIN hg_label l ON l.nid = o.nid AND l.label = 'Operator'
    WHERE eab.source_id = ${a}.nid AND eab.type = 'ABOUT' ORDER BY o.id LIMIT 1)`;
}

// One direct revision neighbor as RevisionRef JSON (depth 1, via text names the edge direction).
function revisionRef(p: string, direction: 'predecessor' | 'successor', via: string): string {
  return `json_object('id', ${p}.id, 'title', ${p}.title, 'status', ${p}.status, 'validity', ${readValidity(p)},
    'createdAt', ${p}.created_at, 'validFrom', ${p}.valid_from, 'validTo', ${p}.valid_to,
    'direction', '${direction}', 'depth', 1, 'via', ${via})`;
}

// Direct SUPERSEDES neighbors of a memory: at most one predecessor and one successor (max 2 entries).
export function revisionsSql(a: string): string {
  const pred = `SELECT ${revisionRef('p1', 'predecessor', "'-[SUPERSEDES]-> ' || p1.id")} AS rv, 0 AS ord
    FROM (SELECT ed.target_id AS nid FROM edges ed WHERE ed.source_id = ${a}.nid AND ed.type = 'SUPERSEDES' LIMIT 1) x
    JOIN hg_memory p1 ON p1.nid = x.nid`;
  const succ = `SELECT ${revisionRef('s1', 'successor', "'<-[SUPERSEDES]- ' || s1.id")} AS rv, 1 AS ord
    FROM (SELECT ed.source_id AS nid FROM edges ed WHERE ed.target_id = ${a}.nid AND ed.type = 'SUPERSEDES' LIMIT 1) y
    JOIN hg_memory s1 ON s1.nid = y.nid`;
  return `json((SELECT coalesce(json_group_array(json(u.rv) ORDER BY u.ord), json('[]')) FROM (${pred} UNION ALL ${succ}) u))`;
}

// Scopes of a memory with the per-context match flag (null when the request has no context).
export function scopesSql(a: string, matched: Matched): string {
  const matchedExpr = matched === 'context'
    ? "CASE WHEN EXISTS (SELECT 1 FROM _scope x WHERE x.nid = sn.nid) THEN 'true' ELSE 'false' END"
    : "'null'";
  return `json((SELECT coalesce(json_group_array(json(sc) ORDER BY sid), json('[]')) FROM (
    SELECT json_object('id', sn.id, 'name', sn.name, 'kind', sn.scope_kind, 'root', sn.root,
      'matched', json(${matchedExpr})) AS sc, sn.id AS sid
    FROM edges esc JOIN hg_node sn ON sn.nid = esc.target_id
    WHERE esc.source_id = ${a}.nid AND esc.type = 'APPLIES_TO')))`;
}

// Filing node (Domain, Area or Topic), or null.
export function filingSql(a: string): string {
  return `json((SELECT json_object('id', tf.id, 'name', tf.name,
    'label', (SELECT l.label FROM hg_label l WHERE l.nid = tf.nid AND l.label IN ('Domain', 'Area', 'Topic')))
    FROM edges ef JOIN hg_node tf ON tf.nid = ef.target_id
    WHERE ef.source_id = ${a}.nid AND ef.type = 'FILED_UNDER' ORDER BY tf.id LIMIT 1))`;
}

// Full MemoryRecord JSON for one memory row alias `a` (hg_memory or _eligible).
export function recordJson(a: string, validity: string, matched: Matched = 'none'): string {
  const matchedExpr = matched === 'context'
    ? "CASE WHEN EXISTS (SELECT 1 FROM _scope x WHERE x.nid = s.nid) THEN 'true' ELSE 'false' END"
    : "'null'";
  return `json_object(
    'id', ${a}.id, 'title', ${a}.title, 'content', ${a}.content, 'purpose', ${a}.purpose,
    'required', json(CASE WHEN ${a}.required=1 THEN 'true' ELSE 'false' END),
    'status', ${a}.status, 'createdAt', ${a}.created_at, 'updatedAt', ${a}.updated_at,
    'assertedBy', ${a}.asserted_by, 'assertionKind', ${a}.assertion_kind,
    'sourceRef', ${a}.source_ref, 'validFrom', ${a}.valid_from, 'validTo', ${a}.valid_to,
    'validity', ${validity},
    'scopes', ${scopesSql(a, matched)},
    'filing', ${filingSql(a)},
    'subjectId', (SELECT o.id FROM edges eid JOIN hg_node o ON o.nid = eid.target_id
        WHERE eid.source_id = ${a}.nid AND eid.type = 'ABOUT' ORDER BY o.id LIMIT 1),
    'filingPath', json(${filingPathSql(a)}),
    'subject', json(${subjectSql(a)}),
    'revisions', ${revisionsSql(a)}
  )`;
}

// Page of eligible records. `source` and `where` must only reference eligibility temp objects.
function pageSql(source: string, where: string, order: string, label = "'directory ' || cwd", matched: Matched = 'context'): string {
  return `SELECT json_object(
    'total', (SELECT count(*) FROM ${source} WHERE ${where}),
    'offset', (SELECT off FROM _ctx),
    'limit', (SELECT lim FROM _ctx),
    'contextLabel', (SELECT ${label} FROM _ctx),
    'items', json(coalesce((SELECT json_group_array(json(rec) ORDER BY rk) FROM (
        SELECT ${recordJson('e', 'e.validity', matched)} AS rec, row_number() OVER (ORDER BY ${order}) AS rk
        FROM ${source} WHERE ${where}
        ORDER BY ${order} LIMIT (SELECT lim FROM _ctx) OFFSET (SELECT off FROM _ctx))), json('[]')))
  ) AS page;`;
}

// Empty query: most recently updated eligible memories (no FTS).
export const BROWSE_RECENT_PAGE = pageSql('_eligible e', '1=1', 'e.updated_at DESC, e.id');

// Nonempty query: FTS candidates from the search recipe (_qm) joined to eligibility before LIMIT.
export const BROWSE_SEARCH_PAGE = pageSql(
  'hg_fts JOIN _eligible e ON e.nid = hg_fts.rowid',
  'hg_fts MATCH (SELECT q FROM _qm)',
  'bm25(hg_fts), e.id',
);

// Human picker over every scope (no composer context): matched is null, label says so.
export const BROWSE_ALL_RECENT_PAGE = pageSql('_eligible e', '1=1', 'e.updated_at DESC, e.id', "'all scopes'", 'none');
export const BROWSE_ALL_SEARCH_PAGE = pageSql(
  'hg_fts JOIN _eligible e ON e.nid = hg_fts.rowid',
  'hg_fts MATCH (SELECT q FROM _qm)',
  'bm25(hg_fts), e.id',
  "'all scopes'",
  'none',
);
export const WIDEN_TO_ALL_SCOPES = `INSERT INTO _scope SELECT n.nid FROM hg_node n
  JOIN hg_label l ON l.nid = n.nid AND l.label = 'Scope'
  WHERE NOT EXISTS (SELECT 1 FROM _scope s WHERE s.nid = n.nid);`;

// Required-directive inventory: every eligible required row, across purposes, paged by id.
export const DIRECTIVES_PAGE = pageSql('_eligible e', 'e.required=1', 'e.id');

// Exact read in any status and scope. Missing id yields a null record (matched null: no context).
export const READ_RECORD = `SELECT json_object('record', json((SELECT ${recordJson('m', readValidity('m'), 'none')}
  FROM hg_memory m WHERE m.id = json_extract(@p, '$.id')))) AS result;`;

// Read the record after a committed write, by the id carried in @p.
export const READ_RECORD_FOR_REQUEST = READ_RECORD;

// explore: final page over the temp tables built by explore.md (_xp_seed, _xp_items, _xp_hist).
// Current channels return items (eligible, filtered before paging); revisions return history only.
export const EXPLORE_PAGE = `SELECT json_object(
  'seed', json((SELECT json_object('id', s.id, 'name', s.name, 'label', s.label) FROM _xp_seed s)),
  'relation', json_extract(@p, '$.relation'),
  'total', CASE WHEN json_extract(@p, '$.relation') = 'revisions'
    THEN (SELECT count(*) FROM _xp_hist) ELSE (SELECT count(*) FROM _xp_items) END,
  'offset', (SELECT off FROM _ctx),
  'limit', (SELECT lim FROM _ctx),
  'contextLabel', 'explore ' || json_extract(@p, '$.relation'),
  'items', json(coalesce((SELECT json_group_array(json(x) ORDER BY rk) FROM (
      SELECT json_object('memory', json(${recordJson('e', 'e.validity', 'context')}),
        'via', i.via) AS x,
        row_number() OVER (ORDER BY e.id) AS rk
      FROM _xp_items i JOIN _eligible e ON e.nid = i.nid
      WHERE json_extract(@p, '$.relation') <> 'revisions'
      ORDER BY e.id LIMIT (SELECT lim FROM _ctx) OFFSET (SELECT off FROM _ctx))), json('[]'))),
  'history', json(coalesce((SELECT json_group_array(json(h) ORDER BY rk) FROM (
      SELECT json_object('id', m.id, 'title', m.title, 'status', m.status, 'validity', ${readValidity('m')},
        'createdAt', m.created_at, 'validFrom', m.valid_from, 'validTo', m.valid_to,
        'direction', xh.direction, 'depth', xh.depth, 'via', xh.via) AS h,
        row_number() OVER (ORDER BY xh.depth, xh.direction, m.id) AS rk
      FROM _xp_hist xh JOIN hg_memory m ON m.nid = xh.nid
      ORDER BY xh.depth, xh.direction, m.id LIMIT (SELECT lim FROM _ctx) OFFSET (SELECT off FROM _ctx))), json('[]')))
) AS page;`;

// Navigation output kept for the navigate recipe (legacy shape).
export const NAVIGATE_ITEMS = `SELECT json_object('items', json(coalesce((SELECT json_group_array(json(item)) FROM (
  SELECT json_object('id', f.id, 'name', coalesce(n.title, n.name),
    'label', coalesce((SELECT l.label FROM node_labels l WHERE l.node_id = f.nid AND l.label IN
      ('Persona','CAPA','Operational','Domain','Area','Topic','Scope','Operator')), ''),
    'via', f.via, 'depth', f.depth) AS item
  FROM _nv_found f JOIN hg_node n ON n.nid = f.nid ORDER BY f.depth, f.id
  LIMIT (SELECT lim FROM _ctx) OFFSET (SELECT off FROM _ctx))), json('[]')))) AS navigation;`;

// Health probe for an existing database. Fails with a SQL error when hg_meta is absent.
export const HEALTH_PROBE = `SELECT json_object('version', (SELECT version FROM hg_meta),
  'memories', (SELECT count(*) FROM hg_memory)) AS health;`;

// Operator registration state for @p.id: missing, operator, or another label (never reused silently).
export const OPERATOR_STATE = `SELECT json_object('state', CASE
  WHEN NOT EXISTS (SELECT 1 FROM hg_node WHERE id = json_extract(@p, '$.id')) THEN 'missing'
  WHEN EXISTS (SELECT 1 FROM hg_node n JOIN hg_label l ON l.nid = n.nid AND l.label = 'Operator'
    WHERE n.id = json_extract(@p, '$.id')) THEN 'operator' ELSE 'other' END) AS state;`;

// Existing directory scope for a canonical root (workspace scope resolution, read-only).
export const FIND_DIRECTORY_SCOPE = `SELECT json_object('id', (SELECT s.id FROM hg_node s
  JOIN hg_label l ON l.nid = s.nid AND l.label = 'Scope'
  WHERE s.scope_kind = 'directory' AND s.root = json_extract(@p, '$.root') ORDER BY s.id LIMIT 1)) AS found;`;

export const CATALOG = `SELECT json_object(
  'scopes', json((SELECT coalesce(json_group_array(json(sc)), json('[]')) FROM (
     SELECT json_object('id', s.id, 'name', s.name, 'kind', s.scope_kind, 'root', s.root) AS sc
     FROM hg_node s JOIN hg_label l ON l.nid = s.nid AND l.label = 'Scope' ORDER BY s.id))),
  'filing', json((SELECT coalesce(json_group_array(json(f)), json('[]')) FROM (
     SELECT json_object('id', n.id, 'name', n.name, 'label', l.label) AS f
     FROM hg_node n JOIN hg_label l ON l.nid = n.nid AND l.label IN ('Domain','Area','Topic') ORDER BY n.id)))
) AS catalog;`;

// Violation codes for an invalid store (read-only; used to explain a failed verify).
export const VIOLATION_CODES = `SELECT json_object('violations', json((SELECT coalesce(json_group_array(json(v)), json('[]')) FROM (
  SELECT json_object('code', code, 'nid', nid) AS v FROM hg_violation ORDER BY code, nid LIMIT 50)))) AS result;`;

// Workspace directory scope, resolved inside the save transaction (after begin, before create).
// @q: { id, name, root } where id is a random candidate used only when no directory scope has this root.
// Creation is skipped by root, so a concurrent winner's scope is reused. The resolved id is then bound
// into @p.scopes (the create recipe reads scopes from @p) and mirrored into _request.
export const SCOPE_RESOLVE_IN_TXN = `
INSERT INTO _guard VALUES(json_valid(@q) AND json_type(@q)='object');
INSERT INTO _guard VALUES(json_type(@q,'$.root')='text' AND json_extract(@q,'$.root')<>'/'
  AND substr(json_extract(@q,'$.root'),1,1)='/' AND json_type(@q,'$.id')='text');
SELECT cypher('CREATE (n:Scope {id:$id}) SET n += $props', json_object('id', json_extract(@q,'$.id'),
  'props', json_object('name', json_extract(@q,'$.name'), 'kind', 'directory', 'root', json_extract(@q,'$.root'))))
WHERE NOT EXISTS (SELECT 1 FROM hg_node s JOIN hg_label l ON l.nid = s.nid AND l.label = 'Scope'
  WHERE s.scope_kind = 'directory' AND s.root = json_extract(@q,'$.root'));
CREATE TEMP TABLE _bound AS SELECT s.id AS id FROM hg_node s JOIN hg_label l ON l.nid = s.nid AND l.label = 'Scope'
  WHERE s.scope_kind = 'directory' AND s.root = json_extract(@q,'$.root') ORDER BY s.id LIMIT 1;
INSERT INTO _guard SELECT count(*) = 1 FROM _bound;
UPDATE temp.sqlite_parameters SET value = json_set(@p, '$.scopes', json_array((SELECT id FROM _bound))) WHERE key = '@p';
UPDATE _request SET p = json(@p);
`;
