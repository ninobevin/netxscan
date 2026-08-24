import { app, ipcMain } from 'electron';
import path from 'node:path';
import { registerAssessIpc } from '../assess/register-assess-ipc';
import { registerAssetIpc } from '../assets/register-asset-ipc';
import { registerAuthIpc, requireSession } from '../auth/register-auth-ipc';
import { initializeUserStore } from '../auth/user-store';
import { initializeDatabase } from '../db/client';
import { loadDatabaseConfig } from '../db/load-config';
import { runMigrations } from '../db/migrate';
import { registerNmapIpc } from '../nmap/register-nmap-ipc';
import { registerWindowsIpc } from '../windows/register-windows-ipc';
import { registerCredentialsIpc } from '../credentials/register-credentials-ipc';
import { registerCveIpc } from '../cve/register-cve-ipc';
import { registerCorrelateIpc } from '../correlate/register-correlate-ipc';
import { registerFindingsIpc } from '../findings/register-findings-ipc';
import { registerDashboardIpc } from '../dashboard/register-dashboard-ipc';
import { registerCompanyIpc } from '../company/register-company-ipc';
import { registerAuditIpc } from '../audit/register-audit-ipc';
import { registerReportsIpc } from '../reports/register-reports-ipc';
import type { DatabaseStatus } from '../shared/database-status';
import { classifyDatabaseError } from '../shared/database-status';
import { ipcChannels } from '../shared/ipc-channels';

let databaseStatus: DatabaseStatus = { ok: false, reason: 'unknown' };

export async function registerIpcHandlers(): Promise<void> {
  registerAuthIpc();
  registerAssetIpc();
  registerNmapIpc();
  registerAssessIpc();
  registerWindowsIpc();
  registerCredentialsIpc();
  registerCveIpc();
  registerCorrelateIpc();
  registerFindingsIpc();
  registerDashboardIpc();
  registerCompanyIpc();
  registerAuditIpc();
  registerReportsIpc();

  ipcMain.handle(ipcChannels.getDatabaseStatus, () => databaseStatus);

  ipcMain.handle(ipcChannels.ping, () => {
    requireSession();
    return 'pong';
  });

  ipcMain.handle(ipcChannels.getAppVersion, () => {
    requireSession();
    return app.getVersion();
  });

  try {
    const config = await loadDatabaseConfig(
      path.join(app.getPath('userData'), 'database.json'),
    );
    const db = await initializeDatabase(config);
    await runMigrations(db);
    await initializeUserStore();
    databaseStatus = { ok: true };
  } catch (error) {
    databaseStatus = classifyDatabaseError(error);
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String(error.code)
        : 'UNKNOWN';
    console.error(`Database startup failed (${code}).`);
  }
}
