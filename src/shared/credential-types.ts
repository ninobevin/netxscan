export type StoredCredential = {
  id: string;
  label: string;
  username: string;
};

export type CredentialError =
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_input'
  | 'not_found'
  | 'vault_failed';

export type CredentialListResult =
  | { ok: true; credentials: StoredCredential[] }
  | { ok: false; error: CredentialError };

export type CredentialItemResult =
  | { ok: true; credential: StoredCredential }
  | { ok: false; error: CredentialError };
