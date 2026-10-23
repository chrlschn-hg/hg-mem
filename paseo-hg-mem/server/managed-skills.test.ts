import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { installManagedSkills, managedSkillsCurrent } from './managed-skills';

async function fixture(t: { after(fn: () => Promise<void>): void }) {
  const base = path.resolve('../.local/test-data');
  await mkdir(base, { recursive: true });
  const home = await mkdtemp(path.join(base, 'skill-install-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  await mkdir(path.join(home, '.claude'));
  const primary = path.join(home, 'plugin-skills');
  const stateDirectory = path.join(home, 'state');
  return { home, primary, stateDirectory };
}

test('installs discoverable copies and primary files; repeated install is current without touching unrelated skills', async t => {
  const options = await fixture(t);
  const unrelated = path.join(options.home, '.agents/skills/other/SKILL.md');
  await mkdir(path.dirname(unrelated), { recursive: true });
  await writeFile(unrelated, 'user-owned');
  const result = await installManagedSkills(options);
  assert.equal(result.directories.length, 3);
  assert.equal(await managedSkillsCurrent(options), true);
  const again = await installManagedSkills(options);
  assert.deepEqual(again.migrated, []);
  assert.equal(await readFile(unrelated, 'utf8'), 'user-owned');
  assert.match(await readFile(path.join(options.home, '.claude/skills/memory-workflow/SKILL.md'), 'utf8'), /name: memory-workflow/);
});

test('preflight refuses modified files in any destination before replacing the primary', async t => {
  const options = await fixture(t);
  await installManagedSkills(options);
  const modified = path.join(options.home, '.claude/skills/memory-write/SKILL.md');
  await writeFile(modified, 'my edits');
  assert.equal(await managedSkillsCurrent(options), false);
  await assert.rejects(installManagedSkills(options), /Preserved modified/);
  assert.equal(await readFile(modified, 'utf8'), 'my edits');
});

test('updates hash-owned trees and removes obsolete owned files with a whole-tree swap', async t => {
  const options = await fixture(t);
  await installManagedSkills(options);
  const old = 'previous shipped version';
  const rel = 'memory-write/obsolete.md';
  await writeFile(path.join(options.primary, rel), old);
  const record = path.join(options.stateDirectory, createHash('sha256').update(options.primary).digest('hex') + '.json');
  const manifest = JSON.parse(await readFile(record, 'utf8'));
  manifest.files[rel] = createHash('sha256').update(old).digest('hex');
  await writeFile(record, JSON.stringify(manifest));
  await installManagedSkills(options);
  await assert.rejects(readFile(path.join(options.primary, rel)), { code: 'ENOENT' });
  assert.equal(await managedSkillsCurrent(options), true);
});

test('preserves foreign symlinks, unrecognized legacy directories and user additions', async t => {
  const options = await fixture(t);
  const legacy = path.join(options.home, '.agents/skills/hg-mem');
  await mkdir(legacy, { recursive: true });
  await writeFile(path.join(legacy, 'SKILL.md'), 'not a shipped copy');
  const result = await installManagedSkills(options);
  assert.match(result.warnings.join('\n'), /Preserved unrecognized/);
  assert.equal(await readFile(path.join(legacy, 'SKILL.md'), 'utf8'), 'not a shipped copy');
  const folder = path.join(options.primary, 'memory-write');
  await writeFile(path.join(folder, 'custom.md'), 'keep');
  await assert.rejects(installManagedSkills(options), /Preserved modified/);
  await rm(folder, { recursive: true });
  await symlink(legacy, folder);
  await assert.rejects(installManagedSkills(options), /conflicting skill path/);
  assert.equal(await readFile(path.join(legacy, 'SKILL.md'), 'utf8'), 'not a shipped copy');
});

test('deduplicates root aliases, honors absolute CODEX_HOME, and releases the lock after rejection', async t => {
  const options = await fixture(t);
  const agents = path.join(options.home, '.agents/skills');
  await mkdir(agents, { recursive: true });
  await symlink(agents, options.primary);
  const result = await installManagedSkills({ ...options, codexHome: path.join(options.home, '.custom-codex') });
  assert.equal(result.directories.length, 3);
  assert.ok(result.directories.includes(path.join(options.home, '.custom-codex/skills')));
  await assert.rejects(installManagedSkills({ ...options, codexHome: 'relative' }), /must be absolute/);
  assert.equal((await readdir(options.stateDirectory)).includes('install.lock'), false);
});

test('preserves per-skill aliases to a managed root and recovers a dead installer lock', async t => {
  const options = await fixture(t);
  await installManagedSkills(options);
  const alias = path.join(options.home, '.claude/skills/memory-write');
  await rm(alias, { recursive: true });
  await symlink(path.join(options.home, '.agents/skills/memory-write'), alias);
  const lock = path.join(options.stateDirectory, 'install.lock');
  await mkdir(lock);
  await writeFile(path.join(lock, 'owner.json'), JSON.stringify({ pid: 2147483647, at: '2000-01-01' }));
  await installManagedSkills(options);
  assert.equal(await managedSkillsCurrent(options), true);
});
