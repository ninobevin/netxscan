import type { PublicSession, UserRole } from '../shared/auth-types';

let session: PublicSession | null = null;

export function setSession(next: PublicSession): void {
  session = next;
}

export function clearSession(): void {
  session = null;
}

export function getActiveSession(): PublicSession | null {
  return session;
}

export function requireSession(): PublicSession {
  if (!session) {
    throw new Error('Not signed in.');
  }

  return session;
}

export function requireAppSession(): PublicSession {
  const active = requireSession();
  if (active.setupRequired) {
    throw new Error('Finish account setup first.');
  }
  return active;
}

export function requireRole(role: UserRole): PublicSession {
  const active = requireAppSession();
  if (active.role !== role) {
    throw new Error('Not allowed.');
  }

  return active;
}
