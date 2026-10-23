import test from 'node:test';
import assert from 'node:assert/strict';
import type { PluginSessionOpenRequest } from '@getpaseo/plugin/server';
import { MemorySettingsSchema } from '../shared/settings';
import { MEMORY_ENV_KEYS, SessionIntegration, checkSessionConfiguration } from './session-integration';

const settings = () => MemorySettingsSchema.parse({ enabled: true, databasePath: '/memory/store.db',
  sqlitePath: '/tools/sqlite3', extensionPath: '/tools/graphqlite.dylib', skillsDirectory: '/memory/skills', operatorId: 'operator:human' });
const request = (patch: Partial<PluginSessionOpenRequest> = {}): PluginSessionOpenRequest => ({
  agentId: 'session-1', workspaceId: 'workspace-1', cwd: '/repo', provider: 'codex',
  reason: 'create', purpose: 'interactive', env: { OTHER_PLUGIN: 'kept', HG_DB: '/wrong.db', HG_MEMORY_ERROR: 'old error' }, ...patch,
});

test('delivers seven keys, uses daemon scopes and identity, preserves other overrides, and clears old errors', async () => {
  const integration = new SessionIntegration({ settings: async () => settings(), check: () => {},
    context: async () => ({ cwd: '/real/repo', scopeIds: ['scope:project'] }) });
  const result = await integration.open(request());
  for (const key of MEMORY_ENV_KEYS) assert.ok(result.env[key], key);
  assert.equal(result.env.HG_DB, '/memory/store.db');
  assert.equal(result.env.HG_AGENT, 'agent:session-1');
  assert.equal(result.env.HG_SCOPE_IDS, '["scope:project"]');
  assert.equal(result.env.OTHER_PLUGIN, 'kept');
  assert.equal(result.env.HG_MEMORY_ERROR, undefined);
  assert.equal(integration.snapshot().lastAttempt?.state, 'injected');
});

test('resume, refresh and import recompute configuration without database health probes', async () => {
  let value = settings();
  const integration = new SessionIntegration({ settings: async () => value, check: () => {},
    context: async () => ({ cwd: '/repo', scopeIds: [] }) });
  for (const reason of ['create', 'resume', 'refresh', 'import'] as const) {
    value = { ...value, databasePath: `/memory/${reason}.db` };
    const result = await integration.open(request({ reason, agentId: reason, provider: reason === 'resume' ? 'claude' : 'codex' }));
    assert.equal(result.env.HG_DB, `/memory/${reason}.db`);
    assert.equal(result.env.HG_AGENT, `agent:${reason}`);
    assert.equal(integration.snapshot().lastAttempt?.reason, reason);
  }
});

test('workspace failure strips stale managed values and delivers an error instead of falling back to global', async () => {
  let fail = true;
  const logs: string[] = [];
  const integration = new SessionIntegration({ settings: async () => settings(), check: () => {},
    context: async () => { if (fail) throw new Error('Workspace unavailable'); return { cwd: '/repo', scopeIds: ['scope:project'] }; },
    log: attempt => { logs.push(attempt.state); } });
  const bad = await integration.open(request());
  for (const key of MEMORY_ENV_KEYS) assert.equal(bad.env[key], undefined);
  assert.equal(bad.env.HG_MEMORY_ERROR, 'Workspace unavailable');
  assert.equal(bad.env.OTHER_PLUGIN, 'kept');
  fail = false;
  await integration.open(request({ reason: 'refresh' }));
  assert.equal(integration.snapshot().lastAttempt?.state, 'injected');
  assert.equal(integration.snapshot().lastFailure?.message, 'Workspace unavailable');
  assert.deepEqual(logs, ['error', 'injected']);
});

test('disabled integration leaves explicit user launch values unchanged and does no workspace or file work', async () => {
  const integration = new SessionIntegration({ settings: async () => ({ ...settings(), agentIntegrationEnabled: false }),
    check: () => assert.fail('file check'), context: async () => { throw new Error('must not run'); } });
  const input = request();
  assert.equal(await integration.open(input), input);
  assert.equal(integration.snapshot().lastAttempt?.state, 'skipped');
});

test('settings and cheap path failures remain visible without failing session creation', async () => {
  const integration = new SessionIntegration({ settings: async () => { throw new Error('Invalid settings'); } });
  assert.equal((await integration.open(request())).env.HG_MEMORY_ERROR, 'Invalid settings');
  assert.equal((await integration.open(request())).env.HG_DB, '/wrong.db');
  assert.equal(integration.snapshot().lastFailure?.state, 'error');
  assert.throws(() => checkSessionConfiguration({ ...settings(), sqlitePath: 'relative' }, () => true), /SQLite CLI/);
  assert.throws(() => checkSessionConfiguration(settings(), file => !file.endsWith('SKILL.md')), /workflow skill/);
  checkSessionConfiguration(settings(), () => true);
});

test('keeps bounded per-session diagnostics and separates history opens from interactive results', async () => {
  const integration = new SessionIntegration({ settings: async () => settings(), check: () => {},
    context: async () => ({ cwd: '/repo', scopeIds: [] }) });
  await integration.open(request({ agentId: 'interactive' }));
  await integration.open(request({ agentId: 'interactive', purpose: 'history', reason: 'resume' }));
  assert.equal(integration.snapshot().lastAttempt?.purpose, 'interactive');
  assert.equal(integration.snapshot().attempts.length, 2);
  for (let i = 0; i < 55; i++) await integration.open(request({ agentId: `agent-${i}` }));
  assert.equal(integration.snapshot().attempts.length, 50);
  assert.equal(integration.snapshot().attempts[0].agentId, 'agent-54');
});

test('parallel session lookups retain their own context callbacks and tolerate logging failure', async () => {
  const integration = new SessionIntegration({ settings: async () => settings(), check: () => {}, log: () => { throw new Error('log sink down'); } });
  const [a,b] = await Promise.all([
    integration.open(request({ agentId: 'a' }), async () => ({ cwd: '/a', scopeIds: ['a'] })),
    integration.open(request({ agentId: 'b' }), async () => ({ cwd: '/b', scopeIds: ['b'] })),
  ]);
  assert.equal(a.env.HG_AGENT, 'agent:a'); assert.equal(a.env.HG_SCOPE_IDS, '["a"]');
  assert.equal(b.env.HG_AGENT, 'agent:b'); assert.equal(b.env.HG_SCOPE_IDS, '["b"]');
});
