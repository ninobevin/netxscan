import { randomUUID } from 'node:crypto';
import { runPowerShellEncoded } from '../windows/collect';
import {
  CRED_DELETE_SCRIPT,
  CRED_LIST_SCRIPT,
  CRED_READ_SCRIPT,
  CRED_WRITE_SCRIPT,
} from './scripts';
import {
  credentialTarget,
  parseCredentialId,
  parseCredentialLabel,
  parseCredentialPassword,
  parseCredentialTarget,
  parseCredentialUsername,
} from './validate';
import type { StoredCredential } from '../shared/credential-types';

const TIMEOUT_MS = 30_000;

export async function listStoredCredentials(): Promise<StoredCredential[]> {
  const raw = await runPowerShellEncoded(
    CRED_LIST_SCRIPT,
    [],
    TIMEOUT_MS,
    'powershell_failed',
  );
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const rows = Array.isArray(record.credentials)
    ? record.credentials
    : record.credentials
      ? [record.credentials]
      : [];
  const listed: StoredCredential[] = [];

  for (const row of rows) {
    if (!row || typeof row !== 'object') {
      continue;
    }

    const item = row as Record<string, unknown>;
    const id =
      typeof item.target === 'string' ? parseCredentialTarget(item.target) : null;
    const username = parseCredentialUsername(item.username);
    const label = parseCredentialLabel(item.label) ?? id;

    if (!id || !username || !label) {
      continue;
    }

    listed.push({ id, label, username });
  }

  return listed.sort((left, right) => left.label.localeCompare(right.label));
}

export async function saveStoredCredential(
  label: string,
  username: string,
  password: string,
): Promise<StoredCredential> {
  const parsedLabel = parseCredentialLabel(label);
  const parsedUser = parseCredentialUsername(username);
  const parsedPass = parseCredentialPassword(password);

  if (!parsedLabel || !parsedUser || !parsedPass) {
    throw new Error('invalid_input');
  }

  const id = randomUUID();
  const payload = JSON.stringify({
    target: credentialTarget(id),
    username: parsedUser,
    password: parsedPass,
    comment: parsedLabel,
  });

  await runPowerShellEncoded(
    CRED_WRITE_SCRIPT,
    [],
    TIMEOUT_MS,
    'powershell_failed',
    true,
    payload,
  );

  return { id, label: parsedLabel, username: parsedUser };
}

export async function deleteStoredCredential(id: string): Promise<void> {
  const parsed = parseCredentialId(id);

  if (!parsed) {
    throw new Error('invalid_input');
  }

  await runPowerShellEncoded(
    CRED_DELETE_SCRIPT,
    [credentialTarget(parsed)],
    TIMEOUT_MS,
    'powershell_failed',
  );
}

export async function readStoredSecret(
  id: string,
): Promise<{ username: string; password: string } | null> {
  const parsed = parseCredentialId(id);

  if (!parsed) {
    return null;
  }

  try {
    const raw = await runPowerShellEncoded(
      CRED_READ_SCRIPT,
      [credentialTarget(parsed)],
      TIMEOUT_MS,
      'powershell_failed',
    );
    const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const username = parseCredentialUsername(record.username);
    const password = parseCredentialPassword(record.password);

    if (!username || !password) {
      return null;
    }

    return { username, password };
  } catch {
    return null;
  }
}
