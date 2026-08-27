import { app, ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import path from 'node:path';
import { getAssetById, upsertPingHost } from '../assets/repository';
import { parseAssetId } from '../assets/validate';
import { requireRole, requireSession } from '../auth/session';
import { markAssetsSeenInScan, recordScan } from './scan-history';
import { writeAudit } from '../audit/repository';
import { ipcChannels } from '../shared/ipc-channels';
import type { NmapProtocolResult } from '../shared/nmap-types';
import type {
  AuthorizedRangesResult,
  AuthorizedScanResult,
} from '../shared/scan-types';
import {
  expandTargetToHostIps,
  ipv4ToInt,
  isTargetAuthorized,
  parseAuthorizedTarget,
} from './authorize';
import { loadAuthorizedRanges } from './load-ranges';
import { pingAddresses } from './ping-hostname';
import { resolveNmapPath, runProtocolScan } from './protocol-scan';
import { getNmapResult, saveNmapResult } from './results';
import { endScan, tryStartScan } from './scan-lock';

function configPath(): string {
  return path.join(app.getPath('userData'), 'authorized-networks.json');
}

function requireAdministrator(): AuthorizedScanResult | null {
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

export function registerNmapIpc(): void {
  ipcMain.handle(
    ipcChannels.scanAuthorizedRanges,
    async (): Promise<AuthorizedRangesResult> => {
      try {
        requireSession();
      } catch {
        return { ok: false, error: 'unauthorized' };
      }

      try {
        const ranges = await loadAuthorizedRanges(configPath());
        return { ok: true, ranges };
      } catch {
        return { ok: false, error: 'invalid_input' };
      }
    },
  );

  ipcMain.handle(
    ipcChannels.scanRun,
    async (
      event: IpcMainInvokeEvent,
      payload: unknown,
    ): Promise<AuthorizedScanResult> => {
      const denied = requireAdministrator();
      if (denied) {
        return denied;
      }

      const targetValue =
        payload && typeof payload === 'object'
          ? (payload as { target?: unknown }).target
          : undefined;

      if (typeof targetValue !== 'string') {
        return { ok: false, error: 'invalid_input' };
      }

      const target = parseAuthorizedTarget(targetValue);
      if (!target) {
        return { ok: false, error: 'invalid_input' };
      }

      let ranges: string[];
      try {
        ranges = await loadAuthorizedRanges(configPath());
      } catch {
        return { ok: false, error: 'invalid_input' };
      }

      if (!isTargetAuthorized(target, ranges)) {
        return { ok: false, error: 'not_authorized_range' };
      }

      const ips = expandTargetToHostIps(target);
      if (!ips || ips.length === 0) {
        return { ok: false, error: 'invalid_input' };
      }

      if (!tryStartScan()) {
        return { ok: false, error: 'scan_in_progress' };
      }

      let upsertQueue = Promise.resolve();
      const enqueue = (work: () => Promise<void>): Promise<void> => {
        upsertQueue = upsertQueue.then(work, work);
        return upsertQueue;
      };

      try {
        const hosts = await pingAddresses(ips, async (host) => {
          if (host.status !== 'up') {
            return;
          }

          await enqueue(async () => {
            const asset = await upsertPingHost(host);
            if (asset && !event.sender.isDestroyed()) {
              event.sender.send(ipcChannels.scanHostFound, asset);
            }
          });
        });

        const upHosts = hosts.filter((host) => host.status === 'up');
        const upIps = upHosts.map((host) => host.ipAddress);
        const scanId = await recordScan('ping', target, upIps.length);
        await markAssetsSeenInScan(scanId, upIps);
        await writeAudit('scan_ping', `${target} · ${upIps.length} host(s) up`);

        return {
          ok: true,
          target,
          hosts: upHosts,
          savedCount: upHosts.length,
        };
      } catch {
        return { ok: false, error: 'scan_failed' };
      } finally {
        endScan();
      }
    },
  );

  ipcMain.handle(
    ipcChannels.nmapProtocolGet,
    async (_event, payload: unknown): Promise<NmapProtocolResult> => {
      const denied = requireAdministrator();
      if (denied && !denied.ok) {
        return { ok: false, error: denied.error };
      }

      const id = parseAssetId(payload);
      if (!id) {
        return { ok: false, error: 'invalid_input' };
      }

      try {
        const result = await getNmapResult(id);
        return { ok: true, result };
      } catch {
        return { ok: false, error: 'scan_failed' };
      }
    },
  );

  ipcMain.handle(
    ipcChannels.nmapProtocolRun,
    async (_event, payload: unknown): Promise<NmapProtocolResult> => {
      const denied = requireAdministrator();
      if (denied && !denied.ok) {
        return { ok: false, error: denied.error };
      }

      const id = parseAssetId(payload);
      if (!id) {
        return { ok: false, error: 'invalid_input' };
      }

      let asset;
      try {
        asset = await getAssetById(id);
      } catch {
        return { ok: false, error: 'scan_failed' };
      }
      if (!asset) {
        return { ok: false, error: 'not_found' };
      }

      const ip = asset.ipAddress?.trim() ?? '';
      if (ipv4ToInt(ip) === null) {
        return { ok: false, error: 'invalid_input' };
      }

      let ranges: string[];
      try {
        ranges = await loadAuthorizedRanges(configPath());
      } catch {
        return { ok: false, error: 'invalid_input' };
      }

      if (!isTargetAuthorized(ip, ranges)) {
        return { ok: false, error: 'not_authorized_range' };
      }

      const nmapPath = resolveNmapPath();
      if (!nmapPath) {
        return { ok: false, error: 'nmap_missing' };
      }

      if (!tryStartScan()) {
        return { ok: false, error: 'scan_in_progress' };
      }

      try {
        const result = await runProtocolScan(nmapPath, ip, asset.hostname);
        await saveNmapResult(asset.id, result);
        await writeAudit(
          'nmap_protocol_scan',
          `${asset.hostname} ${ip}`.slice(0, 500),
        );
        return { ok: true, result };
      } catch (error) {
        if (error instanceof Error && error.message === 'nmap_missing') {
          return { ok: false, error: 'nmap_missing' };
        }
        return { ok: false, error: 'scan_failed' };
      } finally {
        endScan();
      }
    },
  );
}
