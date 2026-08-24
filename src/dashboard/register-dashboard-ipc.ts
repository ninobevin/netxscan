import { ipcMain } from 'electron';
import { requireSession } from '../auth/session';
import { ipcChannels } from '../shared/ipc-channels';
import type { DashboardResult } from '../shared/dashboard-types';
import { getDashboard } from './repository';

export function registerDashboardIpc(): void {
  ipcMain.handle(
    ipcChannels.dashboardGet,
    async (): Promise<DashboardResult> => {
      try {
        requireSession();
      } catch {
        return { ok: false, error: 'unauthorized' };
      }

      try {
        const dashboard = await getDashboard();
        return { ok: true, dashboard };
      } catch {
        return { ok: false, error: 'database_unavailable' };
      }
    },
  );
}
