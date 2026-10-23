import { statSync } from 'node:fs';
import path from 'node:path';
import type { PluginSessionOpenRequest } from '@getpaseo/plugin/server';
import type { MemorySettings } from '../shared/settings';
import type { IntegrationAttempt, MemoryContext } from '../shared/contracts';
import { rootSkillPath } from './install-skills';

export const MEMORY_ENV_KEYS = ['HG_DB', 'HG_EXT', 'HG_SQLITE', 'HG_SKILLS', 'HG_OPERATOR', 'HG_AGENT', 'HG_SCOPE_IDS'] as const;

// Cheap launch configuration checks only. No database connection, hash scan or runtime probe.
export function checkSessionConfiguration(value: MemorySettings, isFile = (file: string) => {
  try { return statSync(file).isFile(); } catch { return false; }
}) {
  if (!path.isAbsolute(value.skillsDirectory)) throw new Error('Skills folder must be an absolute path. Open Memory setup.');
  for (const [label, file] of [
    ['Memory file', value.databasePath], ['SQLite CLI', value.sqlitePath],
    ['GraphQLite extension', value.extensionPath], ['Memory workflow skill', rootSkillPath(value.skillsDirectory)],
  ]) {
    if (!path.isAbsolute(file) || !isFile(file)) throw new Error(`${label} is missing or is not an absolute file path. Open Memory setup.`);
  }
  if (!value.operatorId.trim()) throw new Error('Operator identifier is missing. Open Memory setup.');
}

export class SessionIntegration {
  private lastAttempt: IntegrationAttempt | null = null;
  private lastFailure: IntegrationAttempt | null = null;
  private readonly attempts = new Map<string, IntegrationAttempt>();

  constructor(private readonly dependencies: {
    settings(): Promise<MemorySettings>;
    context?(value: MemorySettings, workspaceId?: string): Promise<MemoryContext>;
    check?: (value: MemorySettings) => void;
    log?: (attempt: IntegrationAttempt) => void;
  }) {}

  snapshot() { return { lastAttempt: this.lastAttempt, lastFailure: this.lastFailure, attempts: [...this.attempts.values()].reverse() }; }

  async open(request: PluginSessionOpenRequest, resolveContext = this.dependencies.context): Promise<PluginSessionOpenRequest> {
    let enabled = false;
    const record = (state: IntegrationAttempt['state'], message: string) => {
      const attempt: IntegrationAttempt = { at: new Date().toISOString(), agentId: request.agentId,
        provider: request.provider, reason: request.reason, purpose: request.purpose, state, message };
      // History-only provider opens must not overwrite the last interactive result.
      if (request.purpose === 'interactive') {
        this.lastAttempt = attempt;
        if (state === 'error') this.lastFailure = attempt;
      }
      const key = `${request.agentId}:${request.purpose}`;
      this.attempts.delete(key);
      this.attempts.set(key, attempt);
      if (this.attempts.size > 50) this.attempts.delete(this.attempts.keys().next().value!);
      try { this.dependencies.log?.(attempt); } catch { /* A logging failure cannot block the agent. */ }
    };
    try {
      const value = await this.dependencies.settings();
      if (!value.enabled || !value.agentIntegrationEnabled) {
        record('skipped', 'Memory integration is disabled. Plugin configuration was not added; explicit launch overrides were left unchanged.');
        return request;
      }
      enabled = true;
      (this.dependencies.check ?? checkSessionConfiguration)(value);
      if (!request.agentId.trim()) throw new Error('Paseo did not supply an agent identifier.');
      // A failed workspace lookup must never turn into a successful global-only session.
      if (!resolveContext) throw new Error('Paseo session context is unavailable.');
      const context = await resolveContext(value, request.workspaceId ?? undefined);
      const env = { ...request.env };
      delete env.HG_MEMORY_ERROR;
      Object.assign(env, {
        HG_DB: value.databasePath, HG_EXT: value.extensionPath, HG_SQLITE: value.sqlitePath,
        HG_SKILLS: value.skillsDirectory, HG_OPERATOR: value.operatorId,
        HG_AGENT: `agent:${request.agentId}`, HG_SCOPE_IDS: JSON.stringify(context.scopeIds),
      });
      record('injected', request.workspaceId
        ? 'Passed seven HG_* variables to the provider. This records launch delivery, not a shell-tool check.'
        : 'Passed seven HG_* variables without project bindings. Use the actual working directory for directory eligibility. Launch delivery is not a shell-tool check.');
      return { ...request, env };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Memory session configuration failed.';
      const env = { ...request.env };
      if (enabled) for (const key of MEMORY_ENV_KEYS) delete env[key];
      // Explain unavailable memory in the tool shell without failing the agent operation.
      env.HG_MEMORY_ERROR = message;
      record('error', message);
      return { ...request, env };
    }
  }
}
