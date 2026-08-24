import type { LoginResult } from '../shared/auth-types';
import { passwordMatchesOrDummy } from './password';
import { createSession } from './session';
import { findUserByUsername, saveUser } from './user-store';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const MAX_INPUT_LENGTH = 128;

function parseLoginInput(
  payload: unknown,
): { username: string; password: string } | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const username = record.username;
  const password = record.password;

  if (typeof username !== 'string' || typeof password !== 'string') {
    return null;
  }

  const trimmedUsername = username.trim();

  if (
    trimmedUsername.length === 0 ||
    trimmedUsername.length > MAX_INPUT_LENGTH ||
    password.length === 0 ||
    password.length > MAX_INPUT_LENGTH
  ) {
    return null;
  }

  return { username: trimmedUsername, password };
}

export async function login(payload: unknown): Promise<LoginResult> {
  try {
    return await authenticate(payload);
  } catch {
    return { ok: false, error: 'database_unavailable' };
  }
}

async function authenticate(payload: unknown): Promise<LoginResult> {
  const input = parseLoginInput(payload);

  if (!input) {
    return { ok: false, error: 'invalid_input' };
  }

  const user = await findUserByUsername(input.username);
  const now = Date.now();

  if (user?.lockedUntil && user.lockedUntil > now) {
    await passwordMatchesOrDummy(input.password, user.passwordHash);
    return { ok: false, error: 'locked' };
  }

  const matches = await passwordMatchesOrDummy(
    input.password,
    user?.passwordHash,
  );

  if (!user || !matches) {
    if (user) {
      const failedLoginCount = user.failedLoginCount + 1;
      const lockedUntil =
        failedLoginCount >= MAX_FAILED_ATTEMPTS ? now + LOCKOUT_MS : null;

      await saveUser({
        ...user,
        failedLoginCount,
        lockedUntil,
      });

      if (lockedUntil) {
        return { ok: false, error: 'locked' };
      }
    }

    return { ok: false, error: 'invalid_credentials' };
  }

  await saveUser({
    ...user,
    failedLoginCount: 0,
    lockedUntil: null,
  });

  return {
    ok: true,
    session: createSession(user.id, user.username, user.role),
  };
}
