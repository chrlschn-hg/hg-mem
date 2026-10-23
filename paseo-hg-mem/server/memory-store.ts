/// <reference types="node" />
// Daemon-local memory service. Every operation runs one SQLite CLI process: trusted recipes plus
// bound JSON requests, one transaction for writes, stdout returned only after exit 0.
import { existsSync, realpathSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import type { MemorySettings } from '../shared/settings';
import {
  ExplorePageSchema, HealthSchema, MemoryPageSchema, MemoryRecordSchema,
  type ExplorePage, type MemoryContext, type MemoryDraft, type MemoryHealth, type MemoryPage, type MemoryRecord,
} from '../shared/contracts';
import { MemoryError } from './errors';
import { OFFICIAL_EXTENSION_SHA256, canonicalCwd, isExecutableFile, sha256File, suggestedDatabasePath, suggestedExtensionPath, suggestedSqlitePath } from './paths';
import { killAllCli, parseFinal, runCli, type CliCall } from './cli';
import { RECIPE_SQL } from './generated/recipes';
import * as q from './queries';

export const DEFAULT_PROJECT_DOMAIN = { id: 'domain:project-knowledge', name: 'Project knowledge' } as const;
export const GLOBAL_SCOPE_ID = 'scope:global';
const RUNTIME_VERSION = '0.12.0';
const CHECK_FAILURE = /CHECK constraint failed/;

export class MemoryStore {
  private readonly settings: MemorySettings;
  private runtimeChecked: Promise<void> | undefined;

  constructor(settings: MemorySettings) {
    this.settings = settings;
  }

  // Setup state and suggestions. Never creates or modifies the database.
  async health(): Promise<MemoryHealth> {
    const suggestions = {
      suggestedDatabasePath: suggestedDatabasePath(),
      suggestedSqlitePath: suggestedSqlitePath(),
      suggestedExtensionPath: suggestedExtensionPath(),
    };
    const skillsInstalled = this.settings.skillsDirectory !== '' && existsSync(`${this.settings.skillsDirectory}/memory-workflow/SKILL.md`);
    const base = { settings: this.settings, ...suggestions, skillsInstalled };
    const setup = (message: string, memoryCount = 0): MemoryHealth => HealthSchema.parse({ ...base, state: 'setup', message, memoryCount });
    const error = (message: string): MemoryHealth => HealthSchema.parse({ ...base, state: 'error', message, memoryCount: 0 });

    if (this.settings.sqlitePath === '') return setup('Choose the SQLite CLI path. Homebrew SQLite 3.53 or newer is required.');
    if (this.settings.extensionPath === '') return setup(`Choose the official GraphQLite ${RUNTIME_VERSION} macOS arm64 library.`);
    if (this.settings.databasePath === '') return setup('Choose a database path.');
    if (!isExecutableFile(this.settings.sqlitePath)) return error(`SQLite CLI not found at ${this.settings.sqlitePath}.`);
    if (!isExecutableFile(this.settings.extensionPath)) return error(`GraphQLite library not found at ${this.settings.extensionPath}.`);
    if (sha256File(this.settings.extensionPath) !== OFFICIAL_EXTENSION_SHA256) {
      return error('The library at the extension path is not the official GraphQLite 0.12.0 macOS arm64 release.');
    }
    try {
      await this.checkRuntime();
    } catch (cause) {
      return error(cause instanceof MemoryError ? cause.message : 'The SQLite runtime check failed.');
    }
    if (!existsSync(this.settings.databasePath)) {
      return setup('The database does not exist yet. Run initialize to create it.');
    }
    let count: number;
    try {
      count = await this.managedMemoryCount();
    } catch (cause) {
      return error(cause instanceof MemoryError ? cause.message : 'The database could not be read.');
    }
    if (this.settings.operatorId.trim() === '') return setup('Enter the operator ID for this memory store.', count);
    const operator = await this.operatorState(this.settings.operatorId).catch(() => 'unknown');
    if (operator !== 'operator') return setup('Operator needs initialization. Create/connect store to register it.', count);
    if (!this.settings.enabled) return setup('Setup is complete. Enable memory in settings to use it.', count);
    return HealthSchema.parse({ ...base, state: 'ready', message: 'Memory is ready.', memoryCount: count });
  }

  // Explicit setup action. Creates a new managed database, or validates an existing managed one.
  async initialize(_context?: MemoryContext): Promise<MemoryHealth> {
    this.requireConfiguredPaths();
    await this.checkRuntime();
    if (!existsSync(this.settings.databasePath)) {
      await this.call({ sql: RECIPE_SQL.bootstrap, write: true });
    } else {
      await this.managedMemoryCount(); // throws unmanaged_database for anything but hg-mem v1
    }
    await this.ensureOperator();
    await this.ensureDomain();
    return this.health();
  }

  async browse(input: { context: MemoryContext; query: string; offset: number; limit: number }): Promise<MemoryPage> {
    await this.requireReady();
    const query = input.query.trim();
    const request = { ...this.eligibleRequest(input.context), offset: input.offset, limit: input.limit, ...(query ? { query } : {}) };
    const sql = query ? `${RECIPE_SQL.eligible}\n${RECIPE_SQL.search}` : `${RECIPE_SQL.eligible}\nCOMMIT;`;
    const final = query ? q.BROWSE_SEARCH_PAGE : q.BROWSE_RECENT_PAGE;
    return MemoryPageSchema.parse(parseFinal((await this.call({ p: request, sql, final })).stdout));
  }

  // Human picker: every scope, no composer context. Snapshot applicability is not checked here.
  async browseAll(input: { query: string; offset: number; limit: number }): Promise<MemoryPage> {
    await this.requireReady();
    const query = input.query.trim();
    const request = { cwd: '/', scopes: [], offset: input.offset, limit: input.limit, ...(query ? { query } : {}) };
    const sql = `${RECIPE_SQL.eligible}\n${q.WIDEN_TO_ALL_SCOPES}\n${query ? RECIPE_SQL.search : 'COMMIT;'}`;
    const final = query ? q.BROWSE_ALL_SEARCH_PAGE : q.BROWSE_ALL_RECENT_PAGE;
    return MemoryPageSchema.parse(parseFinal((await this.call({ p: request, sql, final })).stdout));
  }

  // Explicit exploration from one seed. Current channels are eligibility-filtered before paging;
  // revisions returns history only. Context is required; it is resolved by the caller, never the client.
  async explore(input: { id: string; relation: 'filing' | 'subject' | 'revisions'; context: MemoryContext; offset: number; limit: number }): Promise<ExplorePage> {
    await this.requireReady();
    const request = { ...this.eligibleRequest(input.context), id: input.id, relation: input.relation, offset: input.offset, limit: input.limit };
    // The recipe prints the page itself, so the CLI and the service share one canonical result.
    const sql = `${RECIPE_SQL.eligible}\n${RECIPE_SQL.explore}`;
    return ExplorePageSchema.parse(parseFinal((await this.call({ p: request, sql, keepOutput: true })).stdout));
  }

  async directives(input: { context: MemoryContext; offset: number; limit: number }): Promise<MemoryPage> {
    await this.requireReady();
    const request = { ...this.eligibleRequest(input.context), offset: input.offset, limit: input.limit };
    const sql = `${RECIPE_SQL.eligible}\n${RECIPE_SQL.directives}`;
    return MemoryPageSchema.parse(parseFinal((await this.call({ p: request, sql, final: q.DIRECTIVES_PAGE })).stdout));
  }

  async read(id: string): Promise<MemoryRecord> {
    await this.requireReady();
    return this.recordOrThrow(id);
  }

  async save(draft: MemoryDraft, context: MemoryContext): Promise<MemoryRecord> {
    await this.requireReady();
    if (draft.required && (draft.sourceRef ?? '').trim() === '') {
      throw new MemoryError('invalid_request', 'A required directive needs a source reference that shows the instruction.');
    }
    const operatorId = this.settings.operatorId;
    if (!(await this.exists(operatorId))) {
      throw new MemoryError('setup_required', `The operator "${operatorId}" is not set up. Run initialize first.`);
    }
    const filingId = draft.filingId ?? (draft.purpose === 'Operational' ? DEFAULT_PROJECT_DOMAIN.id : undefined);
    if (filingId !== undefined && !(await this.exists(filingId))) {
      throw new MemoryError('invalid_request', `Filing "${filingId}" does not exist.`);
    }
    const scope = await this.resolveWriteScope(draft, context);
    const id = randomUUID();
    const request = {
      id,
      kind: draft.purpose,
      title: draft.title,
      content: draft.content,
      asserted_by: operatorId,
      assertion_kind: 'explicit',
      required: draft.required,
      scopes: [scope.candidate],
      ...(filingId !== undefined ? { filing: filingId } : {}),
      ...(draft.purpose === 'Persona' ? { subject: operatorId } : {}),
      ...((draft.sourceRef ?? '').trim() !== '' ? { source_ref: draft.sourceRef } : {}),
    };
    const sql = [
      RECIPE_SQL.begin,
      scope.body ? q.SCOPE_RESOLVE_IN_TXN : '',
      RECIPE_SQL.create,
      RECIPE_SQL.commit,
    ].join('\n');
    try {
      const { stdout } = await this.call({ p: request, q: scope.body, sql, final: q.READ_RECORD, write: true });
      return this.unwrapRecord(stdout, id);
    } catch (cause) {
      if (cause instanceof MemoryError && cause.code === 'invalid_request' && CHECK_FAILURE.test(cause.message)) {
        throw new MemoryError('invalid_request', 'The memory was not saved: it would break a memory rule (for example scope, purpose, or time). Adjust it and try again.');
      }
      throw cause;
    }
  }

  // Retire applicability now (effective at the current UTC second). Retained evidence stays readable.
  async retire(id: string): Promise<MemoryRecord> {
    await this.requireReady();
    await this.recordOrThrow(id);
    const sql = [RECIPE_SQL.begin, RECIPE_SQL.retire, RECIPE_SQL.commit].join('\n');
    try {
      const { stdout } = await this.call({ p: { id }, sql, final: q.READ_RECORD, write: true });
      return this.unwrapRecord(stdout, id);
    } catch (cause) {
      if (cause instanceof MemoryError && cause.code === 'invalid_request' && CHECK_FAILURE.test(cause.message)) {
        throw new MemoryError('invalid_request', 'The memory cannot be retired yet: it is not active now, or it started in the current second. Retry in a moment.');
      }
      throw cause;
    }
  }

  // Withdraw a mistaken or unwanted assertion from recall. The record and its evidence stay readable;
  // no predecessor is revived and nothing is deleted. Retracting an already retracted memory is rejected.
  async retract(id: string): Promise<MemoryRecord> {
    await this.requireReady();
    await this.recordOrThrow(id);
    const sql = [RECIPE_SQL.begin, RECIPE_SQL.retract, RECIPE_SQL.commit].join('\n');
    try {
      const { stdout } = await this.call({ p: { id }, sql, final: q.READ_RECORD, write: true });
      return this.unwrapRecord(stdout, id);
    } catch (cause) {
      if (cause instanceof MemoryError && cause.code === 'invalid_request' && CHECK_FAILURE.test(cause.message)) {
        throw new MemoryError('invalid_request', 'The memory was already removed from recall, so nothing changed.');
      }
      throw cause;
    }
  }

  async verify(): Promise<{ ok: boolean; message: string }> {
    await this.requireReady();
    try {
      await this.call({ sql: RECIPE_SQL.verify, writable: true });
      return { ok: true, message: 'Graph and search index verified.' };
    } catch (cause) {
      if (!(cause instanceof MemoryError) || cause.code !== 'invalid_request') throw cause;
      const { stdout } = await this.call({ final: q.VIOLATION_CODES });
      const violations = (parseFinal(stdout) as { violations: { code: string }[] }).violations.map((v) => v.code);
      const codes = [...new Set(violations)].join(', ');
      return { ok: false, message: codes ? `Verification failed: ${codes}.` : 'Verification failed: search index differs from the graph.' };
    }
  }

  async catalog(): Promise<{ scopes: { id: string; name: string; kind: string; root: string | null }[]; filing: { id: string; name: string; label: string }[] }> {
    await this.requireReady();
    const out = parseFinal((await this.call({ final: q.CATALOG })).stdout) as {
      scopes: { id: string; name: string; kind: string; root: string | null }[];
      filing: { id: string; name: string; label: string }[];
    };
    return out;
  }

  async navigate(id: string, context: MemoryContext, depth: number): Promise<{ items: { id: string; name: string; label: string; via: string; depth: number }[] }> {
    await this.requireReady();
    const request = { ...this.eligibleRequest(context), id, depth, limit: 200, offset: 0 };
    const sql = `${RECIPE_SQL.eligible}\n${RECIPE_SQL.navigate}`;
    return parseFinal((await this.call({ p: request, sql, final: q.NAVIGATE_ITEMS })).stdout) as {
      items: { id: string; name: string; label: string; via: string; depth: number }[];
    };
  }

  // Stops every child process this store started. Safe to call more than once.
  dispose(): void {
    killAllCli();
  }

  // ---------------------------------------------------------------- internals

  private requireConfiguredPaths(): void {
    if (this.settings.sqlitePath === '' || this.settings.extensionPath === '' || this.settings.databasePath === '') {
      throw new MemoryError('setup_required', 'Choose the SQLite CLI, the GraphQLite library, and the database path first.');
    }
  }

  private async requireReady(): Promise<void> {
    if (!this.settings.enabled) {
      throw new MemoryError('setup_required', 'Memory is disabled. Finish setup and enable it in settings.');
    }
    this.requireConfiguredPaths();
    if (!existsSync(this.settings.databasePath)) {
      throw new MemoryError('setup_required', 'The database does not exist yet. Run initialize first.');
    }
    await this.checkRuntime();
    await this.managedMemoryCount();
  }

  // Runtime checks run once per store: the official library version and FTS5 support, through the CLI.
  private checkRuntime(): Promise<void> {
    if (!this.runtimeChecked) {
      this.runtimeChecked = (async () => {
        if (!isExecutableFile(this.settings.sqlitePath)) {
          throw new MemoryError('setup_invalid', `SQLite CLI not found at ${this.settings.sqlitePath}.`);
        }
        if (!isExecutableFile(this.settings.extensionPath)) {
          throw new MemoryError('setup_invalid', `GraphQLite library not found at ${this.settings.extensionPath}.`);
        }
        const probe = `SELECT json_object('gql', json_extract(cypher_capabilities(), '$.graphqlite_version'),
          'fts', sqlite_compileoption_used('ENABLE_FTS5'), 'omit', sqlite_compileoption_used('OMIT_LOAD_EXTENSION')) AS probe;`;
        const out = parseFinal((await runCli({ sqlite: this.settings.sqlitePath, extension: this.settings.extensionPath, database: ':memory:', sql: '', final: probe })).stdout) as { gql: string; fts: number; omit: number };
        if (out.gql !== RUNTIME_VERSION || out.fts !== 1 || out.omit !== 0) {
          throw new MemoryError('setup_invalid', `The SQLite runtime must load GraphQLite ${RUNTIME_VERSION} with FTS5 enabled.`);
        }
      })();
      this.runtimeChecked.catch(() => { this.runtimeChecked = undefined; });
    }
    return this.runtimeChecked;
  }

  // Returns the memory count when the database is a managed hg-mem v1 store; otherwise throws.
  private async managedMemoryCount(): Promise<number> {
    try {
      const out = parseFinal((await this.call({ final: q.HEALTH_PROBE })).stdout) as { version: number; memories: number };
      if (out.version !== 1) throw new Error('version');
      return out.memories;
    } catch {
      throw new MemoryError('unmanaged_database', 'The database is not a managed hg-mem v1 store. Initialization does not migrate existing data.');
    }
  }

  private async exists(id: string): Promise<boolean> {
    const sql = `SELECT json_object('exists', EXISTS(SELECT 1 FROM hg_node WHERE id = json_extract(@p, '$.id'))) AS r;`;
    const out = parseFinal((await this.call({ p: { id }, final: sql })).stdout) as { exists: number };
    return out.exists === 1;
  }

  private async operatorState(id: string): Promise<'missing' | 'operator' | 'other'> {
    const out = parseFinal((await this.call({ p: { id }, final: q.OPERATOR_STATE })).stdout) as { state: 'missing' | 'operator' | 'other' };
    return out.state;
  }

  private async ensureOperator(): Promise<void> {
    const state = await this.operatorState(this.settings.operatorId);
    if (state === 'operator') return;
    if (state === 'other') {
      throw new MemoryError('setup_invalid', `The ID "${this.settings.operatorId}" is already used by a non-operator record. Choose another operator ID.`);
    }
    await this.call({
      p: { id: this.settings.operatorId, label: 'Operator', name: this.settings.operatorName },
      sql: [RECIPE_SQL.begin, RECIPE_SQL.context, RECIPE_SQL.commit].join('\n'),
      write: true,
    });
  }

  private async ensureDomain(): Promise<void> {
    if (await this.exists(DEFAULT_PROJECT_DOMAIN.id)) return;
    await this.call({
      p: { id: DEFAULT_PROJECT_DOMAIN.id, label: 'Domain', name: DEFAULT_PROJECT_DOMAIN.name },
      sql: [RECIPE_SQL.begin, RECIPE_SQL.context, RECIPE_SQL.commit].join('\n'),
      write: true,
    });
  }

  private eligibleRequest(context: MemoryContext): { cwd: string; scopes: string[] } {
    return { cwd: this.canonical(context.cwd), scopes: [...context.scopeIds] };
  }

  // Symlinks resolve through the host's realpath when the directory exists; otherwise the canonical text stands.
  private canonical(cwd: string): string {
    const text = canonicalCwd(cwd);
    if (text === '/' || !existsSync(text)) return text;
    return realpathSync.native(text);
  }

  // Workspace saves bind to this exact directory (never '/', never inferred from a project).
  // Global saves use scope:global. The directory scope is reused when it already exists.
  private async resolveWriteScope(draft: MemoryDraft, context: MemoryContext): Promise<{ candidate: string; body?: { id: string; name: string; root: string } }> {
    if (draft.scope === 'global') return { candidate: GLOBAL_SCOPE_ID };
    const root = this.canonical(context.cwd);
    if (root === '/') {
      throw new MemoryError('invalid_request', 'Open a workspace folder before saving a workspace memory, or save it as global.');
    }
    if (!existsSync(root) || !statSync(root).isDirectory()) {
      throw new MemoryError('invalid_request', 'The workspace folder does not exist on this machine. Save it as global or open the folder.');
    }
    // Candidate only: the transaction re-resolves the directory scope by root before create runs.
    const found = parseFinal((await this.call({ p: { root }, final: q.FIND_DIRECTORY_SCOPE })).stdout) as { id: string | null };
    const id = found.id ?? `scope:${randomUUID()}`;
    return { candidate: id, body: { id, name: basename(root), root } };
  }

  private async recordOrThrow(id: string): Promise<MemoryRecord> {
    const { stdout } = await this.call({ p: { id }, final: q.READ_RECORD });
    const out = parseFinal(stdout) as { record: unknown };
    if (out.record === null) throw new MemoryError('not_found', `No memory with id "${id}".`);
    return MemoryRecordSchema.parse(out.record);
  }

  private unwrapRecord(stdout: string, id: string): MemoryRecord {
    const out = parseFinal(stdout) as { record: unknown };
    if (out.record === null) throw new MemoryError('database_error', `The saved record "${id}" could not be read back.`);
    return MemoryRecordSchema.parse(out.record);
  }

  // Binds the store's paths; each call is one SQLite CLI process.
  // `write` runs a commit-bearing recipe; `writable` runs a non-persistent check that needs a writable handle.
  private call(call: { p?: unknown; q?: unknown; sql?: string; final?: string; write?: boolean; writable?: boolean; keepOutput?: boolean }): Promise<{ stdout: string }> {
    const full: CliCall = {
      sqlite: this.settings.sqlitePath,
      extension: this.settings.extensionPath,
      database: this.settings.databasePath,
      sql: call.sql ?? '',
      ...(call.p !== undefined ? { p: call.p } : {}),
      ...(call.q !== undefined ? { q: call.q } : {}),
      ...(call.final !== undefined ? { final: call.final } : {}),
      ...(call.keepOutput ? { keepOutput: true } : {}),
      ...(call.write ? { write: true } : call.writable ? {} : { readonly: true }),
    };
    return runCli(full).then((result) => ({ stdout: result.stdout }));
  }
}
