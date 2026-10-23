/// <reference types="node" />
// Host-side detection for setup suggestions. Suggestions never initialize or modify anything.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, isAbsolute, posix } from 'node:path';
import { MemoryError } from './errors';

// Official GraphQLite v0.12.0 macOS arm64 loadable library (release digest).
export const OFFICIAL_EXTENSION_SHA256 = '46ff8b643847840a48806bfa1ed1bb27762cdbd08a72d7d3b04b4bbae0b2e886';

const SQLITE_CANDIDATES = ['/opt/homebrew/opt/sqlite/bin/sqlite3', '/usr/local/opt/sqlite/bin/sqlite3'];

export function suggestedDatabasePath(): string {
  return join(homedir(), '.paseo', 'hg-mem', 'memories.db');
}

export function suggestedExtensionPath(): string {
  // Only the location the setup flow writes to; no source-checkout or developer paths.
  return join(homedir(), '.paseo', 'hg-mem', 'runtime', 'graphqlite-0.12.0-macos-arm64.dylib');
}

export function suggestedSqlitePath(): string {
  return SQLITE_CANDIDATES.find((path) => existsSync(path)) ?? '';
}

export function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function isExecutableFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

// Canonical working directory for eligibility and workspace scopes. Rejects non-canonical input
// rather than silently rewriting it. Symlinks are resolved by the caller through realpath when present.
export function canonicalCwd(cwd: string): string {
  if (!isAbsolute(cwd)) {
    throw new MemoryError('invalid_request', 'The working directory must be an absolute path.');
  }
  if (cwd === '/') return '/';
  const trimmed = cwd.endsWith('/') ? cwd.slice(0, -1) : cwd;
  if (trimmed.includes('//') || trimmed.includes('/./') || trimmed.includes('/../') || /\/\.\.?$/.test(trimmed)) {
    throw new MemoryError('invalid_request', 'The working directory must be canonical (no //, ., or .. segments).');
  }
  if (posix.normalize(trimmed) !== trimmed) {
    throw new MemoryError('invalid_request', 'The working directory must be canonical.');
  }
  return trimmed;
}
