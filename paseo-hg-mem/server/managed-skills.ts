import { createHash, randomUUID } from 'node:crypto';
import { cp, lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { SKILL_ASSETS, SKILL_ASSET_SHA256, LEGACY_SKILL_SHA256 } from './skill-assets';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const names = [...new Set(Object.keys(SKILL_ASSETS).map(p => p.split('/')[0]))];
const legacyNames = [...new Set(Object.keys(LEGACY_SKILL_SHA256).map(p => p.split('/')[0]))];
type Hashes = Record<string, string>;
type Manifest = { owner: 'hg-mem'; version: 1; root: string; files: Hashes; installedAt: string };
export type SkillInstallResult = { message: string; directories: string[]; migrated: string[]; warnings: string[] };
export type SkillLocations = { primary: string; home?: string; codexHome?: string; stateDirectory?: string };

async function stat(file: string) {
  try { return await lstat(file); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

// Reject symlinks within a skill; never follow links while adopting or replacing files.
async function tree(directory: string, prefix = ''): Promise<Hashes> {
  const result: Hashes = {};
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const rel = prefix + item.name;
    if (item.isSymbolicLink()) throw new Error(`Preserved symlink: ${path.join(directory, item.name)}`);
    if (item.isDirectory()) Object.assign(result, await tree(path.join(directory, item.name), rel + '/'));
    else if (item.isFile()) result[rel] = digest(await readFile(path.join(directory, item.name), 'utf8'));
    else throw new Error(`Unsupported skill entry: ${path.join(directory, item.name)}`);
  }
  return result;
}

function subset(all: Hashes, name: string): Hashes {
  return Object.fromEntries(Object.entries(all).filter(([p]) => p.startsWith(name + '/')).map(([p,h]) => [p.slice(name.length + 1), h]));
}
function equal(a: Hashes, b: Hashes) {
  return Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([p,h]) => b[p] === h);
}
async function targets(options: SkillLocations) {
  if (!path.isAbsolute(options.primary) || path.resolve(options.primary) === path.parse(options.primary).root) throw new Error('Choose an absolute skills folder below the filesystem root.');
  const home = options.home ?? homedir();
  if (path.resolve(options.primary) === path.resolve(home)) throw new Error('Choose a skills folder, not the home directory.');
  const roots = [options.primary, path.join(home, '.agents', 'skills')];
  const warnings: string[] = [];
  if (await stat(path.join(home, '.claude'))) roots.push(path.join(home, '.claude', 'skills'));
  else warnings.push('Claude is not configured on this host; its skills folder was skipped.');
  const codex = options.codexHome;
  if (codex) {
    if (!path.isAbsolute(codex)) throw new Error('CODEX_HOME must be absolute.');
    roots.push(path.join(codex, 'skills'));
  }
  const resolved: string[] = [];
  for (const root of [...new Set(roots.map(p => path.resolve(p)))]) {
    // Resolve aliases before assigning ownership. Missing suffixes are created on install only.
    let parent = root, suffix: string[] = [];
    while (!await stat(parent)) { suffix.unshift(path.basename(parent)); parent = path.dirname(parent); }
    const value = path.join(await realpath(parent), ...suffix);
    if (!resolved.includes(value)) resolved.push(value);
  }
  return { roots: resolved, warnings, state: options.stateDirectory ?? path.join(home, '.paseo', 'hg-mem', 'skill-installs') };
}

async function manifestFor(state: string, root: string): Promise<Manifest | null> {
  const file = path.join(state, digest(root) + '.json');
  if (!await stat(file)) return null;
  const value = JSON.parse(await readFile(file, 'utf8')) as Manifest;
  if (value.owner !== 'hg-mem' || value.version !== 1 || value.root !== root || !value.files || typeof value.files !== 'object') throw new Error(`Invalid skill ownership record: ${file}`);
  return value;
}

async function archive(source: string, target: string) {
  await mkdir(path.dirname(target), { recursive: true });
  try { await rename(source, target); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
    // A configured folder may live on another volume. Keep a verified backup first.
    const info = await lstat(source);
    await cp(source, target, { recursive: true, dereference: false, verbatimSymlinks: true, errorOnExist: true, force: false });
    if (!info.isSymbolicLink() && !equal(await tree(source), await tree(target))) throw new Error(`Backup verification failed: ${source}`);
    await rm(source, { recursive: true });
  }
}

async function acquireLock(lock: string) {
  try { await mkdir(lock); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    let dead = false;
    try {
      const owner = JSON.parse(await readFile(path.join(lock, 'owner.json'), 'utf8'));
      if (Number.isInteger(owner.pid) && owner.pid > 0) {
        try { process.kill(owner.pid, 0); } catch (probe) { dead = (probe as NodeJS.ErrnoException).code === 'ESRCH'; }
      }
    } catch {
      const info = await lstat(lock);
      dead = Date.now() - info.mtimeMs > 5 * 60_000;
    }
    if (!dead) throw new Error('A skill installation is already running. Try again after it finishes.');
    await rm(lock, { recursive: true });
    await mkdir(lock);
  }
  await writeFile(path.join(lock, 'owner.json'), JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
}

/** Does not initialize or open a database. Existing foreign/modified trees are never overwritten. */
export async function installManagedSkills(options: SkillLocations): Promise<SkillInstallResult> {
  const { roots, warnings, state } = await targets(options);
  await mkdir(state, { recursive: true });
  const lock = path.join(state, 'install.lock');
  await acquireLock(lock);
  const migrated: string[] = [];
  const completed: string[] = [];
  try {
    const plans: { root: string; manifest: Manifest | null; legacy: string[]; aliases: string[] }[] = [];
    // Preflight every destination before changing any skill.
    for (const root of roots) {
      const manifest = await manifestFor(state, root);
      const aliases: string[] = [];
      for (const name of names) {
        const dest = path.join(root, name), info = await stat(dest);
        if (!info) continue;
        let source = dest, sourceManifest = manifest;
        if (info.isSymbolicLink()) {
          source = await realpath(dest);
          const targetRoot = roots.find(r => r !== root && source === path.join(r, name));
          if (!targetRoot || (await lstat(source)).isSymbolicLink()) throw new Error(`Preserved conflicting skill path: ${dest}. Foreign symlinks are not changed.`);
          sourceManifest = await manifestFor(state, targetRoot);
          aliases.push(name);
        } else if (!info.isDirectory()) throw new Error(`Preserved conflicting skill path: ${dest}`);
        const actual = await tree(source);
        if (!equal(actual, subset(SKILL_ASSET_SHA256, name)) && !equal(actual, subset(sourceManifest?.files ?? {}, name))) {
          throw new Error(`Preserved modified or unrelated skill: ${dest}. No skills were changed.`);
        }
      }
      const legacy: string[] = [];
      for (const name of legacyNames) {
        const dest = path.join(root, name), info = await stat(dest);
        if (!info) continue;
        try {
          const source = info.isSymbolicLink() ? await realpath(dest) : dest;
          // Only known aliases to another destination may be migrated.
          if (info.isSymbolicLink() && !roots.some(r => source === path.join(r, name))) throw new Error('foreign symlink');
          const actual = await tree(source);
          const expected = Object.entries(LEGACY_SKILL_SHA256).filter(([p]) => p.startsWith(name + '/'));
          if (Object.keys(actual).length !== expected.length || !expected.every(([p,hashes]) => hashes.includes(actual[p.slice(name.length + 1)]))) throw new Error('modified tree');
          legacy.push(name);
        } catch {
          warnings.push(`Preserved unrecognized or modified legacy skill: ${dest}`);
        }
      }
      plans.push({ root, manifest, legacy, aliases });
    }
    for (const { root, legacy, aliases } of plans) {
      await mkdir(root, { recursive: true });
      for (const name of names) {
        if (aliases.includes(name)) continue;
        const dest = path.join(root, name);
        if (await stat(dest) && equal(await tree(dest), subset(SKILL_ASSET_SHA256, name))) continue;
        const staging = path.join(root, `.hg-mem-stage-${randomUUID()}`);
        await mkdir(staging);
        try {
          for (const [rel, content] of Object.entries(SKILL_ASSETS).filter(([p]) => p.startsWith(name + '/'))) {
            const file = path.join(staging, rel.slice(name.length + 1));
            await mkdir(path.dirname(file), { recursive: true });
            await writeFile(file, content, { flag: 'wx', mode: 0o644 });
          }
          let backup: string | null = null;
          if (await stat(dest)) {
            backup = path.join(state, 'backups', randomUUID(), name);
            await archive(dest, backup);
          }
          try { await rename(staging, dest); } catch (error) {
            if (backup) await archive(backup, dest);
            throw error;
          }
        } finally { await rm(staging, { recursive: true, force: true }); }
      }
      // Archive recognized legacy trees outside provider discovery. No hard deletion.
      for (const name of legacy) {
        const dest = path.join(root, name);
        const backup = path.join(state, 'backups', randomUUID(), name);
        await archive(dest, backup);
        migrated.push(dest);
      }
      const record: Manifest = { owner: 'hg-mem', version: 1, root, files: { ...SKILL_ASSET_SHA256 }, installedAt: new Date().toISOString() };
      const file = path.join(state, digest(root) + '.json'), temp = file + '.' + randomUUID();
      await writeFile(temp, JSON.stringify(record, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
      await rename(temp, file);
      completed.push(root);
    }
    return { directories: roots, migrated, warnings, message: `Installed ${names.length} memory skills. Open a new agent session to refresh its skill list.` };
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)} Completed folders: ${completed.join(', ') || 'none'}. Archived old copies: ${migrated.length}. Retry after resolving the reported problem.`);
  } finally { await rm(lock, { recursive: true, force: true }); }
}

export async function managedSkillsCurrent(options: SkillLocations): Promise<boolean> {
  try {
    const { roots, state } = await targets(options);
    for (const root of roots) {
      const manifest = await manifestFor(state, root);
      if (!manifest || !equal(manifest.files, { ...SKILL_ASSET_SHA256 })) return false;
      for (const name of names) {
        const info = await stat(path.join(root, name));
        if (!info) return false;
        let source = path.join(root, name);
        if (info.isSymbolicLink()) {
          source = await realpath(source);
          if (!roots.some(r => r !== root && source === path.join(r, name))) return false;
        } else if (!info.isDirectory()) return false;
        if (!equal(await tree(source), subset(SKILL_ASSET_SHA256, name))) return false;
      }
    }
    return true;
  } catch { return false; }
}
