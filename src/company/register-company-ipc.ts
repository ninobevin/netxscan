import { BrowserWindow, dialog, ipcMain } from 'electron';
import { requireRole, requireAppSession } from '../auth/session';
import { errorMessage } from '../ipc/error-message';
import { ipcChannels } from '../shared/ipc-channels';
import { getCompanyBranding, getCompanyProfile, updateCompanyProfile } from './repository';
import { clearCompanyLogo, saveCompanyLogoFromPath } from './logo';

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function registerCompanyIpc(): void {
  ipcMain.handle(ipcChannels.companyBranding, () => {
    try {
      return { ok: true, branding: getCompanyBranding() };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(ipcChannels.companyGet, () => {
    try {
      requireAppSession();
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
        logoDataUrl: null,
      });
      return { ok: true, profile };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(ipcChannels.companySetLogo, async () => {
    try {
      requireRole('administrator');
      const parent = BrowserWindow.getFocusedWindow();
      const options = {
        title: 'Choose company logo',
        properties: ['openFile' as const],
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }],
      };
      const chosen = parent
        ? await dialog.showOpenDialog(parent, options)
        : await dialog.showOpenDialog(options);
      if (chosen.canceled || !chosen.filePaths[0]) {
        return { ok: true, profile: getCompanyProfile(), cancelled: true };
      }
      const saved = saveCompanyLogoFromPath(chosen.filePaths[0]);
      if ('error' in saved) {
        return { ok: false, error: saved.error };
      }
      return { ok: true, profile: getCompanyProfile() };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });

  ipcMain.handle(ipcChannels.companyClearLogo, () => {
    try {
      requireRole('administrator');
      clearCompanyLogo();
      return { ok: true, profile: getCompanyProfile() };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });
}
