import { ipcMain } from 'electron';
import { requireRole, requireSession } from '../auth/session';
import { errorMessage } from '../ipc/error-message';
import { ipcChannels } from '../shared/ipc-channels';
import { getCompanyProfile, updateCompanyProfile } from './repository';

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function registerCompanyIpc(): void {
  ipcMain.handle(ipcChannels.companyGet, () => {
    try {
      requireSession();
      return { ok: true, profile: getCompanyProfile() };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(ipcChannels.companyUpdate, (_event, payload: unknown) => {
    try {
      requireRole('administrator');
      if (!payload || typeof payload !== 'object') {
        return { ok: false, error: 'Invalid company profile.' };
      }
      const body = payload as Record<string, unknown>;
      const profile = updateCompanyProfile({
        name: asString(body.name),
        address: asString(body.address),
        contact: asString(body.contact),
        notes: asString(body.notes),
      });
      return { ok: true, profile };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });
}
