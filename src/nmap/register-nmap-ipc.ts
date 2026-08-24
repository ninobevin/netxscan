import { app, ipcMain } from 'electron';
import path from 'node:path';
import { upsertDiscoveredHost } from '../assets/repository';
import { requireRole, requireSession } from '../auth/session';
import { markAssetsSeenInScan, recordScan } from '../dashboard/repository';
import { writeAudit } from '../audit/repository';
import { ipcChannels } from '../shared/ipc-channels';
import type {
  AuthorizedRangesResult,
  AuthorizedScanResult,
  NmapHost,
} from '../shared/scan-types';
import { isTargetAuthorized, parseAuthorizedTarget } from './authorize';
import { loadAuthorizedRanges } from './load-ranges';
import {
  resolveNmapPath,
  runAuthorizedDiscoveryScan,
  runAuthorizedPingScan,
} from './run-scan';

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

async function runControlledScan(
  payload: unknown,
  runner: (nmapPath: string, target: string) => Promise<NmapHost[]>,
  saveHosts: boolean,
): Promise<AuthorizedScanResult> {
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

  const nmapPath = await resolveNmapPath();

  if (!nmapPath) {
    return { ok: false, error: 'nmap_missing' };
  }

  if (!tryStartScan()) {
    return { ok: false, error: 'scan_in_progress' };
  }

  try {
    const hosts = await runner(nmapPath, target);
    let savedCount = 0;
    const upIps = hosts
      .filter((host) => host.status === 'up')
      .map((host) => host.ipAddress);

    if (saveHosts) {
      for (const host of hosts) {
        if (host.status === 'up') {
          await upsertDiscoveredHost(host);
          savedCount += 1;
        }
      }
    }

    const scanId = await recordScan(
      saveHosts ? 'discovery' : 'ping',
      target,
      upIps.length,
    );
    await markAssetsSeenInScan(scanId, upIps);
    await writeAudit(
      saveHosts ? 'scan_discovery' : 'scan_ping',
      `${target} · ${upIps.length} host(s) up`,
    );

    return { ok: true, target, hosts, savedCount };
  } catch (error) {
    if (error instanceof Error && error.message === 'timeout') {
      return { ok: false, error: 'timeout' };
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return { ok: false, error: 'nmap_missing' };
    }

    return { ok: false, error: 'scan_failed' };
  } finally {
    endScan();
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

  ipcMain.handle(ipcChannels.scanRun, async (_event, payload: unknown) => {
    return runControlledScan(payload, runAuthorizedPingScan, false);
  });

  ipcMain.handle(ipcChannels.scanDiscover, async (_event, payload: unknown) => {
    return runControlledScan(payload, runAuthorizedDiscoveryScan, true);
  });
}
