import bcrypt from 'bcryptjs';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import { getDb } from '../db/client';
import type { PublicSession, UserRole } from '../shared/auth-types';
import { getActiveSession, setSession } from './session';
import { parsePassword } from './password';

type AuthRow = {
  username: string;
  password_hash: string;
  role: string;
  must_change_password: number;
  totp_secret: string | null;
  totp_enabled: number;
};

const pendingTotp = new Map<string, string>();

function mapRole(value: string): UserRole {
  return value === 'administrator' ? 'administrator' : 'user';
}

export function loadAuthRow(username: string): AuthRow | undefined {
  return getDb()
    .prepare(
      `SELECT username, password_hash, role, must_change_password, totp_secret, totp_enabled
       FROM users WHERE username = ?`,
    )
    .get(username) as AuthRow | undefined;
}

export function publicSessionFromRow(row: AuthRow): PublicSession {
  const mustChangePassword = Boolean(row.must_change_password);
  const totpEnabled = Boolean(row.totp_enabled);
  return {
    username: row.username,
    role: mapRole(row.role),
    mustChangePassword,
    totpEnabled,
    setupRequired: mustChangePassword || !totpEnabled,
  };
}

export function refreshSessionFor(username: string): PublicSession | null {
  const row = loadAuthRow(username);
  if (!row) {
    return null;
  }
  const session = publicSessionFromRow(row);
  const active = getActiveSession();
  if (active && (active.username === username || active.username === row.username)) {
    setSession(session);
  }
  return session;
}

export function anyAuthenticatorEnrolled(): boolean {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS n FROM users WHERE totp_enabled = 1')
    .get() as { n: number } | undefined;
  return Number(row?.n ?? 0) > 0;
}

function totpFromSecret(username: string, secretBase32: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: 'NetXScan',
    label: username,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

export function verifyTotp(secretBase32: string, username: string, code: string): boolean {
  const token = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(token)) {
    return false;
  }
  const delta = totpFromSecret(username, secretBase32).validate({ token, window: 1 });
  return delta !== null;
}

export async function changeOwnPassword(
  currentPassword: string,
  nextPasswordRaw: unknown,
): Promise<PublicSession | { error: string }> {
  const active = getActiveSession();
  if (!active) {
    return { error: 'Not signed in.' };
  }
  const row = loadAuthRow(active.username);
  if (!row) {
    return { error: 'User not found.' };
  }
  const matches = await bcrypt.compare(currentPassword, row.password_hash);
  if (!matches) {
    return { error: 'Current password is incorrect.' };
  }
  const nextPassword = parsePassword(nextPasswordRaw, true);
  if (nextPassword === null || typeof nextPassword !== 'string') {
    return nextPassword ?? { error: 'Password is required.' };
  }
  if (await bcrypt.compare(nextPassword, row.password_hash)) {
    return { error: 'Choose a different password from the current one.' };
  }
  getDb()
    .prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE username = ?')
    .run(bcrypt.hashSync(nextPassword, 10), row.username);
  const updated = loadAuthRow(row.username);
  if (!updated) {
    return { error: 'Could not update password.' };
  }
  const session = publicSessionFromRow(updated);
  setSession(session);
  return session;
}

export async function beginTotpSetup(): Promise<{ qrDataUrl: string } | { error: string }> {
  const active = getActiveSession();
  if (!active) {
    return { error: 'Not signed in.' };
  }
  const row = loadAuthRow(active.username);
  if (!row) {
    return { error: 'User not found.' };
  }
  if (row.must_change_password) {
    return { error: 'Change your password first.' };
  }
  const secret = new OTPAuth.Secret({ size: 20 });
  const base32 = secret.base32;
  pendingTotp.set(row.username, base32);
  const totp = totpFromSecret(row.username, base32);
  const qrDataUrl = await QRCode.toDataURL(totp.toString(), {
    margin: 1,
    width: 220,
    color: { dark: '#134e4a', light: '#ffffff' },
  });
  return { qrDataUrl };
}

export function confirmTotpSetup(code: string): PublicSession | { error: string } {
  const active = getActiveSession();
  if (!active) {
    return { error: 'Not signed in.' };
  }
  const row = loadAuthRow(active.username);
  if (!row) {
    return { error: 'User not found.' };
  }
  if (row.must_change_password) {
    return { error: 'Change your password first.' };
  }
  const pending = pendingTotp.get(row.username);
  if (!pending) {
    return { error: 'Generate a new authenticator QR code first.' };
  }
  if (!verifyTotp(pending, row.username, code)) {
    return { error: 'Invalid authenticator code.' };
  }
  getDb()
    .prepare('UPDATE users SET totp_secret = ?, totp_enabled = 1 WHERE username = ?')
    .run(pending, row.username);
  pendingTotp.delete(row.username);
  const updated = loadAuthRow(row.username);
  if (!updated) {
    return { error: 'Could not save authenticator.' };
  }
  const session = publicSessionFromRow(updated);
  setSession(session);
  return session;
}

export function clearPendingTotp(username?: string): void {
  if (username) {
    pendingTotp.delete(username);
    return;
  }
  pendingTotp.clear();
}

export async function resetPasswordWithTotp(
  usernameRaw: unknown,
  codeRaw: unknown,
  nextPasswordRaw: unknown,
): Promise<{ ok: true } | { error: string }> {
  const username = String(usernameRaw ?? '').trim();
  const code = String(codeRaw ?? '');
  if (!username || !code) {
    return { error: 'Username and authenticator code are required.' };
  }
  const row = loadAuthRow(username);
  if (!row || !row.totp_enabled || !row.totp_secret) {
    return { error: 'Could not reset the password.' };
  }
  if (!verifyTotp(row.totp_secret, row.username, code)) {
    return { error: 'Invalid authenticator code.' };
  }
  const nextPassword = parsePassword(nextPasswordRaw, true);
  if (nextPassword === null || typeof nextPassword !== 'string') {
    return nextPassword ?? { error: 'Password is required.' };
  }
  getDb()
    .prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE username = ?')
    .run(bcrypt.hashSync(nextPassword, 10), row.username);
  return { ok: true };
}
