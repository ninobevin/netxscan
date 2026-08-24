export type UserRole = 'administrator' | 'it_support';

export type PublicSession = {
  username: string;
  role: UserRole;
  expiresAt: number;
};

export type LoginFailureReason =
  | 'invalid_credentials'
  | 'locked'
  | 'invalid_input'
  | 'database_unavailable';

export type LoginResult =
  | { ok: true; session: PublicSession }
  | { ok: false; error: LoginFailureReason };
