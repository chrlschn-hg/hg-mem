// Stable error codes for the memory service. Messages are actionable and safe to show to users.
export type MemoryErrorCode =
  | 'setup_required'        // settings or paths missing; run setup
  | 'setup_invalid'         // a configured path or library failed its check
  | 'invalid_request'       // request rejected by a guard before any write (nothing changed)
  | 'not_found'             // unknown memory or context id
  | 'unmanaged_database'    // existing database is not an hg-mem v1 store; no migration
  | 'commit_unknown'        // command ended without a confirmed commit; caller must not auto-retry
  | 'database_error';       // SQLite or GraphQLite failure with no commit

export class MemoryError extends Error {
  readonly code: MemoryErrorCode;
  constructor(code: MemoryErrorCode, message: string) {
    super(message);
    this.name = 'MemoryError';
    this.code = code;
  }
}
