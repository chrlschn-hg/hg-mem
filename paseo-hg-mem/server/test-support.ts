/// <reference types="node" />
// Test fixtures: disposable databases under .local/test-data only.
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MemorySettings } from '../shared/settings';
import { MemorySettingsSchema } from '../shared/settings';

const here = dirname(fileURLToPath(import.meta.url));
export const REPO = join(here, '..', '..');
export const SANDBOX = join(REPO, '.local', 'test-data');
export const SQLITE = process.env.HG_SQLITE ?? '/opt/homebrew/opt/sqlite/bin/sqlite3';
export const EXTENSION = process.env.HG_EXT ?? join(REPO, '.local', 'runtime', 'graphqlite.dylib');

export function sandboxDir(name: string): string {
  mkdirSync(SANDBOX, { recursive: true });
  return mkdtempSync(join(SANDBOX, `${name}-`));
}

export function cleanup(dir: string): void {
  if (!dir.startsWith(SANDBOX)) throw new Error(`refusing to remove ${dir}`);
  rmSync(dir, { recursive: true, force: true });
}

// Realpath of a directory created for a test (macOS /var -> /private/var).
export function realDir(dir: string): string {
  mkdirSync(dir, { recursive: true });
  return realpathSync.native(dir);
}

export function settingsFor(database: string, overrides: Partial<MemorySettings> = {}): MemorySettings {
  return MemorySettingsSchema.parse({
    enabled: true,
    databasePath: database,
    sqlitePath: SQLITE,
    extensionPath: EXTENSION,
    operatorId: 'operator:me',
    operatorName: 'Me',
    ...overrides,
  });
}

export function freshDatabase(name: string): { dir: string; database: string } {
  const dir = sandboxDir(name);
  return { dir, database: join(dir, 'memories.db') };
}

export function present(path: string): boolean {
  return existsSync(path);
}
