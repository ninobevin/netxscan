import { ipcMain } from 'electron';
import { requireRole } from '../auth/session';
import { ipcChannels } from '../shared/ipc-channels';
import type { FindingsMatrixResult } from '../shared/findings-types';
import { buildFindingsMatrix } from './matrix';

function requireAdmin(): FindingsMatrixResult | null {
  try {
    requireRole('administrator');
    return null;
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return { ok: false, error: 'forbidden' };
    }
    return { ok: false, error: 'unauthorized' };
  }
}

export function registerFindingsIpc(): void {
  ipcMain.handle(
    ipcChannels.findingsMatrix,
    async (): Promise<FindingsMatrixResult> => {
      const denied = requireAdmin();
      if (denied) {
        return denied;
      }

      try {
        const matrix = await buildFindingsMatrix();
        return { ok: true, matrix };
      } catch {
        return { ok: false, error: 'database_unavailable' };
      }
    },
  );
}
