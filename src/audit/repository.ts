import { randomUUID } from 'node:crypto';
import { getDb } from '../db/client';
import { getActiveSession } from '../auth/session';
import type { AuditEntry } from '../shared/audit-types';

type AuditRow = {
  id: string;
  username: string;
  action: string;
  created_at: Date | string;
  detail: string;
};

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

export async function writeAudit(
  action: string,
  detail: string,
  username?: string | null,
): Promise<void> {
  try {
    const actor =
      (username && username.trim()) ||
      getActiveSession()?.username ||
      'anonymous';
    const db = getDb();
    await db.query(
      `INSERT INTO audit_log (id, username, action, detail)
       VALUES (:id, :username, :action, :detail)`,
      {
        id: randomUUID(),
        username: actor.slice(0, 128),
        action: action.slice(0, 64),
        detail: detail.slice(0, 500),
      },
    );
  } catch {
    // Audit must not block the original action or store secrets.
  }
}

export function parseAuditSearch(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, 64);
}

export async function listAudit(search: string): Promise<AuditEntry[]> {
  const db = getDb();
  const needle = `%${search.replace(/[%_]/g, '')}%`;
  const sql = search
    ? `SELECT id, username, action, detail, created_at
       FROM audit_log
       WHERE username LIKE :needle OR action LIKE :needle OR detail LIKE :needle
       ORDER BY created_at DESC
       LIMIT 300`
    : `SELECT id, username, action, detail, created_at
       FROM audit_log
       ORDER BY created_at DESC
       LIMIT 300`;
  const [rows] = await db.query(sql, search ? { needle } : undefined);
  return (rows as AuditRow[]).map((row) => ({
    id: row.id,
    username: row.username,
    action: row.action,
    detail: row.detail,
    createdAt: asIso(row.created_at),
  }));
}
