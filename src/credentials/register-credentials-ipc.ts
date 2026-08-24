import { ipcMain } from 'electron';
import { requireRole } from '../auth/session';
import type {
  CredentialItemResult,
  CredentialListResult,
} from '../shared/credential-types';
import { ipcChannels } from '../shared/ipc-channels';
import { writeAudit } from '../audit/repository';
import {
  deleteStoredCredential,
  listStoredCredentials,
  saveStoredCredential,
} from './vault';
import {
  parseCredentialId,
  parseCredentialLabel,
  parseCredentialPassword,
  parseCredentialUsername,
} from './validate';

function asAdminError(error: unknown): CredentialItemResult | CredentialListResult {
  if (error instanceof Error && error.message === 'Forbidden') {
    return { ok: false, error: 'forbidden' };
  }

  return { ok: false, error: 'unauthorized' };
}

export function registerCredentialsIpc(): void {
  ipcMain.handle(
    ipcChannels.credentialsList,
    async (): Promise<CredentialListResult> => {
      try {
        requireRole('administrator');
      } catch (error) {
        return asAdminError(error) as CredentialListResult;
      }

      try {
        const credentials = await listStoredCredentials();
        return { ok: true, credentials };
      } catch {
        return { ok: false, error: 'vault_failed' };
      }
    },
  );

  ipcMain.handle(
    ipcChannels.credentialsSave,
    async (_event, payload: unknown): Promise<CredentialItemResult> => {
      try {
        requireRole('administrator');
      } catch (error) {
        return asAdminError(error) as CredentialItemResult;
      }

      const record =
        payload && typeof payload === 'object'
          ? (payload as Record<string, unknown>)
          : null;
      const label = parseCredentialLabel(record?.label);
      const username = parseCredentialUsername(record?.username);
      const password = parseCredentialPassword(record?.password);

      if (!label || !username || !password) {
        return { ok: false, error: 'invalid_input' };
      }

      try {
        const credential = await saveStoredCredential(label, username, password);
        await writeAudit(
          'credential_save',
          `${credential.label} (${credential.username})`,
        );
        return { ok: true, credential };
      } catch (error) {
        if (error instanceof Error && error.message === 'invalid_input') {
          return { ok: false, error: 'invalid_input' };
        }

        return { ok: false, error: 'vault_failed' };
      }
    },
  );

  ipcMain.handle(
    ipcChannels.credentialsDelete,
    async (_event, payload: unknown): Promise<CredentialItemResult> => {
      try {
        requireRole('administrator');
      } catch (error) {
        return asAdminError(error) as CredentialItemResult;
      }

      const record =
        payload && typeof payload === 'object'
          ? (payload as Record<string, unknown>)
          : null;
      const id = parseCredentialId(record?.id);

      if (!id) {
        return { ok: false, error: 'invalid_input' };
      }

      try {
        await deleteStoredCredential(id);
        await writeAudit('credential_delete', id);
        return {
          ok: true,
          credential: { id, label: '', username: '' },
        };
      } catch {
        return { ok: false, error: 'not_found' };
      }
    },
  );
}
