import type { PublicSession, UserRole } from '../shared/auth-types';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

type SessionRecord = {
  userId: string;
  username: string;
  role: UserRole;
  expiresAt: number;
};

let currentSession: SessionRecord | null = null;

function toPublic(session: SessionRecord): PublicSession {
  return {
    username: session.username,
    role: session.role,
    expiresAt: session.expiresAt,
  };
}

export function createSession(
  userId: string,
  username: string,
  role: UserRole,
): PublicSession {
  currentSession = {
    userId,
    username,
    role,
    expiresAt: Date.now() + SESSION_TIMEOUT_MS,
  };

  return toPublic(currentSession);
}

export function clearSession(): void {
  currentSession = null;
}

export function getActiveSession(): PublicSession | null {
  if (!currentSession) {
    return null;
  }

  if (Date.now() > currentSession.expiresAt) {
    currentSession = null;
    return null;
  }

  return toPublic(currentSession);
}

export function requireSession(): PublicSession {
  const session = getActiveSession();

  if (!session) {
    throw new Error('Unauthorized');
  }

  currentSession = {
    ...(currentSession as SessionRecord),
    expiresAt: Date.now() + SESSION_TIMEOUT_MS,
  };

  return toPublic(currentSession);
}

export function requireRole(role: UserRole): PublicSession {
  const session = requireSession();

  if (session.role !== role) {
    throw new Error('Forbidden');
  }

  return session;
}

export const sessionTimeoutMs = SESSION_TIMEOUT_MS;
