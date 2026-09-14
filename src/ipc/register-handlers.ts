import { app, ipcMain } from 'electron';
import path from 'node:path';
import { initializeDatabase } from '../db/client';
import { runMigrations } from '../db/migrate';
import { registerAuthIpc } from '../auth/register-auth-ipc';
import { registerScanIpc } from '../scan/register-scan-ipc';
import { registerAssetIpc } from '../assets/register-asset-ipc';
import { registerCompanyIpc } from '../company/register-company-ipc';
import { registerAdhicsIpc } from '../adhics/register-adhics-ipc';
import { registerReportIpc } from '../report/register-report-ipc';
import { requireAppSession } from '../auth/session';
import { errorMessage } from './error-message';
import { ipcChannels } from '../shared/ipc-channels';

export async function registerIpcHandlers(): Promise<void> {
  registerAuthIpc();
  registerScanIpc();
  registerAssetIpc();
  registerCompanyIpc();
  registerAdhicsIpc();
  registerReportIpc();

  ipcMain.handle(ipcChannels.ping, () => {
    try {
      requireAppSession();
      return 'pong';
    } catch (error) {
      throw new Error(errorMessage(error));
    }
  });

  ipcMain.handle(ipcChannels.getAppVersion, () => app.getVersion());

  const dbPath = path.join(app.getPath('userData'), 'netxscan.sqlite');
  const db = await initializeDatabase(dbPath);
  runMigrations(db);
}
