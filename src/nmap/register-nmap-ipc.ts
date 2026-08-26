import { app, ipcMain } from 'electron';
import path from 'node:path';
import { upsertPingHost } from '../assets/repository';
import { requireRole, requireSession } from '../auth/session';
import { markAssetsSeenInScan, recordScan } from './scan-history';
import { writeAudit } from '../audit/repository';
import { ipcChannels } from '../shared/ipc-channels';
import type {
  AuthorizedRangesResult,
  AuthorizedScanResult,
} from '../shared/scan-types';
import {
  expandTargetToHostIps,
  isTargetAuthorized,
  parseAuthorizedTarget,
} from './authorize';
import { loadAuthorizedRanges } from './load-ranges';
import { pingAddresses } from './ping-hostname';
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
    async (_event, payload: unknown): Promise<AuthorizedScanResult> => {
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

      try {
        const hosts = await pingAddresses(ips);
        const upHosts = hosts.filter((host) => host.status === 'up');
        let savedCount = 0;
        for (const host of upHosts) {
          await upsertPingHost(host);
          savedCount += 1;
        }

        const upIps = upHosts.map((host) => host.ipAddress);
        const scanId = await recordScan('ping', target, upIps.length);
        await markAssetsSeenInScan(scanId, upIps);
        await writeAudit('scan_ping', `${target} · ${upIps.length} host(s) up`);

        return { ok: true, target, hosts: upHosts, savedCount };
      } catch {
        return { ok: false, error: 'scan_failed' };
      } finally {
        endScan();
      }
    },
  );
}
