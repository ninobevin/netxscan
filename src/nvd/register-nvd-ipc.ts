import { ipcMain } from 'electron';
import { requireRole } from '../auth/session';
import { writeAudit } from '../audit/repository';
import { parseAssetId } from '../assets/validate';
import { ipcChannels } from '../shared/ipc-channels';
import type {
  NvdSaveKeyResult,
  NvdStatus,
  NvdStatusResult,
  NvdSyncResult,
  SoftwareCveHitsResult,
} from '../shared/nvd-types';
import { countNvdRows, getNvdMeta, listSoftwareHits, setNvdMeta } from './repository';
import { endNvdSync, syncNvdCatalog, tryStartNvdSync } from './sync';
import { getNvdApiKey, keyTail, saveNvdApiKey } from './settings';

function requireAdmin(): { ok: false; error: 'unauthorized' | 'forbidden' } | null {
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

async function buildStatus(): Promise<NvdStatus> {
  const apiKey = await getNvdApiKey();
  const counts = await countNvdRows();
  return {
    hasApiKey: Boolean(apiKey),
    apiKeyTail: keyTail(apiKey),
    lastSyncAt: await getNvdMeta('last_sync_at'),
    lastSyncSummary: await getNvdMeta('last_sync_summary'),
    cpeCount: counts.cpes,
    cveCount: counts.cves,
  };
}

export function registerNvdIpc(): void {
  ipcMain.handle(
    ipcChannels.nvdStatus,
    async (): Promise<NvdStatusResult> => {
      const denied = requireAdmin();
      if (denied) {
        return denied;
      }
      return { ok: true, status: await buildStatus() };
    },
  );

  ipcMain.handle(
    ipcChannels.nvdSaveKey,
    async (_event, payload: unknown): Promise<NvdSaveKeyResult> => {
      const denied = requireAdmin();
      if (denied) {
        return denied;
      }
      const raw =
        payload && typeof payload === 'object'
          ? (payload as { apiKey?: unknown }).apiKey
          : undefined;
      if (raw !== undefined && raw !== null && typeof raw !== 'string') {
        return { ok: false, error: 'invalid_input' };
      }
      const saved = await saveNvdApiKey(typeof raw === 'string' ? raw : '');
      if (typeof raw === 'string' && raw.trim() !== '' && saved === null) {
        return { ok: false, error: 'invalid_input' };
      }
      await writeAudit('nvd_api_key', saved ? 'NVD API key saved' : 'NVD API key cleared');
      return { ok: true, status: await buildStatus() };
    },
  );

  ipcMain.handle(
    ipcChannels.nvdSync,
    async (): Promise<NvdSyncResult> => {
      const denied = requireAdmin();
      if (denied) {
        return denied;
      }
      if (!tryStartNvdSync()) {
        return { ok: false, error: 'sync_in_progress' };
      }
      try {
        const result = await syncNvdCatalog();
        const summary = `${result.products} product(s), ${result.cpes} CPE(s), ${result.cves} CVE(s)`;
        await setNvdMeta('last_sync_at', new Date().toISOString());
        await setNvdMeta('last_sync_summary', summary.slice(0, 500));
        await writeAudit('nvd_sync', summary);
        return { ok: true, status: await buildStatus(), ...result };
      } catch (error) {
        if (error instanceof Error && error.message === 'no_software') {
          return { ok: false, error: 'no_software' };
        }
        return { ok: false, error: 'nvd_unavailable' };
      } finally {
        endNvdSync();
      }
    },
  );

  ipcMain.handle(
    ipcChannels.nvdSoftwareHits,
    async (_event, payload: unknown): Promise<SoftwareCveHitsResult> => {
      const denied = requireAdmin();
      if (denied) {
        return denied;
      }
      const id = parseAssetId(payload);
      if (!id) {
        return { ok: false, error: 'invalid_input' };
      }
      const hits = await listSoftwareHits(id);
      return { ok: true, hits };
    },
  );
}
