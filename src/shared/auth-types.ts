export type UserRole = 'administrator' | 'it_support';

export type PublicSession = {
  username: string;
  role: UserRole;
};

export type LoginResult =
  | { ok: true; session: PublicSession }
  | { ok: false; error: string };
