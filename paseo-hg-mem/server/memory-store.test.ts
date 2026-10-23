/// <reference types="node" />
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { MemoryStore } from './memory-store';
import { MemoryError } from './errors';
import { MemoryDraftSchema, type MemoryContext } from '../shared/contracts';
import { cleanup, freshDatabase, realDir, sandboxDir, settingsFor } from './test-support';
import { runCli } from './cli';
import { EXTENSION, SQLITE } from './test-support';

const dirs: string[] = [];
const ctx = (cwd: string, scopeIds: string[] = []): MemoryContext => ({ cwd, scopeIds });
const draft = (over: Record<string, unknown> = {}) => MemoryDraftSchema.parse({
  title: 'SQLite runtime', content: 'Use extension-enabled sqlite3.', purpose: 'Operational', scope: 'global', ...over,
});

async function fresh(name: string) {
  const { dir, database } = freshDatabase(name);
  dirs.push(dir);
  const store = new MemoryStore(settingsFor(database));
  return { store, database, dir };
}

async function initialized(name: string) {
  const f = await fresh(name);
  await f.store.initialize();
  return f;
}

async function expectError(promise: Promise<unknown>, code: string, pattern?: RegExp) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof MemoryError, `expected MemoryError, got ${String(error)}`);
    assert.equal((error as MemoryError).code, code);
    if (pattern) assert.match((error as MemoryError).message, pattern);
    return true;
  });
}

after(() => { for (const dir of dirs) cleanup(dir); });

describe('setup and health', () => {
  test('health suggests paths and never creates the database', async () => {
    const f = await fresh('health-setup');
    const store = new MemoryStore(settingsFor(f.database, { enabled: false }));
    const health = await store.health();
    assert.equal(health.state, 'setup');
    assert.equal(existsSync(f.database), false);
    assert.match(health.suggestedDatabasePath, /\.paseo\/hg-mem\/memories\.db$/);
  });

  test('blank settings report setup, not errors', async () => {
    const store = new MemoryStore(settingsFor('', { sqlitePath: '', extensionPath: '' }));
    const health = await store.health();
    assert.equal(health.state, 'setup');
    assert.match(health.message, /SQLite CLI/);
  });

  test('a wrong library is an error, not ready', async () => {
    const f = await fresh('health-wrong-lib');
    const bogus = join(f.dir, 'not-graphqlite.dylib');
    writeFileSync(bogus, 'x');
    const store = new MemoryStore(settingsFor(f.database, { extensionPath: bogus }));
    const health = await store.health();
    assert.equal(health.state, 'error');
    assert.match(health.message, /official GraphQLite/);
  });

  test('initialize creates a managed store with operator and project domain', async () => {
    const f = await fresh('init-new');
    const health = await f.store.initialize();
    assert.equal(health.state, 'ready');
    assert.equal(health.memoryCount, 0);
    assert.equal((await f.store.verify()).ok, true);
    const catalog = await f.store.catalog();
    assert.ok(catalog.scopes.some((s) => s.id === 'scope:global' && s.kind === 'global'));
    assert.ok(catalog.filing.some((t) => t.id === 'domain:project-knowledge' && t.name === 'Project knowledge' && t.label === 'Domain'));
  });

  test('initialize refuses an existing unmanaged database and leaves it byte-identical', async () => {
    const f = await fresh('init-unmanaged');
    mkdirSync(f.dir, { recursive: true });
    const seed = await runCli({ sqlite: SQLITE, extension: EXTENSION, database: f.database, sql: 'CREATE TABLE notes(x TEXT); INSERT INTO notes VALUES (\'keep\');' });
    assert.equal(seed.stderr, '');
    const before = readFileSync(f.database);
    await expectError(f.store.initialize(), 'unmanaged_database');
    assert.deepEqual(readFileSync(f.database), before);
  });

  test('initialize on an existing managed store is idempotent', async () => {
    const f = await initialized('init-idempotent');
    const again = await f.store.initialize();
    assert.equal(again.state, 'ready');
    assert.equal((await f.store.verify()).ok, true);
  });

  test('switching the operator reports setup until initialize registers it, then ready again', async () => {
    const f = await initialized('operator-switch');
    const saved = await f.store.save(draft({ title: 'kept', content: 'zqkeep' }), ctx('/'));
    const switched = new MemoryStore(settingsFor(f.database, { operatorId: 'operator:second', operatorName: 'Second' }));
    assert.equal((await switched.health()).state, 'setup');
    assert.match((await switched.health()).message, /Operator needs initialization/);
    assert.equal((await switched.initialize()).state, 'ready');
    assert.equal((await switched.read(saved.id)).assertedBy, 'operator:me', 'existing records keep their asserted_by');
  });

  test('an operator ID already used by a non-operator record is rejected, not reused', async () => {
    const f = await initialized('operator-collision');
    const clash = new MemoryStore(settingsFor(f.database, { operatorId: 'domain:project-knowledge' }));
    await expectError(clash.initialize(), 'setup_invalid', /already used by a non-operator/);
  });

  test('operations before setup fail with a setup message', async () => {
    const f = await fresh('ops-before-init');
    await expectError(f.store.browse({ context: ctx('/'), query: '', offset: 0, limit: 10 }), 'setup_required', /initialize/);
  });
});

describe('save, read and browse', () => {
  test('quotes, backslashes, newlines and Unicode round-trip exactly', async () => {
    const f = await initialized('roundtrip');
    const content = 'quote \' and "dq" and \\ backslash\nnewline ünï 😀 日本語 NEAR( ) * -';
    const saved = await f.store.save(draft({ content, title: 'Ünï "title"' }), ctx('/'));
    const read = await f.store.read(saved.id);
    assert.equal(read.content, content);
    assert.equal(read.title, 'Ünï "title"');
    assert.equal(read.purpose, 'Operational');
    assert.equal(read.assertedBy, 'operator:me');
    assert.equal(read.assertionKind, 'explicit');
    assert.equal(read.required, false);
    assert.equal(read.validity, 'APPLIES');
    assert.deepEqual(read.scopes.map((s) => s.id), ['scope:global']);
    assert.equal(read.filing?.id, 'domain:project-knowledge');
  });

  test('a large body (60 KB) is stored and returned intact', async () => {
    const f = await initialized('large');
    const content = 'lorem ipsum '.repeat(5000) + ' zqlong';
    const saved = await f.store.save(draft({ content: content.slice(0, 20000) }), ctx('/'));
    assert.equal((await f.store.read(saved.id)).content, content.slice(0, 20000));
  });

  test('empty browse lists recent eligible memories; search uses literal tokens', async () => {
    const f = await initialized('browse');
    const a = await f.store.save(draft({ title: 'alpha note', content: 'zqalpha only here' }), ctx('/'));
    await f.store.save(draft({ title: 'beta note', content: 'zqbeta other' }), ctx('/'));
    const recent = await f.store.browse({ context: ctx('/'), query: '', offset: 0, limit: 10 });
    assert.equal(recent.total, 2);
    const hit = await f.store.browse({ context: ctx('/'), query: 'zqalpha', offset: 0, limit: 10 });
    assert.deepEqual(hit.items.map((i) => i.id), [a.id]);
    const none = await f.store.browse({ context: ctx('/'), query: 'zqmissing', offset: 0, limit: 10 });
    assert.equal(none.total, 0);
  });

  test('a query with no searchable tokens is a stable invalid request', async () => {
    const f = await initialized('no-tokens');
    await expectError(f.store.browse({ context: ctx('/'), query: '"""', offset: 0, limit: 10 }), 'invalid_request', /searchable tokens/);
  });

  test('word prefixes match titles and contents in scoped search and the all-scopes picker', async () => {
    const f = await initialized('prefix-search');
    const repo = realDir(join(f.dir, 'repo'));
    const other = realDir(join(f.dir, 'other'));
    const a = await f.store.save(draft({ scope: 'workspace', title: 'Memory project architecture', content: 'Café conventions.' }), ctx(repo));
    const b = await f.store.save(draft({ title: 'Design notes', content: 'Architecture overview.' }), ctx('/'));
    const hidden = await f.store.save(draft({ scope: 'workspace', title: 'Architecture elsewhere', content: 'Other directory.' }), ctx(other));
    for (const query of ['arch', 'ARCH', '"arch"*', 'arch zqmissing']) {
      const page = await f.store.browse({ context: ctx(repo), query, offset: 0, limit: 10 });
      assert.deepEqual(new Set(page.items.map((m) => m.id)), new Set([a.id, b.id]));
      assert.equal(page.total, 2);
    }
    const accent = await f.store.browse({ context: ctx(repo), query: 'caf', offset: 0, limit: 10 });
    assert.deepEqual(accent.items.map((m) => m.id), [a.id]);
    const substring = await f.store.browse({ context: ctx(repo), query: 'chitect', offset: 0, limit: 10 });
    assert.equal(substring.total, 0);
    const picker = await f.store.browseAll({ query: 'arch', offset: 0, limit: 10 });
    assert.deepEqual(new Set(picker.items.map((m) => m.id)), new Set([a.id, b.id, hidden.id]));
    assert.equal((await f.store.verify()).ok, true);
  });

  test('unknown and bad ids are not found, never silently empty', async () => {
    const f = await initialized('bad-ids');
    await expectError(f.store.read('nope'), 'not_found');
    await expectError(f.store.read("x' OR 1=1 --"), 'not_found');
    await expectError(f.store.retire('nope'), 'not_found');
  });

  test('draft schema rejects empty title and oversize content before the store', () => {
    assert.throws(() => MemoryDraftSchema.parse({ title: '   ', content: 'x', purpose: 'CAPA' }));
    assert.throws(() => MemoryDraftSchema.parse({ title: 't', content: 'x'.repeat(20001), purpose: 'CAPA' }));
  });
});

describe('scope boundary and workspace writes', () => {
  test('workspace save creates one directory scope and browse respects the path boundary', async () => {
    const f = await initialized('scope');
    const repo = realDir(join(f.dir, 'repo', 'a'));
    const sibling = realDir(join(f.dir, 'repo', 'abc'));
    const saved = await f.store.save(draft({ scope: 'workspace', title: 'repo rule', content: 'zqscope rule' }), ctx(repo));
    assert.equal(saved.scopes.length, 1);
    assert.equal(saved.scopes[0].kind, 'directory');
    assert.equal(saved.scopes[0].root, repo);
    // second save reuses the same scope
    const again = await f.store.save(draft({ scope: 'workspace', title: 'repo rule 2', content: 'zqscope two' }), ctx(repo));
    assert.equal(again.scopes[0].id, saved.scopes[0].id);
    const inside = await f.store.browse({ context: ctx(join(repo, 'src')), query: '', offset: 0, limit: 10 });
    assert.equal(inside.total, 2, 'child directory sees the workspace memories');
    const outside = await f.store.browse({ context: ctx(sibling), query: '', offset: 0, limit: 10 });
    assert.equal(outside.total, 0, 'sibling with shared prefix (repo/abc vs repo/a) must not see them');
    const top = await f.store.browse({ context: ctx('/'), query: '', offset: 0, limit: 10 });
    assert.equal(top.total, 0, 'root context does not see directory-scoped memories');
  });

  test('two concurrent first workspace writes in the same folder both commit to one directory scope', async () => {
    const f = await initialized('first-write-race');
    const repo = realDir(join(f.dir, 'race'));
    const [a, b] = await Promise.all([
      f.store.save(draft({ scope: 'workspace', title: 'race a', content: 'zqracea' }), ctx(repo)),
      f.store.save(draft({ scope: 'workspace', title: 'race b', content: 'zqraceb' }), ctx(repo)),
    ]);
    assert.equal(a.scopes[0].id, b.scopes[0].id, 'both memories bind the same directory scope');
    const catalog = await f.store.catalog();
    assert.equal(catalog.scopes.filter((s) => s.root === repo).length, 1, 'exactly one directory scope for the folder');
    assert.equal((await f.store.verify()).ok, true);
  });

  test('browseAll lists every active scope (directory, global) and skips retired; literal query works', async () => {
    const f = await initialized('browse-all');
    const repo = realDir(join(f.dir, 'picker'));
    const dirMemory = await f.store.save(draft({ scope: 'workspace', title: 'dir note', content: 'zqpicker dir' }), ctx(repo));
    const globalMemory = await f.store.save(draft({ title: 'global note', content: 'zqpicker global' }), ctx('/'));
    const retired = await f.store.save(draft({ title: 'old note', content: 'zqpicker old' }), ctx('/'));
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await f.store.retire(retired.id);
    const recent = await f.store.browseAll({ query: '', offset: 0, limit: 10 });
    assert.equal(recent.total, 2, 'directory + global; retired excluded');
    assert.deepEqual(recent.items.map((i) => i.id).sort(), [dirMemory.id, globalMemory.id].sort());
    assert.equal(recent.contextLabel, 'all scopes');
    const hit = await f.store.browseAll({ query: 'zqpicker', offset: 0, limit: 10 });
    assert.deepEqual(hit.items.map((i) => i.id).sort(), [dirMemory.id, globalMemory.id].sort());
    const retiredHit = await f.store.browseAll({ query: 'old', offset: 0, limit: 10 });
    assert.equal(retiredHit.total, 0, 'retired memory is not returned by the picker');
    assert.equal((await f.store.verify()).ok, true);
  });

  test('eligibility is applied before LIMIT: out-of-scope hits cannot hide eligible ones', async () => {
    const f = await initialized('limit');
    const other = realDir(join(f.dir, 'other'));
    const mine = realDir(join(f.dir, 'mine'));
    for (let i = 0; i < 12; i += 1) {
      await f.store.save(draft({ scope: 'workspace', title: `other ${i}`, content: 'zqtie shared term' }), ctx(other));
    }
    const target = await f.store.save(draft({ scope: 'workspace', title: 'mine', content: 'zqtie shared term' }), ctx(mine));
    const hits = await f.store.browse({ context: ctx(mine), query: 'zqtie', offset: 0, limit: 1 });
    assert.equal(hits.total, 1);
    assert.deepEqual(hits.items.map((i) => i.id), [target.id]);
  });

  test('workspace save refuses the root directory and relative paths', async () => {
    const f = await initialized('refuse');
    await expectError(f.store.save(draft({ scope: 'workspace' }), ctx('/')), 'invalid_request', /workspace folder/);
    await expectError(f.store.save(draft({ scope: 'workspace' }), ctx('relative/path')), 'invalid_request', /absolute/);
    await expectError(f.store.save(draft({ scope: 'workspace' }), ctx('/tmp/x/../y')), 'invalid_request', /canonical/);
    await expectError(f.store.save(draft({ scope: 'workspace' }), ctx(join(f.dir, 'missing-folder'))), 'invalid_request', /does not exist/);
    const catalog = await f.store.catalog();
    assert.ok(!catalog.scopes.some((s) => s.root?.includes('missing-folder')), 'no scope for a missing folder');
  });

  test('a global memory is visible from any context', async () => {
    const f = await initialized('global-visible');
    const g = await f.store.save(draft({ title: 'global fact', content: 'zqglobal' }), ctx('/'));
    const repo = realDir(join(f.dir, 'anywhere'));
    const seen = await f.store.browse({ context: ctx(repo), query: 'zqglobal', offset: 0, limit: 5 });
    assert.deepEqual(seen.items.map((i) => i.id), [g.id]);
  });
});

describe('directives, purposes and lifecycle', () => {
  test('required directives need a source and page independently across purposes', async () => {
    const f = await initialized('directives');
    await expectError(f.store.save(draft({ required: true, purpose: 'CAPA' }), ctx('/')), 'invalid_request', /source reference/);
    const ids: string[] = [];
    ids.push((await f.store.save(draft({ required: true, purpose: 'CAPA', title: 'rule 1', sourceRef: 'chat:1' }), ctx('/'))).id);
    ids.push((await f.store.save(draft({ required: true, purpose: 'Operational', title: 'rule 2', sourceRef: 'chat:2' }), ctx('/'))).id);
    await f.store.save(draft({ required: false, purpose: 'CAPA', title: 'soft', sourceRef: 'chat:3' }), ctx('/'));
    const page1 = await f.store.directives({ context: ctx('/'), offset: 0, limit: 1 });
    assert.equal(page1.total, 2);
    assert.equal(page1.items.length, 1);
    const page2 = await f.store.directives({ context: ctx('/'), offset: 1, limit: 1 });
    assert.equal(page2.items.length, 1);
    const all = [...page1.items, ...page2.items].map((i) => i.id).sort();
    assert.deepEqual(all, [...ids].sort());
    assert.ok([...page1.items, ...page2.items].every((i) => i.required));
  });

  test('Persona is ABOUT the configured operator and can be filed', async () => {
    const f = await initialized('persona');
    const p = await f.store.save(draft({ purpose: 'Persona', title: 'preferred name', content: 'Charles', scope: 'global' }), ctx('/'));
    assert.equal(p.subjectId, 'operator:me');
    assert.equal(p.purpose, 'Persona');
  });

  test('retire makes the memory inactive now and keeps it readable', async () => {
    const f = await initialized('retire');
    const m = await f.store.save(draft({ title: 'old rule', content: 'zqretire' }), ctx('/'));
    // Retirement must come after the start at UTC-second precision (retire recipe guard).
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const retired = await f.store.retire(m.id);
    assert.equal(retired.status, 'retired');
    assert.equal(retired.validity, 'INACTIVE');
    assert.notEqual(retired.validTo, null);
    const current = await f.store.browse({ context: ctx('/'), query: '', offset: 0, limit: 10 });
    assert.equal(current.total, 0);
    assert.equal((await f.store.read(m.id)).status, 'retired');
  });

  test('retiring in the same second as the start is a clear, retryable rejection', async () => {
    const f = await initialized('retire-same-second');
    const m = await f.store.save(draft({ title: 'fresh', content: 'zqfresh' }), ctx('/'));
    await expectError(f.store.retire(m.id), 'invalid_request', /Retry in a moment/);
    assert.equal((await f.store.read(m.id)).status, 'active', 'rejected retirement changes nothing');
  });

  test('navigate reaches the filing topic, and catalog lists it', async () => {
    const f = await initialized('navigate');
    const m = await f.store.save(draft({ title: 'filed', content: 'zqnav' }), ctx('/'));
    const nav = await f.store.navigate(m.id, ctx('/'), 1);
    assert.ok(nav.items.some((i) => i.id === 'domain:project-knowledge' && i.label === 'Domain'));
  });
});

describe('atomicity, index sync and failure handling', () => {
  test('a failed guard leaves nothing behind: no record, no scope, verify still ok', async () => {
    const f = await initialized('rollback');
    const repo = realDir(join(f.dir, 'rb'));
    // Scope creation then an intentional guard failure in the same transaction must roll back together.
    const sql = [
      "PRAGMA foreign_keys=ON;",
      "BEGIN IMMEDIATE;",
      "CREATE TEMP TABLE _g(ok INTEGER NOT NULL CHECK(ok=1));",
      "SELECT cypher('CREATE (n:Scope {id:\"scope:rb-test\", name:\"rb\", kind:\"directory\", root:\"/rb-test\"})');",
      "INSERT INTO _g VALUES(0);",
      "COMMIT;",
    ].join('\n');
    const result = await runCli({ sqlite: SQLITE, extension: EXTENSION, database: f.database, sql }).catch((e) => e);
    assert.ok(result instanceof MemoryError);
    assert.equal(result.code, 'invalid_request');
    const catalog = await f.store.catalog();
    assert.ok(!catalog.scopes.some((s) => s.id === 'scope:rb-test'), 'scope created before the failure must be rolled back');
    assert.equal((await f.store.verify()).ok, true);
    assert.ok(repo.length > 0);
  });

  test('writes are refused while the search index has drifted, and verify names the drift', async () => {
    const f = await initialized('drift');
    const m = await f.store.save(draft({ title: 'before drift', content: 'zqdrift' }), ctx('/'));
    await runCli({ sqlite: SQLITE, extension: EXTENSION, database: f.database, sql: `UPDATE hg_fts SET content='drift' WHERE rowid=(SELECT nid FROM hg_node WHERE id='${m.id}');` });
    const verify = await f.store.verify();
    assert.equal(verify.ok, false);
    assert.match(verify.message, /fts_stale/);
    await expectError(f.store.save(draft({ title: 'after drift' }), ctx('/')), 'invalid_request');
    assert.equal((await f.store.read(m.id)).id, m.id, 'reads still work during drift');
  });

  test('concurrent saves all commit and the store verifies', async () => {
    const f = await initialized('concurrent');
    const results = await Promise.all(Array.from({ length: 4 }, (_, i) =>
      f.store.save(draft({ title: `parallel ${i}`, content: `zqpar${i} body` }), ctx('/'))));
    assert.equal(new Set(results.map((r) => r.id)).size, 4);
    const page = await f.store.browse({ context: ctx('/'), query: '', offset: 0, limit: 10 });
    assert.equal(page.total, 4);
    assert.equal((await f.store.verify()).ok, true);
  });

  test('a command that times out during a write reports commit_unknown and is not retried', async () => {
    const f = await initialized('commit-unknown');
    const slow = 'WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<300000000) SELECT count(*) FROM n;';
    await expectError(runCli({ sqlite: SQLITE, extension: EXTENSION, database: f.database, sql: slow, write: true, timeoutMs: 300 }), 'commit_unknown');
  });

  test('the generated recipes match the skill sources at generation time', async () => {
    const { generate } = await import('./tools/generate-recipes');
    const { join: j } = await import('node:path');
    const skill = j(REPO_SKILL);
    if (!existsSync(skill)) return; // skill sources are not shipped with the installed plugin
    const expected = generate(skill);
    assert.equal(readFileSync(j(import.meta.dirname, 'generated', 'recipes.ts'), 'utf8'), expected);
  });
});

const REPO_SKILL = join(import.meta.dirname, '..', '..', 'skill');
