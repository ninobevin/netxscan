import { BrowserWindow, app, dialog, ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { requireAppSession } from '../auth/session';
import { getCompanyProfile } from '../company/repository';
import { buildReportSections } from '../adhics/repository';
import { errorMessage } from '../ipc/error-message';
import { ipcChannels } from '../shared/ipc-channels';
import { buildCompliancePdf } from './build-pdf';

export function registerReportIpc(): void {
  ipcMain.handle(ipcChannels.reportSavePdf, async () => {
    try {
      requireAppSession();
      const company = getCompanyProfile();
      const bytes = await buildCompliancePdf({
        companyName: company.name,
        companyAddress: company.address,
        domains: buildReportSections(),
      });
      const parent = BrowserWindow.getFocusedWindow();
      const options = {
        title: 'Save compliance report',
        defaultPath: path.join(app.getPath('documents'), 'compliance-report.pdf'),
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      };
      const chosen = parent
        ? await dialog.showSaveDialog(parent, options)
        : await dialog.showSaveDialog(options);
      if (chosen.canceled || !chosen.filePath) {
        return { ok: true, cancelled: true };
      }
      fs.writeFileSync(chosen.filePath, Buffer.from(bytes));
      return { ok: true, path: chosen.filePath };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  });
}
