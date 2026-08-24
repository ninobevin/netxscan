export type DatabaseStatus =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'access_denied'
        | 'unreachable'
        | 'invalid_config'
        | 'sqlite_failed'
        | 'unknown';
    };

export function classifyDatabaseError(error: unknown): DatabaseStatus {
  if (!(error instanceof Error)) {
    return { ok: false, reason: 'unknown' };
  }

  const code = 'code' in error ? String(error.code) : '';

  if (
    error.message === 'Database configuration is invalid.' ||
    code === 'INVALID_CONFIG'
  ) {
    return { ok: false, reason: 'invalid_config' };
  }

  if (code === 'ER_ACCESS_DENIED_ERROR' || code === 'ER_NOT_VALID_PASSWORD') {
    return { ok: false, reason: 'access_denied' };
  }

  if (
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    code === 'ENETUNREACH'
  ) {
    return { ok: false, reason: 'unreachable' };
  }

  if (
    code === 'ERR_SQLITE_ERROR' ||
    code === 'ERR_UNKNOWN_BUILTIN_MODULE' ||
    error.message.includes('node:sqlite')
  ) {
    return { ok: false, reason: 'sqlite_failed' };
  }

  return { ok: false, reason: 'unknown' };
}

export function databaseStatusMessage(status: DatabaseStatus): string | null {
  if (status.ok) {
    return null;
  }

  if (status.reason === 'access_denied') {
    return 'MySQL rejected the username or password. Set them in %APPDATA%\\NetXScan\\database.json and restart.';
  }

  if (status.reason === 'unreachable') {
    return 'MySQL is not reachable. Start the MySQL service and confirm host and port in database.json.';
  }

  if (status.reason === 'invalid_config') {
    return 'database.json is invalid. Use config/database.example.json as a template.';
  }

  if (status.reason === 'sqlite_failed') {
    return 'The SQLite database file could not be opened in %APPDATA%\\NetXScan.';
  }

  return 'The database could not be started. Check database.json (SQLite or MySQL).';
}
