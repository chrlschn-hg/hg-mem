/// <reference types="node" />
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { MemoryStore } from './memory-store';
import { MemoryError } from './errors';
import { MemoryDraftSchema, type MemoryContext } from '../shared/contracts';
import { cleanup, EXTENSION, freshDatabase, realDir, settingsFor, SQLITE } from './test-support';
import { runCli } from './cli';

const dirs: string[] = [];
after(() => { for (const dir of dirs) cleanup(dir); });
const ctx = (cwd: string, scopeIds: string[] = []): MemoryContext => ({ cwd, scopeIds });
const draft = (over: Record<string, unknown> = {}) => MemoryDraftSchema.parse({
  title: 'note', content: 'zqexplore body', purpose: 'CAPA', scope: 'global', ...over,
});

async function raw(database: string, sql: string) {
  await runCli({ sqlite: SQLITE, extension: EXTENSION, database, sql });
}

// Domain (seeded) -> Area eng -> Topic a, Topic b. Taxonomy is test-only raw writes; memories use save.
async function taxonomy(database: string) {
  await raw(database, `SELECT cypher('CREATE (a:Area {id:"area:eng", name:"Eng"})');
SELECT cypher('MATCH (a:Area {id:"area:eng"}),(d:Domain {id:"domain:project-knowledge"}) CREATE (a)-[:CHILD_OF]->(d)');
SELECT cypher('CREATE (t:Topic {id:"topic:a", name:"A"})');
SELECT cypher('CREATE (t:Topic {id:"topic:b", name:"B"})');
SELECT cypher('MATCH (t:Topic {id:"topic:a"}),(a:Area {id:"area:eng"}) CREATE (t)-[:CHILD_OF]->(a)');
SELECT cypher('MATCH (t:Topic {id:"topic:b"}),(a:Area {id:"area:eng"}) CREATE (t)-[:CHILD_OF]->(a)');`);
}

async function fresh(name: string) {
  const { dir, database } = freshDatabase(name);
  dirs.push(dir);
  const store = new MemoryStore(settingsFor(database));
  await store.initialize();
  await taxonomy(database);
  return { store, database, dir };
}

async function expectError(promise: Promise<unknown>, code: string, pattern?: RegExp) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof MemoryError, `expected MemoryError, got ${String(error)}`);
    assert.equal((error as MemoryError).code, code);
    if (pattern) assert.match((error as MemoryError).message, pattern);
    return true;
  });
}

describe('filing path and explore channels', () => {
  test('domain-only memory has a one-node path; topic memory has a Domain->Area->Topic path of three', async () => {
    const f = await fresh('path');
    const domainOnly = await f.store.save(draft({ title: 'domain only', content: 'zqpath dom', filingId: 'domain:project-knowledge' }), ctx('/'));
    const topicMemory = await f.store.save(draft({ title: 'topic memory', content: 'zqpath topic', filingId: 'topic:a' }), ctx('/'));
    assert.deepEqual(domainOnly.filingPath.map((n) => n.label), ['Domain']);
    assert.deepEqual(topicMemory.filingPath.map((n) => n.label), ['Domain', 'Area', 'Topic'], 'root to leaf');
    assert.deepEqual(topicMemory.filingPath.map((n) => n.id), ['domain:project-knowledge', 'area:eng', 'topic:a']);
  });

  test('a Domain seed reaches its subtree (two levels) and a Topic seed does not reach siblings', async () => {
    const f = await fresh('subtree');
    const a = await f.store.save(draft({ title: 'in a', content: 'zqsub a', filingId: 'topic:a' }), ctx('/'));
    const b = await f.store.save(draft({ title: 'in b', content: 'zqsub b', filingId: 'topic:b' }), ctx('/'));
    const domainPage = await f.store.explore({ id: 'domain:project-knowledge', relation: 'filing', context: ctx('/'), offset: 0, limit: 20 });
    assert.deepEqual(domainPage.items.map((i) => i.memory.id).sort(), [a.id, b.id].sort(), 'domain subtree includes both topics');
    const topicPage = await f.store.explore({ id: a.id, relation: 'filing', context: ctx('/'), offset: 0, limit: 20 });
    assert.deepEqual(topicPage.items.map((i) => i.memory.id), [], 'memory seed on topic:a does not return topic:b (no sibling hub)');
    assert.equal(topicPage.total, 0);
  });

  test('ABOUT subject is used, not asserted_by: an Operational memory asserted by the operator is not a subject match', async () => {
    const f = await fresh('about');
    const persona = await f.store.save(draft({ purpose: 'Persona', title: 'name', content: 'zqabout persona' }), ctx('/'));
    const operational = await f.store.save(draft({ purpose: 'Operational', title: 'op', content: 'zqabout op', filingId: 'domain:project-knowledge' }), ctx('/'));
    const page = await f.store.explore({ id: 'operator:me', relation: 'subject', context: ctx('/'), offset: 0, limit: 20 });
    assert.deepEqual(page.items.map((i) => i.memory.id), [persona.id], 'only the ABOUT memory, though both are asserted by operator:me');
    assert.ok(!page.items.some((i) => i.memory.id === operational.id));
    assert.equal(page.items[0].via, `operator:me <-[ABOUT]- ${persona.id}`);
    assert.equal(persona.subject?.id, 'operator:me');
    assert.equal(operational.subject, null);
  });

  test('typed routes: Domain seed to a Topic member shows CHILD_OF hops and FILED_UNDER; memory seed shows the shared anchor', async () => {
    const f = await fresh('routes');
    const topicMember = await f.store.save(draft({ title: 'deep', content: 'zqroute deep', filingId: 'topic:a' }), ctx('/'));
    const sibling = await f.store.save(draft({ title: 'sibling', content: 'zqroute sibling', filingId: 'topic:a' }), ctx('/'));
    const fromDomain = await f.store.explore({ id: 'domain:project-knowledge', relation: 'filing', context: ctx('/'), offset: 0, limit: 20 });
    const deep = fromDomain.items.find((i) => i.memory.id === topicMember.id);
    assert.equal(deep?.via, `domain:project-knowledge <-[CHILD_OF]- area:eng <-[CHILD_OF]- topic:a <-[FILED_UNDER]- ${topicMember.id}`);
    const fromMemory = await f.store.explore({ id: topicMember.id, relation: 'filing', context: ctx('/'), offset: 0, limit: 20 });
    assert.equal(fromMemory.items[0].memory.id, sibling.id);
    assert.equal(fromMemory.items[0].via, `${topicMember.id} -[FILED_UNDER]-> topic:a <-[FILED_UNDER]- ${sibling.id}`);
  });

  test('history routes start at the public seed id', async () => {
    const f = await fresh('history-route');
    const old = await f.store.save(draft({ title: 'old', content: 'zqhist old', filingId: 'topic:a' }), ctx('/'));
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await f.store.retire(old.id);
    const current = await f.store.save(draft({ title: 'new', content: 'zqhist new', filingId: 'topic:a' }), ctx('/'));
    const closed = (await f.store.read(old.id)).validTo;
    await raw(f.database, `SELECT cypher('MATCH (n:Memory {id:"${current.id}"}), (o:Memory {id:"${old.id}"}) CREATE (n)-[:SUPERSEDES]->(o)');
SELECT cypher('MATCH (n:Memory {id:"${current.id}"}) SET n.valid_from = "${closed}"');`);
    const page = await f.store.explore({ id: current.id, relation: 'revisions', context: ctx('/'), offset: 0, limit: 10 });
    assert.equal(page.history[0].via, `${current.id} -[SUPERSEDES]-> ${old.id}`);
  });

  test('eligibility is applied before paging: out-of-scope matches cannot take the page', async () => {
    const f = await fresh('scope-limit');
    const mine = realDir(join(f.dir, 'mine'));
    const other = realDir(join(f.dir, 'other'));
    const seed = await f.store.save(draft({ scope: 'workspace', title: 'seed', content: 'zqscope seed', filingId: 'topic:a' }), ctx(mine));
    const eligible = await f.store.save(draft({ scope: 'workspace', title: 'mine', content: 'zqscope mine', filingId: 'topic:a' }), ctx(mine));
    for (let i = 0; i < 12; i += 1) {
      await f.store.save(draft({ scope: 'workspace', title: `other ${i}`, content: 'zqscope other', filingId: 'topic:a' }), ctx(other));
    }
    const page = await f.store.explore({ id: seed.id, relation: 'filing', context: ctx(mine), offset: 0, limit: 1 });
    assert.equal(page.total, 1, 'total counts eligible members only');
    assert.deepEqual(page.items.map((i) => i.memory.id), [eligible.id]);
  });

  test('pagination covers every eligible member exactly once', async () => {
    const f = await fresh('paging');
    const ids: string[] = [];
    for (let i = 0; i < 5; i += 1) ids.push((await f.store.save(draft({ title: `p${i}`, content: `zqpage ${i}`, filingId: 'topic:a' }), ctx('/'))).id);
    const seen: string[] = [];
    for (const offset of [0, 2, 4]) {
      const page = await f.store.explore({ id: ids[0], relation: 'filing', context: ctx('/'), offset, limit: 2 });
      assert.equal(page.total, 4);
      seen.push(...page.items.map((i) => i.memory.id));
    }
    assert.deepEqual(seen.sort(), ids.slice(1).sort());
  });

  test('scope seeds and unsupported seed/relation pairs are rejected with a clear error', async () => {
    const f = await fresh('unsupported');
    const m = await f.store.save(draft({ title: 'x', content: 'zqunsup', filingId: 'topic:a' }), ctx('/'));
    await expectError(f.store.explore({ id: 'scope:global', relation: 'filing', context: ctx('/'), offset: 0, limit: 5 }), 'invalid_request', /unsupported for this relation/);
    await expectError(f.store.explore({ id: 'operator:me', relation: 'filing', context: ctx('/'), offset: 0, limit: 5 }), 'invalid_request', /unsupported for this relation/);
    await expectError(f.store.explore({ id: 'topic:a', relation: 'subject', context: ctx('/'), offset: 0, limit: 5 }), 'invalid_request', /unsupported for this relation/);
    await expectError(f.store.explore({ id: 'topic:a', relation: 'revisions', context: ctx('/'), offset: 0, limit: 5 }), 'invalid_request', /unsupported for this relation/);
    await expectError(f.store.explore({ id: 'nope', relation: 'filing', context: ctx('/'), offset: 0, limit: 5 }), 'invalid_request');
    assert.equal(m.filingPath.length, 3);
  });

  test('revisions: a retired predecessor is retained as history only, never an item', async () => {
    const f = await fresh('revisions');
    const old = await f.store.save(draft({ title: 'old rule', content: 'zqrev old', filingId: 'topic:a' }), ctx('/'));
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await f.store.retire(old.id);
    const current = await f.store.save(draft({ title: 'new rule', content: 'zqrev new', filingId: 'topic:a' }), ctx('/'));
    // Test-only link: the successor starts exactly when the predecessor closed.
    const oldClosed = (await f.store.read(old.id)).validTo;
    await raw(f.database, `SELECT cypher('MATCH (n:Memory {id:"${current.id}"}), (o:Memory {id:"${old.id}"}) CREATE (n)-[:SUPERSEDES]->(o)');
SELECT cypher('MATCH (n:Memory {id:"${current.id}"}) SET n.valid_from = "${oldClosed}"');`);
    const page = await f.store.explore({ id: current.id, relation: 'revisions', context: ctx('/'), offset: 0, limit: 10 });
    assert.deepEqual(page.items, [], 'revisions never return items');
    assert.equal(page.total, 1);
    assert.equal(page.history[0].id, old.id);
    assert.equal(page.history[0].status, 'retired');
    assert.equal(page.history[0].direction, 'predecessor');
    assert.equal(page.history[0].depth, 1);
    const browse = await f.store.browse({ context: ctx('/'), query: '', offset: 0, limit: 10 });
    assert.ok(!browse.items.some((i) => i.id === old.id), 'current browse excludes the retired predecessor');
    const successorView = (await f.store.read(current.id)).revisions;
    assert.equal(successorView.length, 1, 'record carries the direct predecessor only');
    assert.equal(successorView[0].direction, 'predecessor');
  });

  test('history pagination: seven-memory chain, seed in the middle, paged with exact totals and no duplicates', async () => {
    const f = await fresh('history-chain');
    const ids: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      ids.push((await f.store.save(draft({ title: `link ${i}`, content: `zqchain ${i}`, filingId: 'topic:a' }), ctx('/'))).id);
    }
    // Test-only canonical intervals and successor links in one transaction: link i ends where link i+1 starts.
    const stamp = (i: number) => `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`;
    const statements = ['BEGIN;'];
    for (let i = 0; i < 7; i += 1) {
      statements.push(`SELECT cypher('MATCH (m:Memory {id:"${ids[i]}"}) SET m.valid_from = "${stamp(i)}"${i < 6 ? `, m.valid_to = "${stamp(i + 1)}"` : ''}');`);
    }
    for (let i = 0; i < 6; i += 1) {
      statements.push(`SELECT cypher('MATCH (n:Memory {id:"${ids[i + 1]}"}), (o:Memory {id:"${ids[i]}"}) CREATE (n)-[:SUPERSEDES]->(o)');`);
    }
    statements.push('COMMIT;');
    await raw(f.database, statements.join('\n'));
    const seed = ids[3];
    const first = await f.store.explore({ id: seed, relation: 'revisions', context: ctx('/'), offset: 0, limit: 5 });
    const second = await f.store.explore({ id: seed, relation: 'revisions', context: ctx('/'), offset: 5, limit: 5 });
    assert.equal(first.total, 6);
    assert.equal(first.items.length, 0, 'revisions never return items');
    assert.equal(first.history.length, 5);
    assert.equal(second.history.length, 1);
    assert.equal(second.total, 6);
    const all = [...first.history, ...second.history].map((h) => h.id);
    assert.equal(new Set(all).size, 6, 'no duplicate revision ids across pages');
    assert.deepEqual([...all].sort(), ids.filter((_, i) => i !== 3).sort(), 'every predecessor and successor appears once');
    const pred = [...first.history, ...second.history].filter((h) => h.direction === 'predecessor').map((h) => h.depth).sort();
    const succ = [...first.history, ...second.history].filter((h) => h.direction === 'successor').map((h) => h.depth).sort();
    assert.deepEqual(pred, [1, 2, 3]);
    assert.deepEqual(succ, [1, 2, 3]);
    assert.equal((await f.store.verify()).ok, true, 'the test-only chain keeps the graph valid');
  });

  test('matched is non-null for context browse and null for the all-scopes picker and read', async () => {
    const f = await fresh('matched');
    const repo = realDir(join(f.dir, 'matched-repo'));
    const saved = await f.store.save(draft({ scope: 'workspace', title: 'scoped', content: 'zqmatched', filingId: 'topic:a' }), ctx(repo));
    const inContext = await f.store.browse({ context: ctx(repo), query: '', offset: 0, limit: 5 });
    assert.equal(inContext.items[0].scopes[0].matched, true);
    const picker = await f.store.browseAll({ query: '', offset: 0, limit: 5 });
    assert.equal(picker.items.find((i) => i.id === saved.id)?.scopes[0].matched, null);
    assert.equal((await f.store.read(saved.id)).scopes[0].matched, null);
  });
});
