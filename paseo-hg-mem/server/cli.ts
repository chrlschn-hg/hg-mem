/// <reference types="node" />
// One SQLite CLI process per operation. The script is built from trusted recipes and bound
// request JSON (hex-encoded), so user text never enters SQL. stdout is returned only on exit 0.
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { MemoryError } from './errors';

export interface CliCall {
  sqlite: string;
  extension: string;
  database: string;
  // Bound parameters: @p (request object) and optionally @q (second object). Omitted when undefined.
  p?: unknown;
  q?: unknown;
  // Trusted SQL: recipes joined with generated text. Never add user content here.
  sql: string;
  // Output redirection: recipe output is discarded; only the trailing `final` select is returned.
  final?: string;
  // Whether a failure after COMMIT may have hidden a commit (write operations only).
  write?: boolean;
  // Read-only operations open the database with -readonly, so a probe cannot checkpoint or write.
  readonly?: boolean;
  // The recipe prints its own result (for example the explore page): do not discard recipe output.
  keepOutput?: boolean;
  timeoutMs?: number;
}

export interface CliResult { stdout: string; stderr: string }

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

const live = new Set<ChildProcessWithoutNullStreams>();

// Stop every running child. The store calls this from dispose().
export function killAllCli(): void {
  for (const child of live) child.kill('SIGTERM');
  live.clear();
}

export function hexJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('hex');
}

export function parameterLine(name: 'p' | 'q', value: unknown): string {
  return `.parameter set @${name} "CAST(X'${hexJson(value)}' AS TEXT)"`;
}

// Sentinel printed only when the script reaches the statements after COMMIT.
export const COMMITTED_SENTINEL = '__HG_COMMITTED__';

export function buildScript(call: Pick<CliCall, 'p' | 'q' | 'sql' | 'final' | 'write' | 'keepOutput'>): string {
  const lines = ['PRAGMA foreign_keys=ON;', '.parameter init'];
  if (call.p !== undefined) lines.push(parameterLine('p', call.p));
  if (call.q !== undefined) lines.push(parameterLine('q', call.q));
  if (call.keepOutput) {
    lines.push(call.sql, '.output stdout');
  } else {
    lines.push('.output /dev/null', call.sql, '.output stdout', '.headers off', '.mode list');
  }
  if (call.write) lines.push(`SELECT '${COMMITTED_SENTINEL}';`);
  if (call.final !== undefined) lines.push(call.final);
  return lines.join('\n') + '\n';
}

function safePath(value: string, label: string): string {
  if (value === '' || /["\n\r]/.test(value)) {
    throw new MemoryError('setup_invalid', `${label} must be a non-empty path without quotes or newlines`);
  }
  return value;
}

// Runs one CLI invocation. Rejects with a MemoryError whose code tells the caller what is known.
export function runCli(call: CliCall): Promise<CliResult> {
  const script = buildScript(call);
  const args = [
    '-bail',
    ...(call.readonly ? ['-readonly'] : []),
    '-cmd', `.load "${safePath(call.extension, 'extension path')}"`,
    '-cmd', '.timeout 8000',
    safePath(call.database, 'database path'),
  ];
  return new Promise<CliResult>((resolve, reject) => {
    const child = spawn(call.sqlite, args, { stdio: 'pipe' });
    live.add(child);
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let oversized = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, call.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
      if (stdout.length > MAX_OUTPUT_BYTES) { oversized = true; child.kill('SIGKILL'); }
    });
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });
    child.on('error', (error) => {
      clearTimeout(timer);
      live.delete(child);
      reject(new MemoryError('setup_invalid', `cannot start SQLite CLI at configured path: ${error.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      live.delete(child);
      if (code === 0 && !timedOut && !oversized) {
        resolve({ stdout, stderr });
        return;
      }
      const sqlError = /Error near line \d+: ([\s\S]*)/.exec(stderr);
      if (call.write && stdout.includes(COMMITTED_SENTINEL)) {
        reject(new MemoryError('database_error', 'The change was saved, but its confirmation could not be read. Check the memory before saving again.'));
        return;
      }
      if (sqlError && !timedOut && !oversized) {
        reject(new MemoryError('invalid_request', sqlError[1].trim()));
        return;
      }
      if (call.write) {
        reject(new MemoryError('commit_unknown',
          'The write did not report success. Nothing was retried. Check the memory before saving again.'));
        return;
      }
      reject(new MemoryError('database_error', timedOut ? 'The database command timed out.' : `The database command failed: ${stderr.trim() || 'no output'}`));
    });
    child.stdin.on('error', () => { /* child closed early; close handler reports */ });
    child.stdin.end(script);
  });
}

// Last non-empty stdout line; the final select prints one JSON document on one line.
export function lastLine(stdout: string): string {
  const lines = stdout.split('\n').filter((line) => line.trim() !== '');
  return lines[lines.length - 1] ?? '';
}

export function parseFinal(stdout: string): unknown {
  const line = lastLine(stdout);
  try {
    return JSON.parse(line);
  } catch {
    throw new MemoryError('database_error', 'The database returned an unreadable result.');
  }
}
