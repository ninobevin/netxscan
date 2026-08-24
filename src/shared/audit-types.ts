export type AuditEntry = {
  id: string;
  username: string;
  action: string;
  detail: string;
  createdAt: string;
};

export type AuditError = 'unauthorized' | 'database_unavailable';

export type AuditListResult =
  | { ok: true; entries: AuditEntry[] }
  | { ok: false; error: AuditError };
