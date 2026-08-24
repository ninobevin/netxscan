import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

let dummyHashPromise: Promise<string> | undefined;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function passwordMatches(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

/** Compare against a real bcrypt hash even when the user is missing. */
export async function passwordMatchesOrDummy(
  password: string,
  passwordHash: string | undefined,
): Promise<boolean> {
  if (!dummyHashPromise) {
    dummyHashPromise = bcrypt.hash('invalid-user', SALT_ROUNDS);
  }

  const hash = passwordHash ?? (await dummyHashPromise);
  return bcrypt.compare(password, hash);
}
