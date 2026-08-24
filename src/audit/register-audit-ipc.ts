import { ipcMain } from 'electron';
import { requireSession } from '../auth/session';
import { ipcChannels } from '../shared/ipc-channels';
import type { AuditListResult } from '../shared/audit-types';
import { listAudit, parseAuditSearch } from './repository';

export function registerAuditIpc(): void {
  ipcMain.handle(
    ipcChannels.auditList,
    async (_event, payload: unknown): Promise<AuditListResult> => {
      try {
        requireSession();
      } catch {
        return { ok: false, error: 'unauthorized' };
      }

      const search = parseAuditSearch(
        payload && typeof payload === 'object'
          ? (payload as { query?: unknown }).query
          : payload,
      );

      try {
        const entries = await listAudit(search);
        return { ok: true, entries };
      } catch {
        return { ok: false, error: 'database_unavailable' };
      }
    },
  );
}
