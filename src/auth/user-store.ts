import { randomUUID } from 'node:crypto';
import type { UserRole } from '../shared/auth-types';
import { getDb } from '../db/client';

export type StoredUser = {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  failedLoginCount: number;
  lockedUntil: number | null;
};

type UserRow = {
  id: string;
  username: string;
  password_hash: string;
  role: string;
  failed_login_count: number;
  locked_until: number | null;
};

const BOOTSTRAP_USERS: Array<{
  username: string;
  passwordHash: string;
  role: UserRole;
}> = [
  {
    username: 'admin',
    passwordHash:
      '$2b$10$ClZLnKViq0pNbpCYbtHowOKyn4AgKrW3Pdskenn84lBJFGgQth0Qy',
    role: 'administrator',
  },
  {
    username: 'support',
    passwordHash:
      '$2b$10$DxXO2fcwZlmotWV6ZITNju35U3680.uNjsyW0C9X9aNx4PSgWjpEG',
    role: 'it_support',
  },
];

function isUserRole(value: string): value is UserRole {
  return value === 'administrator' || value === 'it_support';
}

function toStoredUser(row: UserRow): StoredUser {
  if (!isUserRole(row.role)) {
    throw new Error('User role is invalid.');
  }

  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    role: row.role,
    failedLoginCount: Number(row.failed_login_count),
    lockedUntil: row.locked_until === null ? null : Number(row.locked_until),
  };
}

export async function initializeUserStore(): Promise<void> {
  const db = getDb();
  const [rows] = await db.query('SELECT COUNT(*) AS total FROM users');
  const total = Number((rows as Array<{ total: number }>)[0]?.total ?? 0);

  if (total > 0) {
    return;
  }

  for (const bootstrap of BOOTSTRAP_USERS) {
    await db.query(
      `INSERT INTO users (id, username, password_hash, role, failed_login_count, locked_until)
       VALUES (:id, :username, :passwordHash, :role, 0, NULL)`,
      {
        id: randomUUID(),
        username: bootstrap.username,
        passwordHash: bootstrap.passwordHash,
        role: bootstrap.role,
      },
    );
  }
}

export async function findUserByUsername(
  username: string,
): Promise<StoredUser | undefined> {
  const db = getDb();
  const [rows] = await db.query(
    `SELECT id, username, password_hash, role, failed_login_count, locked_until
     FROM users
     WHERE LOWER(username) = :username
     LIMIT 1`,
    { username: username.trim().toLowerCase() },
  );
  const row = (rows as UserRow[])[0];
  return row ? toStoredUser(row) : undefined;
}

export async function saveUser(updated: StoredUser): Promise<void> {
  const db = getDb();
  const [result] = await db.query(
    `UPDATE users
     SET password_hash = :passwordHash,
         role = :role,
         failed_login_count = :failedLoginCount,
         locked_until = :lockedUntil
     WHERE id = :id`,
    {
      id: updated.id,
      passwordHash: updated.passwordHash,
      role: updated.role,
      failedLoginCount: updated.failedLoginCount,
      lockedUntil: updated.lockedUntil,
    },
  );

  const header = result as { affectedRows?: number };

  if (!header.affectedRows) {
    throw new Error('User was not found.');
  }
}
