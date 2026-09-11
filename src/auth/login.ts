import bcrypt from 'bcryptjs';
import type { LoginResult } from '../shared/auth-types';
import { setSession } from './session';
import { anyAuthenticatorEnrolled, loadAuthRow, publicSessionFromRow } from './totp';

export async function login(payload: unknown): Promise<LoginResult> {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'Username and password are required.' };
  }

  const username = String((payload as { username?: unknown }).username ?? '').trim();
  const password = String((payload as { password?: unknown }).password ?? '');

  if (!username || !password) {
    return { ok: false, error: 'Username and password are required.' };
  }

  const row = loadAuthRow(username);
  if (!row) {
    return { ok: false, error: 'Invalid username or password.' };
  }

  const matches = await bcrypt.compare(password, row.password_hash);
  if (!matches) {
    return { ok: false, error: 'Invalid username or password.' };
  }

  const session = publicSessionFromRow(row);
  if (!anyAuthenticatorEnrolled() && session.role !== 'administrator') {
    return {
      ok: false,
      error: 'Sign in with the default administrator account to finish first-time setup.',
    };
  }

  setSession(session);
  return { ok: true, session };
}
