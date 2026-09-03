import { ipcMain } from 'electron';
import { ipcChannels } from '../shared/ipc-channels';
import { requireSession } from '../auth/session';
import { errorMessage } from '../ipc/error-message';
import { expandScanTarget } from './expand-targets';
import { pingHost } from './ping-host';
import { mapPool } from './pool';
import { addScanHosts } from '../assets/repository';
import type { ScanHost } from '../shared/asset-types';

let scanning = false;

export function registerScanIpc(): void {
  ipcMain.handle(ipcChannels.scanRun, async (event, payload: unknown) => {
    try {
      requireSession();
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
    if (scanning) {
      return { ok: false, error: 'A scan is already running.' };
    }

    const target =
      payload && typeof payload === 'object'
        ? String((payload as { target?: unknown }).target ?? '')
        : '';
    const expanded = expandScanTarget(target);
    if ('error' in expanded) {
      return { ok: false, error: expanded.error };
    }

    scanning = true;
    let live = 0;
    try {
      const jobs =
        expanded.kind === 'ipv4'
          ? expanded.ips
          : [expanded.host];

      await mapPool(jobs, 32, async (job) => {
        const ping = await pingHost(job);
        if (!ping.live || !ping.ipv4) {
          return;
        }
        live += 1;
        const host: ScanHost = {
          ipv4: ping.ipv4,
          hostname: ping.hostname,
          winrmOk: false,
          osVersion: null,
        };
        event.sender.send(ipcChannels.scanHostFound, host);
      });

      return { ok: true, scanned: jobs.length, live };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    } finally {
      scanning = false;
    }
  });

  ipcMain.handle(ipcChannels.scanAddToAssets, (_event, payload: unknown) => {
    try {
      requireSession();
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
    if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { hosts?: unknown }).hosts)) {
      return { ok: false, error: 'Select at least one host.' };
    }

    const hosts: ScanHost[] = [];
    for (const item of (payload as { hosts: unknown[] }).hosts) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const row = item as Partial<ScanHost>;
      const ipv4 = String(row.ipv4 ?? '');
      if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ipv4)) {
        continue;
      }
      hosts.push({
        ipv4,
        hostname: row.hostname ? String(row.hostname) : null,
        winrmOk: false,
        osVersion: null,
      });
    }

    if (hosts.length === 0) {
      return { ok: false, error: 'Select at least one host.' };
    }

    const result = addScanHosts(hosts);
    return { ok: true, ...result };
  });
}
