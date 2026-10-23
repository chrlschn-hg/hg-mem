/// <reference types="node" />
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { MemoryStore } from './memory-store';
import { MemoryDraftSchema, type MemoryContext } from '../shared/contracts';
import { cleanup, EXTENSION, freshDatabase, realDir, settingsFor, SQLITE } from './test-support';
import { runCli } from './cli';
import { RECIPE_SQL } from './generated/recipes';

const dirs: string[] = [];
after(() => { for (const dir of dirs) cleanup(dir); });
const ctx = (cwd: string): MemoryContext => ({ cwd, scopeIds: [] });
const draft = (over: Record<string, unknown> = {}) => MemoryDraftSchema.parse({
  title: 'parity', content: 'zqparity body', purpose: 'CAPA', scope: 'global', ...over,
});

describe('raw search recipe and plugin records share enrichment SQL', () => {
  test('filing path, filing, subject, scopes (matched) and revisions agree on a three-level taxonomy', async () => {
    const { dir, database } = freshDatabase('parity');
    dirs.push(dir);
    const store = new MemoryStore(settingsFor(database));
    await store.initialize();
    await runCli({ sqlite: SQLITE, extension: EXTENSION, database, sql: `SELECT cypher('CREATE (a:Area {id:"area:eng", name:"Eng"})');
SELECT cypher('MATCH (a:Area {id:"area:eng"}),(d:Domain {id:"domain:project-knowledge"}) CREATE (a)-[:CHILD_OF]->(d)');
SELECT cypher('CREATE (t:Topic {id:"topic:a", name:"A"})');
SELECT cypher('MATCH (t:Topic {id:"topic:a"}),(a:Area {id:"area:eng"}) CREATE (t)-[:CHILD_OF]->(a)');` });
    const repo = realDir(join(dir, 'repo'));
    await store.save(draft({ scope: 'workspace', title: 'capa', content: 'zqparity capa', filingId: 'topic:a' }), ctx(repo));
    await store.save(draft({ purpose: 'Persona', title: 'persona', content: 'zqparity persona' }), ctx(repo));

    const plugin = await store.browse({ context: ctx(repo), query: 'zqparity', offset: 0, limit: 10 });
    assert.equal(plugin.total, 2);
    const raw = await runCli({ sqlite: SQLITE, extension: EXTENSION, database, readonly: true, keepOutput: true,
      p: { cwd: repo, scopes: [], query: 'zqparity', offset: 0, limit: 10 },
      sql: `${RECIPE_SQL.eligible}\n${RECIPE_SQL.search}` });
    const body = raw.stdout.slice(raw.stdout.lastIndexOf('\n[') + 1);
    const rows = JSON.parse(body) as Array<Record<string, unknown>>;
    assert.equal(rows.length, 2);
    for (const record of plugin.items) {
      const row = rows.find((r) => r.id === record.id);
      assert.ok(row, `raw search returns ${record.id}`);
      assert.deepEqual(JSON.parse(String(row.filing_path)), record.filingPath, 'filing path');
      assert.deepEqual(JSON.parse(String(row.filing)), record.filing, 'filing node');
      assert.deepEqual(JSON.parse(String(row.subject)), record.subject, 'subject');
      assert.deepEqual(JSON.parse(String(row.scopes)), record.scopes, 'scopes with matched');
      assert.deepEqual(JSON.parse(String(row.revisions)), record.revisions, 'revisions');
    }
    const capa = plugin.items.find((i) => i.purpose === 'CAPA');
    assert.deepEqual(capa?.filingPath.map((n) => n.label), ['Domain', 'Area', 'Topic'], 'three-level breadcrumb');
    assert.equal(capa?.scopes[0].matched, true);
  });
});
