export type UserRole = 'administrator' | 'user';

export type PublicSession = {
  username: string;
  role: UserRole;
};

export type AppUser = {
  id: number;
  username: string;
  role: UserRole;
};

export type LoginResult =
  | { ok: true; session: PublicSession }
  | { ok: false; error: string };

export type UserListResult =
  | { ok: true; users: AppUser[] }
  | { ok: false; error: string };
