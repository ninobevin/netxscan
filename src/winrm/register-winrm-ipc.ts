import { app, ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import path from 'node:path';
import { getAssetById, setWinrmManageable } from '../assets/repository';
import { parseAssetIds } from '../assets/validate';
import { requireRole } from '../auth/session';
import { writeAudit } from '../audit/repository';
import { loadAuthorizedRanges } from '../nmap/load-ranges';
import { ipcChannels } from '../shared/ipc-channels';
import type { WinrmAction, WinrmBatchResult } from '../shared/winrm-types';
import { endWinrm, tryStartWinrm } from './lock';
import {
  isAssetHostAuthorized,
  probePowerShellRemoting,
  resolveComputerName,
  startOrStopWinrm,
} from './service';

function configPath(): string {
  return path.join(app.getPath('userData'), 'authorized-networks.json');
}

function requireAdministrator(): WinrmBatchResult | null {
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

function parseAction(payload: unknown): WinrmAction | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const action = (payload as { action?: unknown }).action;
  if (action === 'enable' || action === 'disable') {
    return action;
  }

  return null;
}

export function registerWinrmIpc(): void {
  ipcMain.handle(
    ipcChannels.winrmBatch,
    async (
      event: IpcMainInvokeEvent,
      payload: unknown,
    ): Promise<WinrmBatchResult> => {
      const denied = requireAdministrator();
      if (denied) {
        return denied;
      }

      if (process.platform !== 'win32') {
        return { ok: false, error: 'unavailable' };
      }

      const action = parseAction(payload);
      const ids = parseAssetIds(payload);
      if (!action || !ids) {
        return { ok: false, error: 'invalid_input' };
      }

      let ranges: string[];
      try {
        ranges = await loadAuthorizedRanges(configPath());
      } catch {
        return { ok: false, error: 'invalid_input' };
      }

      if (!tryStartWinrm()) {
        return { ok: false, error: 'winrm_in_progress' };
      }

      const auditAction = action === 'enable' ? 'winrm_enable' : 'winrm_disable';

      try {
        let processed = 0;

        for (const id of ids) {
          if (!event.sender.isDestroyed()) {
            event.sender.send(ipcChannels.winrmProgress, {
              type: 'running',
              assetId: id,
            });
          }

          const asset = await getAssetById(id);
          if (!asset) {
            sendDone(event, id, false, false, 'Asset not found', null);
            continue;
          }

          const computer = resolveComputerName(asset);
          if (!computer) {
            const saved = await setWinrmManageable(
              id,
              false,
              'No DNS hostname or IPv4 address',
            );
            sendDone(
              event,
              id,
              false,
              false,
              'No DNS hostname or IPv4 address',
              saved ?? null,
            );
            continue;
          }

          if (!isAssetHostAuthorized(asset, ranges)) {
            const saved = await setWinrmManageable(
              id,
              false,
              'Host is outside authorized networks',
            );
            sendDone(
              event,
              id,
              false,
              false,
              'Host is outside authorized networks',
              saved ?? null,
            );
            continue;
          }

          const sc = await startOrStopWinrm(computer, action);
          const probe = await probePowerShellRemoting(computer);
          const saved = await setWinrmManageable(
            id,
            probe.manageable,
            probe.manageable ? probe.detail : `${sc.detail}; ${probe.detail}`,
          );
          const label = `${computer}${asset.ipAddress ? ` (${asset.ipAddress})` : ''}`;
          await writeAudit(auditAction, label);
          sendDone(
            event,
            id,
            sc.ok,
            probe.manageable,
            saved?.winrmDetail ?? probe.detail,
            saved ?? null,
          );
          processed += 1;
        }

        return { ok: true, processed };
      } catch {
        return { ok: false, error: 'database_unavailable' };
      } finally {
        endWinrm();
      }
    },
  );
}

function sendDone(
  event: IpcMainInvokeEvent,
  assetId: string,
  scOk: boolean,
  manageable: boolean,
  detail: string,
  asset: Awaited<ReturnType<typeof getAssetById>> | null,
): void {
  if (event.sender.isDestroyed()) {
    return;
  }

  event.sender.send(ipcChannels.winrmProgress, {
    type: 'done',
    assetId,
    scOk,
    manageable,
    detail,
    asset,
  });
}
