/// <reference types="node" />
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from './memory-store';
import { MemoryError } from './errors';
import { MemoryDraftSchema, type MemoryContext } from '../shared/contracts';
import { cleanup, EXTENSION, freshDatabase, settingsFor, SQLITE } from './test-support';
import { runCli } from './cli';
import { RECIPE_SQL } from './generated/recipes';

const dirs: string[] = [];
after(() => { for (const dir of dirs) cleanup(dir); });
const ctx: MemoryContext = { cwd: '/', scopeIds: [] };
const draft = (over: Record<string, unknown> = {}) => MemoryDraftSchema.parse({
  title: 'note', content: 'zqretract body', purpose: 'Operational', scope: 'global', ...over,
});

async function fresh(name: string) {
  const { dir, database } = freshDatabase(name);
  dirs.push(dir);
  const store = new MemoryStore(settingsFor(database));
  await store.initialize();
  return { store, database };
}

// Test-only raw creation through the shipped create recipe, for assertion kinds the store cannot save
// (observed or inferred). Explicit validity and an agent identity are passed as bound JSON.
async function rawCreate(database: string, body: Record<string, unknown>) {
  await runCli({ sqlite: SQLITE, extension: EXTENSION, database, p: body, write: true,
    sql: [RECIPE_SQL.begin, RECIPE_SQL.create, RECIPE_SQL.commit].join('\n') });
}

async function expectError(promise: Promise<unknown>, code: string, pattern?: RegExp) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof MemoryError, `expected MemoryError, got ${String(error)}`);
    assert.equal((error as MemoryError).code, code);
    if (pattern) assert.match((error as MemoryError).message, pattern);
    return true;
  });
}

describe('retract: withdraw from recall, keep the evidence', () => {
  test('an observed memory is withdrawn from browse, directives and search, and stays readable with its evidence', async () => {
    const f = await fresh('retract-observed');
    await rawCreate(f.database, { id: 'mem-observed', kind: 'Operational', title: 'agent observation', content: 'zqobserved claim',
      asserted_by: 'agent:codex', assertion_kind: 'observed', required: false, scopes: ['scope:global'],
      filing: 'domain:project-knowledge', source_ref: 'session:abc' });
    const inferred = await f.store.save(draft({ title: 'other', content: 'zqinferred keep' }), ctx);
    assert.ok((await f.store.browse({ context: ctx, query: 'zqobserved', offset: 0, limit: 5 })).items.some((i) => i.id === 'mem-observed'));
    const removed = await f.store.retract('mem-observed');
    assert.equal(removed.status, 'retracted');
    assert.equal(removed.validity, 'RETRACTED');
    assert.equal(removed.assertionKind, 'observed');
    assert.equal(removed.content, 'zqobserved claim', 'evidence and content are retained');
    assert.equal(removed.sourceRef, 'session:abc');
    const recent = await f.store.browse({ context: ctx, query: '', offset: 0, limit: 10 });
    assert.ok(!recent.items.some((i) => i.id === 'mem-observed'), 'removed from browse');
    const searched = await f.store.browse({ context: ctx, query: 'zqobserved', offset: 0, limit: 5 });
    assert.equal(searched.total, 0, 'removed from search');
    const picker = await f.store.browseAll({ query: 'zqobserved', offset: 0, limit: 5 });
    assert.equal(picker.total, 0, 'removed from the picker');
    assert.equal((await f.store.read('mem-observed')).status, 'retracted', 'exact read still shows it');
    const other = await f.store.browse({ context: ctx, query: 'zqinferred', offset: 0, limit: 5 });
    assert.deepEqual(other.items.map((i) => i.id), [inferred.id], 'other memories are untouched');
    assert.equal((await f.store.verify()).ok, true);
  });

  test('a required directive is withdrawn from the inventory and stays readable', async () => {
    const f = await fresh('retract-directive');
    const rule = await f.store.save(draft({ purpose: 'CAPA', required: true, sourceRef: 'chat:1', title: 'rule', content: 'zqdirective' }), ctx);
    assert.equal((await f.store.directives({ context: ctx, offset: 0, limit: 10 })).total, 1);
    await f.store.retract(rule.id);
    assert.equal((await f.store.directives({ context: ctx, offset: 0, limit: 10 })).total, 0, 'inventory excludes the withdrawn rule');
    const read = await f.store.read(rule.id);
    assert.equal(read.status, 'retracted');
    assert.equal(read.required, true, 'the record keeps its required flag as evidence');
  });

  test('retracting a successor does not revive its predecessor', async () => {
    const f = await fresh('retract-no-revival');
    await rawCreate(f.database, { id: 'rule-old', kind: 'CAPA', title: 'old rule', content: 'zqold rule',
      asserted_by: 'operator:me', assertion_kind: 'explicit', required: false, scopes: ['scope:global'],
      valid_from: '2026-01-01T00:00:00Z', valid_to: '2026-02-01T00:00:00Z' });
    await rawCreate(f.database, { id: 'rule-new', kind: 'CAPA', title: 'new rule', content: 'zqnew rule',
      asserted_by: 'operator:me', assertion_kind: 'explicit', required: false, scopes: ['scope:global'],
      valid_from: '2026-02-01T00:00:00Z' });
    await runCli({ sqlite: SQLITE, extension: EXTENSION, database: f.database, write: true, p: {}, sql: [RECIPE_SQL.begin,
      `SELECT cypher('MATCH (n:Memory {id:"rule-new"}), (o:Memory {id:"rule-old"}) CREATE (n)-[:SUPERSEDES]->(o)');`, RECIPE_SQL.commit].join('\n') });
    const before = await f.store.browse({ context: ctx, query: '', offset: 0, limit: 10 });
    assert.deepEqual(before.items.map((i) => i.id), ['rule-new'], 'old rule is historical by time, not current');
    await f.store.retract('rule-new');
    const after = await f.store.browse({ context: ctx, query: '', offset: 0, limit: 10 });
    assert.equal(after.total, 0, 'neither the retracted successor nor its predecessor is current');
    const old = await f.store.read('rule-old');
    assert.equal(old.validity, 'INACTIVE', 'the predecessor stays historical, not revived');
    assert.equal(old.status, 'active', 'the predecessor record is untouched');
    assert.equal((await f.store.verify()).ok, true);
  });

  test('retracting twice is rejected and changes nothing; an unknown id is not found', async () => {
    const f = await fresh('retract-errors');
    const m = await f.store.save(draft({ title: 'twice', content: 'zqtwice' }), ctx);
    await f.store.retract(m.id);
    await expectError(f.store.retract(m.id), 'invalid_request', /already removed/);
    assert.equal((await f.store.read(m.id)).status, 'retracted');
    await expectError(f.store.retract('no-such-memory'), 'not_found');
  });
});
