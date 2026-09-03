import bcrypt from 'bcryptjs';
import { getDb } from '../db/client';
import type { LoginResult, UserRole } from '../shared/auth-types';
import { setSession } from './session';

type UserRow = {
  username: string;
  password_hash: string;
  role: UserRole;
};

export async function login(payload: unknown): Promise<LoginResult> {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'Username and password are required.' };
  }

  const username = String((payload as { username?: unknown }).username ?? '').trim();
  const password = String((payload as { password?: unknown }).password ?? '');

  if (!username || !password) {
    return { ok: false, error: 'Username and password are required.' };
  }

  const row = getDb()
    .prepare('SELECT username, password_hash, role FROM users WHERE username = ?')
    .get(username) as UserRow | undefined;

  if (!row) {
    return { ok: false, error: 'Invalid username or password.' };
  }

  const matches = await bcrypt.compare(password, row.password_hash);
  if (!matches) {
    return { ok: false, error: 'Invalid username or password.' };
  }

  const session = { username: row.username, role: row.role };
  setSession(session);
  return { ok: true, session };
}
