# Bootstrap hg-mem schema v1

Creates a new managed database. Initialization rejects existing graph data, unmanaged tables or
views, and an existing `hg_meta`. There are no migrations and no repair.

Run the single block below through the loader in [runtime.md](../../hg-mem/references/runtime.md).
That loader passes the GraphQLite extension with `-cmd .load` and keeps SQL on stdin; this block's
first statement is `PRAGMA foreign_keys = ON`, because a `-cmd` PRAGMA can be skipped with `-bail`.

```sh
# From the workspace root, after HG_SKILLS, HG_SQLITE, HG_DB and HG_EXT are set (see runtime.md).
hgblock hg-mem-init/references/bootstrap.md | hgsql
```

Expect `hg-mem schema v1 initialized` and exit status 0. Any failed guard or invariant aborts the
statement, `-bail` stops the CLI, and closing the connection rolls back the whole transaction. A
failure leaves the file with no `hg_meta` and no nodes.

```text
# Created: hg_meta(version=1), hg_fts(title,content) with rowid = internal node id,
# canonical views hg_label, hg_prop, hg_node, hg_memory, hg_edge, hg_violation,
# GraphQLite uniqueness/NOT NULL constraints, and one explicit Scope scope:global.
# hg_violation has zero rows on a valid store; it is a full scan, so keep stores small.
```

```sql
-- hg-mem schema v1 bootstrap: new managed database only. Caller loads GraphQLite 0.12.0 first.
-- All-or-nothing: a failed statement stops the CLI (-bail); closing it rolls back the open transaction.
PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;

-- 1. Preconditions: version, empty graph, no unmanaged tables/views, not already initialized.
CREATE TEMP TABLE _assert(ok INTEGER, why TEXT);
CREATE TEMP TABLE _cy(result TEXT);   -- writer results are kept here, not printed
CREATE TEMP TRIGGER _assert_fail BEFORE INSERT ON _assert WHEN NEW.ok IS NOT 1
BEGIN SELECT RAISE(ABORT, NEW.why); END;
INSERT INTO _assert VALUES ((SELECT count(*) FROM sqlite_master WHERE name = 'hg_meta') = 0, 'database is already hg-mem initialized');
INSERT INTO _assert VALUES (json_extract(cypher_capabilities(), '$.graphqlite_version') = '0.12.0', 'requires GraphQLite 0.12.0');
INSERT INTO _assert VALUES ((SELECT count(*) FROM nodes) = 0 AND (SELECT count(*) FROM edges) = 0, 'database already contains graph data');
INSERT INTO _assert VALUES ((SELECT count(*) FROM sqlite_master WHERE type IN ('table', 'view')
  AND name NOT IN ('nodes', 'edges', 'node_labels', 'property_keys',
    'node_props_text', 'node_props_int', 'node_props_real', 'node_props_bool', 'node_props_json',
    'edge_props_text', 'edge_props_int', 'edge_props_real', 'edge_props_bool', 'edge_props_json')
  AND name NOT LIKE 'sqlite\_%' ESCAPE '\') = 0, 'unmanaged tables or views exist');

-- 2. Version marker and FTS table (content-bearing; rowid = internal node id).
CREATE TABLE hg_meta(version INTEGER NOT NULL CHECK (version = 1));
INSERT INTO hg_meta(version) VALUES (1);
CREATE TRIGGER hg_meta_one BEFORE INSERT ON hg_meta WHEN (SELECT count(*) FROM hg_meta) >= 1
BEGIN SELECT RAISE(ABORT, 'hg_meta holds exactly one row'); END;
CREATE VIRTUAL TABLE hg_fts USING fts5(title, content, tokenize = 'unicode61 remove_diacritics 2');

-- 3. Public-ID identity and label-level uniqueness (cross-label uniqueness is checked in hg_violation).
INSERT INTO _cy SELECT cypher('CREATE CONSTRAINT c_memory_id IF NOT EXISTS FOR (n:Memory) REQUIRE n.id IS UNIQUE');
INSERT INTO _cy SELECT cypher('CREATE CONSTRAINT c_scope_id IF NOT EXISTS FOR (n:Scope) REQUIRE n.id IS UNIQUE');
INSERT INTO _cy SELECT cypher('CREATE CONSTRAINT c_domain_id IF NOT EXISTS FOR (n:Domain) REQUIRE n.id IS UNIQUE');
INSERT INTO _cy SELECT cypher('CREATE CONSTRAINT c_area_id IF NOT EXISTS FOR (n:Area) REQUIRE n.id IS UNIQUE');
INSERT INTO _cy SELECT cypher('CREATE CONSTRAINT c_topic_id IF NOT EXISTS FOR (n:Topic) REQUIRE n.id IS UNIQUE');
INSERT INTO _cy SELECT cypher('CREATE CONSTRAINT c_operator_id IF NOT EXISTS FOR (n:Operator) REQUIRE n.id IS UNIQUE');
INSERT INTO _cy SELECT cypher('CREATE CONSTRAINT c_memory_title IF NOT EXISTS FOR (n:Memory) REQUIRE n.title IS NOT NULL');
INSERT INTO _cy SELECT cypher('CREATE CONSTRAINT c_memory_content IF NOT EXISTS FOR (n:Memory) REQUIRE n.content IS NOT NULL');

-- 4. Canonical views over the typed EAV tables. hg_node/hg_memory/hg_edge are the stable read interface.
CREATE VIEW hg_label AS SELECT node_id AS nid, label FROM node_labels;

CREATE VIEW hg_prop AS
  SELECT p.node_id AS nid, k.key AS key, 'text' AS ty, p.value AS value FROM node_props_text p JOIN property_keys k ON k.id = p.key_id
  UNION ALL SELECT p.node_id, k.key, 'int', p.value FROM node_props_int p JOIN property_keys k ON k.id = p.key_id
  UNION ALL SELECT p.node_id, k.key, 'real', p.value FROM node_props_real p JOIN property_keys k ON k.id = p.key_id
  UNION ALL SELECT p.node_id, k.key, 'bool', p.value FROM node_props_bool p JOIN property_keys k ON k.id = p.key_id
  UNION ALL SELECT p.node_id, k.key, 'json', p.value FROM node_props_json p JOIN property_keys k ON k.id = p.key_id;

CREATE VIEW hg_node AS
SELECT n.id AS nid,
  MAX(CASE WHEN p.key = 'id' THEN p.value END) AS id,
  MAX(CASE WHEN p.key = 'name' THEN p.value END) AS name,
  MAX(CASE WHEN p.key = 'kind' THEN p.value END) AS scope_kind,
  MAX(CASE WHEN p.key = 'root' THEN p.value END) AS root,
  MAX(CASE WHEN p.key = 'title' THEN p.value END) AS title,
  MAX(CASE WHEN p.key = 'content' THEN p.value END) AS content,
  MAX(CASE WHEN p.key = 'created_at' THEN p.value END) AS created_at,
  MAX(CASE WHEN p.key = 'updated_at' THEN p.value END) AS updated_at,
  MAX(CASE WHEN p.key = 'asserted_by' THEN p.value END) AS asserted_by,
  MAX(CASE WHEN p.key = 'assertion_kind' THEN p.value END) AS assertion_kind,
  MAX(CASE WHEN p.key = 'required' THEN p.value END) AS required,
  MAX(CASE WHEN p.key = 'status' THEN p.value END) AS status,
  MAX(CASE WHEN p.key = 'valid_from' THEN p.value END) AS valid_from,
  MAX(CASE WHEN p.key = 'valid_to' THEN p.value END) AS valid_to,
  MAX(CASE WHEN p.key = 'source_ref' THEN p.value END) AS source_ref,
  (SELECT l.label FROM hg_label l WHERE l.nid = n.id AND l.label IN ('Persona', 'CAPA', 'Operational')) AS purpose
FROM nodes n LEFT JOIN hg_prop p ON p.nid = n.id
GROUP BY n.id;

CREATE VIEW hg_memory AS
SELECT h.* FROM hg_node h WHERE EXISTS (SELECT 1 FROM hg_label l WHERE l.nid = h.nid AND l.label = 'Memory');

CREATE VIEW hg_edge AS
SELECT e.id AS eid, e.type AS type, e.source_id AS src, e.target_id AS tgt,
  ',' || COALESCE((SELECT group_concat(l.label, ',') FROM node_labels l WHERE l.node_id = e.source_id), '') || ',' AS src_labels,
  ',' || COALESCE((SELECT group_concat(l.label, ',') FROM node_labels l WHERE l.node_id = e.target_id), '') || ',' AS tgt_labels
FROM edges e;

-- 5. Semantic validation: every row is a violation. Zero rows = valid. Full scan; intended for small stores.
CREATE VIEW hg_violation AS
  SELECT 'meta_version' AS code, NULL AS nid, '' AS detail WHERE (SELECT count(*) FROM hg_meta) <> 1 OR NOT EXISTS (SELECT 1 FROM hg_meta WHERE version = 1)
  -- identity: nonempty, text, unique across all labels
  UNION ALL SELECT 'id_missing', nid, '' FROM hg_node WHERE id IS NULL
  UNION ALL SELECT 'id_type', nid, ty FROM hg_prop WHERE key = 'id' AND ty <> 'text'
  UNION ALL SELECT 'id_blank', nid, '' FROM hg_node WHERE id IS NOT NULL AND (trim(id) = '' OR trim(id) <> id)
  UNION ALL SELECT 'id_duplicate', min(nid), id FROM hg_node WHERE id IS NOT NULL GROUP BY id HAVING count(*) > 1
  -- labels: Memory + exactly one purpose, or exactly one context label; nothing else
  UNION ALL SELECT 'label_unknown', nid, label FROM hg_label WHERE label NOT IN ('Memory', 'Persona', 'CAPA', 'Operational', 'Scope', 'Domain', 'Area', 'Topic', 'Operator')
  UNION ALL SELECT 'label_shape', n.id, COALESCE((SELECT group_concat(l.label, ',') FROM node_labels l WHERE l.node_id = n.id), '<none>')
    FROM nodes n
    WHERE NOT (
      (SELECT count(*) FROM node_labels l WHERE l.node_id = n.id) = 2
      AND EXISTS (SELECT 1 FROM node_labels l WHERE l.node_id = n.id AND l.label = 'Memory')
      AND (SELECT count(*) FROM node_labels l WHERE l.node_id = n.id AND l.label IN ('Persona', 'CAPA', 'Operational')) = 1)
    AND NOT (
      (SELECT count(*) FROM node_labels l WHERE l.node_id = n.id) = 1
      AND (SELECT count(*) FROM node_labels l WHERE l.node_id = n.id AND l.label IN ('Scope', 'Domain', 'Area', 'Topic', 'Operator')) = 1)
  -- scalar types and allowed keys
  UNION ALL SELECT 'prop_type', nid, key || ':' || ty FROM hg_prop
    WHERE (key IN ('id', 'name', 'kind', 'root', 'title', 'content', 'created_at', 'updated_at', 'asserted_by', 'assertion_kind', 'status', 'source_ref', 'valid_from', 'valid_to') AND ty <> 'text')
       OR (key = 'required' AND ty <> 'bool')
  UNION ALL SELECT 'prop_unknown', p.nid, p.key FROM hg_prop p
    WHERE p.key NOT IN ('id', 'name', 'kind', 'root', 'title', 'content', 'created_at', 'updated_at', 'asserted_by', 'assertion_kind', 'required', 'status', 'source_ref', 'valid_from', 'valid_to')
       OR (p.key IN ('kind', 'root') AND NOT EXISTS (SELECT 1 FROM hg_label l WHERE l.nid = p.nid AND l.label = 'Scope'))
       OR (p.key = 'name' AND EXISTS (SELECT 1 FROM hg_label l WHERE l.nid = p.nid AND l.label IN ('Memory', 'Persona', 'CAPA', 'Operational')))
       OR (p.key IN ('title', 'content', 'created_at', 'updated_at', 'asserted_by', 'assertion_kind', 'required', 'status', 'source_ref', 'valid_from', 'valid_to')
           AND NOT EXISTS (SELECT 1 FROM hg_label l WHERE l.nid = p.nid AND l.label = 'Memory'))
  UNION ALL SELECT 'context_name', h.nid, '' FROM hg_node h
    WHERE EXISTS (SELECT 1 FROM hg_label l WHERE l.nid = h.nid AND l.label IN ('Scope', 'Domain', 'Area', 'Topic', 'Operator'))
      AND (h.name IS NULL OR trim(h.name) = '')
  -- memory required fields and canonical values
  UNION ALL SELECT 'memory_field', m.nid, f.k FROM hg_memory m,
    (SELECT 'title' AS k UNION ALL SELECT 'content' UNION ALL SELECT 'created_at' UNION ALL SELECT 'updated_at'
     UNION ALL SELECT 'asserted_by' UNION ALL SELECT 'assertion_kind' UNION ALL SELECT 'required' UNION ALL SELECT 'status') f
    WHERE NOT EXISTS (SELECT 1 FROM hg_prop p WHERE p.nid = m.nid AND p.key = f.k)
  UNION ALL SELECT 'memory_blank', nid, '' FROM hg_memory WHERE trim(title) = '' OR trim(content) = '' OR trim(asserted_by) = ''
  UNION ALL SELECT 'assertion_kind', nid, COALESCE(assertion_kind, '') FROM hg_memory WHERE assertion_kind IS NOT NULL AND assertion_kind NOT IN ('explicit', 'observed', 'inferred')
  UNION ALL SELECT 'status', nid, COALESCE(status, '') FROM hg_memory WHERE status IS NOT NULL AND status NOT IN ('active', 'retired', 'retracted')
  UNION ALL SELECT 'required_value', nid, COALESCE(required, '') FROM hg_memory WHERE required IS NOT NULL AND required NOT IN (0, 1)
  UNION ALL SELECT 'time_format', nid, key FROM hg_prop
    WHERE key IN ('created_at', 'updated_at', 'valid_from', 'valid_to')
      AND (ty <> 'text' OR strftime('%Y-%m-%dT%H:%M:%SZ', value) IS NOT value)
  UNION ALL SELECT 'valid_order', nid, '' FROM hg_memory WHERE valid_from IS NOT NULL AND valid_to IS NOT NULL AND valid_to <= valid_from
  UNION ALL SELECT 'source_blank', nid, '' FROM hg_memory WHERE source_ref IS NOT NULL AND trim(source_ref) = ''
  -- authority: explicit statements name an Operator; required implies explicit with source_ref
  UNION ALL SELECT 'asserted_by_operator', m.nid, COALESCE(m.asserted_by, '') FROM hg_memory m
    WHERE m.assertion_kind = 'explicit'
      AND NOT EXISTS (SELECT 1 FROM hg_node o JOIN hg_label l ON l.nid = o.nid AND l.label = 'Operator' WHERE o.id = m.asserted_by)
  UNION ALL SELECT 'required_authority', m.nid, '' FROM hg_memory m
    WHERE m.required = 1 AND (m.assertion_kind IS NOT 'explicit' OR m.source_ref IS NULL
      OR NOT EXISTS (SELECT 1 FROM hg_node o JOIN hg_label l ON l.nid = o.nid AND l.label = 'Operator' WHERE o.id = m.asserted_by))
  -- scope: explicit global singleton; directory roots canonical absolute; every memory has >= 1 scope
  UNION ALL SELECT 'scope_kind', h.nid, COALESCE(h.scope_kind, '') FROM hg_node h
    WHERE EXISTS (SELECT 1 FROM hg_label l WHERE l.nid = h.nid AND l.label = 'Scope')
      AND COALESCE(h.scope_kind, '') NOT IN ('global', 'project', 'directory', 'session')
  UNION ALL SELECT 'scope_root', h.nid, COALESCE(h.root, '') FROM hg_node h
    WHERE EXISTS (SELECT 1 FROM hg_label l WHERE l.nid = h.nid AND l.label = 'Scope')
      AND ((h.scope_kind = 'directory' AND (h.root IS NULL OR h.root NOT LIKE '/%' OR h.root GLOB '*//*' OR h.root GLOB '*/./*'
            OR h.root GLOB '*/../*' OR h.root GLOB '*/.' OR h.root GLOB '*/..' OR (h.root GLOB '*/' AND h.root <> '/')))
        OR (h.scope_kind IS NOT 'directory' AND h.root IS NOT NULL))
  UNION ALL SELECT 'scope_global', NULL, '' WHERE (SELECT count(*) FROM hg_node h JOIN hg_label l ON l.nid = h.nid AND l.label = 'Scope' WHERE h.scope_kind = 'global') <> 1
    OR NOT EXISTS (SELECT 1 FROM hg_node h JOIN hg_label l ON l.nid = h.nid AND l.label = 'Scope' WHERE h.id = 'scope:global' AND h.scope_kind = 'global')
  UNION ALL SELECT 'scope_missing', m.nid, '' FROM hg_memory m WHERE NOT EXISTS (SELECT 1 FROM hg_edge e WHERE e.src = m.nid AND e.type = 'APPLIES_TO')
  -- filing and subject: Operational exactly one; Persona/CAPA at most one; Persona exactly one ABOUT, others at most one
  UNION ALL SELECT 'filing_count', m.nid, m.purpose FROM hg_memory m
    WHERE (SELECT count(*) FROM hg_edge e WHERE e.src = m.nid AND e.type = 'FILED_UNDER') > 1
       OR (m.purpose = 'Operational' AND NOT EXISTS (SELECT 1 FROM hg_edge e WHERE e.src = m.nid AND e.type = 'FILED_UNDER'))
  UNION ALL SELECT 'about_count', m.nid, m.purpose FROM hg_memory m
    WHERE (SELECT count(*) FROM hg_edge e WHERE e.src = m.nid AND e.type = 'ABOUT') > 1
       OR (m.purpose = 'Persona' AND NOT EXISTS (SELECT 1 FROM hg_edge e WHERE e.src = m.nid AND e.type = 'ABOUT'))
  -- taxonomy: Topic and Area exactly one parent; Domain none
  UNION ALL SELECT 'taxonomy_parent', h.nid, COALESCE(h.id, '') FROM hg_node h
    WHERE EXISTS (SELECT 1 FROM hg_label l WHERE l.nid = h.nid AND l.label IN ('Area', 'Topic'))
      AND (SELECT count(*) FROM hg_edge e WHERE e.src = h.nid AND e.type = 'CHILD_OF') <> 1
  UNION ALL SELECT 'taxonomy_domain_parent', h.nid, COALESCE(h.id, '') FROM hg_node h
    WHERE EXISTS (SELECT 1 FROM hg_label l WHERE l.nid = h.nid AND l.label = 'Domain')
      AND EXISTS (SELECT 1 FROM hg_edge e WHERE e.src = h.nid AND e.type = 'CHILD_OF')
  -- edges: closed type set, endpoint pairs, no self/duplicate/property
  UNION ALL SELECT 'edge_type', eid, type FROM hg_edge WHERE type NOT IN ('APPLIES_TO', 'FILED_UNDER', 'ABOUT', 'SUPERSEDES', 'CHILD_OF')
  UNION ALL SELECT 'edge_endpoint', eid, type FROM hg_edge
    WHERE NOT (
      (type = 'APPLIES_TO' AND instr(src_labels, ',Memory,') > 0 AND instr(tgt_labels, ',Scope,') > 0)
      OR (type = 'FILED_UNDER' AND instr(src_labels, ',Memory,') > 0
          AND (instr(tgt_labels, ',Domain,') > 0 OR instr(tgt_labels, ',Area,') > 0 OR instr(tgt_labels, ',Topic,') > 0))
      OR (type = 'ABOUT' AND instr(src_labels, ',Memory,') > 0 AND instr(tgt_labels, ',Operator,') > 0)
      OR (type = 'SUPERSEDES' AND instr(src_labels, ',Memory,') > 0 AND instr(tgt_labels, ',Memory,') > 0)
      OR (type = 'CHILD_OF' AND ((instr(src_labels, ',Area,') > 0 AND instr(tgt_labels, ',Domain,') > 0)
          OR (instr(src_labels, ',Topic,') > 0 AND instr(tgt_labels, ',Area,') > 0))))
  UNION ALL SELECT 'edge_self', eid, type FROM hg_edge WHERE src = tgt
  UNION ALL SELECT 'edge_duplicate', min(eid), type FROM hg_edge GROUP BY src, tgt, type HAVING count(*) > 1
  UNION ALL SELECT 'edge_property', edge_id, key FROM (
    SELECT p.edge_id, k.key FROM edge_props_text p JOIN property_keys k ON k.id = p.key_id
    UNION ALL SELECT p.edge_id, k.key FROM edge_props_int p JOIN property_keys k ON k.id = p.key_id
    UNION ALL SELECT p.edge_id, k.key FROM edge_props_real p JOIN property_keys k ON k.id = p.key_id
    UNION ALL SELECT p.edge_id, k.key FROM edge_props_bool p JOIN property_keys k ON k.id = p.key_id
    UNION ALL SELECT p.edge_id, k.key FROM edge_props_json p JOIN property_keys k ON k.id = p.key_id)
  -- supersession: new -> old; same purpose and exact scope set; old closes where new starts; no branching; no cycles
  UNION ALL SELECT 'supersedes_branch', tgt, 'in' FROM hg_edge WHERE type = 'SUPERSEDES' GROUP BY tgt HAVING count(*) > 1
  UNION ALL SELECT 'supersedes_branch', src, 'out' FROM hg_edge WHERE type = 'SUPERSEDES' GROUP BY src HAVING count(*) > 1
  UNION ALL SELECT 'supersedes_cycle', origin, '' FROM (
    WITH RECURSIVE reach(origin, cur) AS (
      SELECT src, tgt FROM hg_edge WHERE type = 'SUPERSEDES'
      UNION SELECT r.origin, e.tgt FROM reach r JOIN hg_edge e ON e.src = r.cur AND e.type = 'SUPERSEDES')
    SELECT origin FROM reach WHERE origin = cur)
  UNION ALL SELECT 'supersedes_purpose', e.eid, '' FROM hg_edge e JOIN hg_node a ON a.nid = e.src JOIN hg_node b ON b.nid = e.tgt
    WHERE e.type = 'SUPERSEDES' AND a.purpose IS NOT b.purpose
  UNION ALL SELECT 'supersedes_scope', e.eid, '' FROM hg_edge e
    WHERE e.type = 'SUPERSEDES' AND (
      EXISTS (SELECT tgt FROM hg_edge WHERE src = e.src AND type = 'APPLIES_TO' EXCEPT SELECT tgt FROM hg_edge WHERE src = e.tgt AND type = 'APPLIES_TO')
      OR EXISTS (SELECT tgt FROM hg_edge WHERE src = e.tgt AND type = 'APPLIES_TO' EXCEPT SELECT tgt FROM hg_edge WHERE src = e.src AND type = 'APPLIES_TO'))
  UNION ALL SELECT 'supersedes_time', e.eid, '' FROM hg_edge e JOIN hg_memory n ON n.nid = e.src JOIN hg_memory o ON o.nid = e.tgt
    WHERE e.type = 'SUPERSEDES' AND NOT (o.valid_to IS NOT NULL AND n.valid_from IS NOT NULL AND o.valid_to = n.valid_from)
  -- search projection: exactly the memory title/content, one row per memory (rowid = nid)
  UNION ALL SELECT 'fts_missing', m.nid, '' FROM hg_memory m WHERE NOT EXISTS (SELECT 1 FROM hg_fts f WHERE f.rowid = m.nid)
  UNION ALL SELECT 'fts_extra', f.rowid, '' FROM hg_fts f WHERE NOT EXISTS (SELECT 1 FROM hg_memory m WHERE m.nid = f.rowid)
  UNION ALL SELECT 'fts_stale', m.nid, '' FROM hg_memory m JOIN hg_fts f ON f.rowid = m.nid
    WHERE f.title IS NOT m.title OR f.content IS NOT m.content;

-- 6. Context: the one explicit global scope, created through the GraphQLite writer.
INSERT INTO _cy SELECT cypher('CREATE (s:Scope {id: "scope:global", name: "Global", kind: "global"})');

-- 7. Assert the initialized store is valid; any violation aborts before COMMIT.
INSERT INTO _assert
  SELECT count(*) = 0, 'schema violations: ' || COALESCE(group_concat(code || '@' || COALESCE(CAST(nid AS TEXT), '-'), '; '), '')
  FROM hg_violation;
DROP TABLE temp._cy;
DROP TABLE temp._assert;
COMMIT;
SELECT 'hg-mem schema v1 initialized' AS status;
```

## References

- [Version-one graph and lifecycle contract](../../hg-mem/references/schema.md)
- [GraphQLite database schema: typed EAV tables and indexes](https://colliery-io.github.io/graphqlite/reference/database-schema/)
- [GraphQLite Cypher clauses: CREATE, SET, constraints](https://colliery-io.github.io/graphqlite/reference/cypher-clauses/)
- [GraphQLite SQL interface: cypher() and JSON results](https://colliery-io.github.io/graphqlite/reference/sql-interface/)
- [SQLite FTS5: content-bearing tables, tokenizers and integrity](https://sqlite.org/fts5.html)
- [SQLite transactions: BEGIN IMMEDIATE and rollback](https://sqlite.org/lang_transaction.html)
- [SQLite CREATE TRIGGER and RAISE(ABORT)](https://sqlite.org/lang_createtrigger.html)
- [SQLite date functions: strftime canonical round trip](https://www.sqlite.org/lang_datefunc.html)
- [SQLite common table expressions: recursive cycle detection](https://sqlite.org/lang_with.html)
- [SQLite command-line shell: batch input and -bail](https://sqlite.org/cli.html)
