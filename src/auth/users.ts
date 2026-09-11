import bcrypt from 'bcryptjs';
import { getDb } from '../db/client';
import type { AppUser, UserRole } from '../shared/auth-types';
import { getActiveSession, setSession } from './session';

const MIN_PASSWORD = 8;

function mapRole(value: unknown): UserRole {
  if (value === 'administrator') {
    return 'administrator';
  }
  return 'user';
}

function mapUser(row: { id: number; username: string; role: unknown }): AppUser {
  return {
    id: row.id,
    username: row.username,
    role: mapRole(row.role),
  };
}

export function listUsers(): AppUser[] {
  const rows = getDb()
    .prepare('SELECT id, username, role FROM users ORDER BY username')
    .all() as Array<{ id: number; username: string; role: unknown }>;
  return rows.map(mapUser);
}

function getUserById(id: number): AppUser | null {
  const row = getDb()
    .prepare('SELECT id, username, role FROM users WHERE id = ?')
    .get(id) as { id: number; username: string; role: unknown } | undefined;
  return row ? mapUser(row) : null;
}

function adminCount(): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'administrator'")
    .get() as { n: number } | undefined;
  return Number(row?.n ?? 0);
}

function parseUsername(value: unknown): string | { error: string } {
  const username = String(value ?? '').trim();
  if (username.length < 2 || username.length > 64) {
    return { error: 'Username must be 2 to 64 characters.' };
  }
  if (!/^[A-Za-z0-9._-]+$/.test(username)) {
    return { error: 'Username may use letters, numbers, dot, underscore, and hyphen.' };
  }
  return username;
}

function parseRole(value: unknown): UserRole | { error: string } {
  if (value === 'administrator' || value === 'user') {
    return value;
  }
  return { error: 'Role must be Administrator or User.' };
}

function parsePassword(value: unknown, required: boolean): string | null | { error: string } {
  const password = typeof value === 'string' ? value : '';
  if (!password) {
    return required ? { error: 'Password is required.' } : null;
  }
  if (password.length < MIN_PASSWORD) {
    return { error: `Password must be at least ${MIN_PASSWORD} characters.` };
  }
  return password;
}

function syncSession(previousUsername: string, next: AppUser): void {
  const active = getActiveSession();
  if (!active || active.username !== previousUsername) {
    return;
  }
  setSession({ username: next.username, role: next.role });
}

export function addUser(
  usernameRaw: unknown,
  passwordRaw: unknown,
  roleRaw: unknown,
): AppUser[] | { error: string } {
  const username = parseUsername(usernameRaw);
  if (typeof username !== 'string') {
    return username;
  }
  const password = parsePassword(passwordRaw, true);
  if (password === null || typeof password !== 'string') {
    return password ?? { error: 'Password is required.' };
  }
  const role = parseRole(roleRaw);
  if (typeof role !== 'string') {
    return role;
  }
  try {
    getDb()
      .prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
      .run(username, bcrypt.hashSync(password, 10), role);
  } catch {
    return { error: 'A user with that username already exists.' };
  }
  return listUsers();
}

export function updateUser(
  id: number,
  usernameRaw: unknown,
  passwordRaw: unknown,
  roleRaw: unknown,
): AppUser[] | { error: string } {
  const existing = getUserById(id);
  if (!existing) {
    return { error: 'User not found.' };
  }
  const username = parseUsername(usernameRaw);
  if (typeof username !== 'string') {
    return username;
  }
  const password = parsePassword(passwordRaw, false);
  if (password !== null && typeof password !== 'string') {
    return password;
  }
  const role = parseRole(roleRaw);
  if (typeof role !== 'string') {
    return role;
  }
  if (
    existing.role === 'administrator' &&
    role === 'user' &&
    adminCount() <= 1
  ) {
    return { error: 'Keep at least one administrator.' };
  }
  try {
    if (password) {
      getDb()
        .prepare('UPDATE users SET username = ?, password_hash = ?, role = ? WHERE id = ?')
        .run(username, bcrypt.hashSync(password, 10), role, id);
    } else {
      getDb()
        .prepare('UPDATE users SET username = ?, role = ? WHERE id = ?')
        .run(username, role, id);
    }
  } catch {
    return { error: 'A user with that username already exists.' };
  }
  const updated = getUserById(id);
  if (updated) {
    syncSession(existing.username, updated);
  }
  return listUsers();
}

export function deleteUser(id: number, actorUsername: string): AppUser[] | { error: string } {
  const existing = getUserById(id);
  if (!existing) {
    return { error: 'User not found.' };
  }
  if (existing.username === actorUsername) {
    return { error: 'You cannot delete your own account.' };
  }
  if (existing.role === 'administrator' && adminCount() <= 1) {
    return { error: 'Keep at least one administrator.' };
  }
  getDb().prepare('DELETE FROM users WHERE id = ?').run(id);
  return listUsers();
}
