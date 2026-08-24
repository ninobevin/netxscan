import { dialog, ipcMain } from 'electron';
import { readFile } from 'node:fs/promises';
import { requireRole } from '../auth/session';
import { ipcChannels } from '../shared/ipc-channels';
import type { CompanyProfileResult } from '../shared/company-types';
import {
  getCompanyProfile,
  parseCompanyName,
  removeCompanyLogo,
  saveCompanyLogo,
  saveCompanyName,
} from './store';
import { writeAudit } from '../audit/repository';

export function registerCompanyIpc(): void {
  ipcMain.handle(
    ipcChannels.companyGet,
    async (): Promise<CompanyProfileResult> => {
      try {
        const profile = await getCompanyProfile();
        return { ok: true, profile };
      } catch {
        return { ok: false, error: 'import_failed' };
      }
    },
  );

  ipcMain.handle(
    ipcChannels.companySaveName,
    async (_event, payload: unknown): Promise<CompanyProfileResult> => {
      const auth = requireAdmin();
      if (!auth.ok) {
        return auth;
      }

      const name = parseCompanyName(
        payload && typeof payload === 'object'
          ? (payload as { companyName?: unknown }).companyName
          : payload,
      );

      if (!name) {
        return { ok: false, error: 'invalid_input' };
      }

      try {
        const profile = await saveCompanyName(name);
        await writeAudit('company_save_name', name);
        return { ok: true, profile };
      } catch {
        return { ok: false, error: 'import_failed' };
      }
    },
  );

  ipcMain.handle(
    ipcChannels.companyUploadLogo,
    async (): Promise<CompanyProfileResult> => {
      const auth = requireAdmin();
      if (!auth.ok) {
        return auth;
      }

      const picked = await dialog.showOpenDialog({
        title: 'Choose company logo',
        filters: [
          { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
        ],
        properties: ['openFile'],
      });

      if (picked.canceled || !picked.filePaths[0]) {
        return { ok: false, error: 'cancelled' };
      }

      try {
        const raw = await readFile(picked.filePaths[0]);
        const profile = await saveCompanyLogo(raw);
        await writeAudit('company_upload_logo', 'Logo replaced.');
        return { ok: true, profile };
      } catch (error) {
        if (error instanceof Error && error.message === 'invalid_input') {
          return { ok: false, error: 'invalid_input' };
        }

        return { ok: false, error: 'import_failed' };
      }
    },
  );

  ipcMain.handle(
    ipcChannels.companyRemoveLogo,
    async (): Promise<CompanyProfileResult> => {
      const auth = requireAdmin();
      if (!auth.ok) {
        return auth;
      }

      try {
        const profile = await removeCompanyLogo();
        await writeAudit('company_remove_logo', 'Logo removed.');
        return { ok: true, profile };
      } catch {
        return { ok: false, error: 'import_failed' };
      }
    },
  );
}

function requireAdmin(): { ok: true } | { ok: false; error: 'forbidden' | 'unauthorized' } {
  try {
    requireRole('administrator');
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return { ok: false, error: 'forbidden' };
    }

    return { ok: false, error: 'unauthorized' };
  }
}
