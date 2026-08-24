import { app, ipcMain } from 'electron';
import os from 'node:os';
import path from 'node:path';
import { getAssetById } from '../assets/repository';
import { parseAssetId } from '../assets/validate';
import { parseUninstallKey, parseUninstallMode } from './validate';
import { parseCredentialId } from '../credentials/validate';
import { readStoredSecret } from '../credentials/vault';
import { requireRole, requireSession } from '../auth/session';
import { isTargetAuthorized } from '../nmap/authorize';
import { loadAuthorizedRanges } from '../nmap/load-ranges';
import { endScan, tryStartScan } from '../nmap/scan-lock';
import type { WindowsAssessmentResult } from '../shared/windows-types';
import { ipcChannels } from '../shared/ipc-channels';
import { writeAudit } from '../audit/repository';
import {
  localIPv4Addresses,
  parseWindowsFacts,
  runLocalWindowsCollect,
  runRemoteWindowsCollect,
  runRemoteWindowsUninstall,
} from './collect';
import { runLocalWindowsUninstall } from './uninstall';
import {
  createLocalAsset,
  findAssetIdByIp,
  getLatestWindowsAssessment,
  saveWindowsAssessment,
} from './repository';

const LOCAL_NOTES =
  'Local Windows configuration collected with a fixed PowerShell script. This is not a CVE finding.';
const REMOTE_NOTES =
  'Remote Windows configuration collected over WinRM. Passwords are stored only in Windows Credential Manager, not in MySQL. This is not a CVE finding.';

function rangesPath(): string {
  return path.join(app.getPath('userData'), 'authorized-networks.json');
}

export function registerWindowsIpc(): void {
  ipcMain.handle(
    ipcChannels.windowsLatest,
    async (_event, payload: unknown): Promise<WindowsAssessmentResult> => {
      try {
        requireSession();
      } catch {
        return { ok: false, error: 'unauthorized' };
      }

      const assetId = parseAssetId(payload);

      if (!assetId) {
        return { ok: false, error: 'invalid_input' };
      }

      try {
        const assessment = await getLatestWindowsAssessment(assetId);
        return assessment
          ? { ok: true, assessment }
          : { ok: false, error: 'not_found' };
      } catch {
        return { ok: false, error: 'database_unavailable' };
      }
    },
  );

  ipcMain.handle(
    ipcChannels.windowsAssessLocal,
    async (): Promise<WindowsAssessmentResult> => {
      try {
        requireRole('administrator');
      } catch (error) {
        if (error instanceof Error && error.message === 'Forbidden') {
          return { ok: false, error: 'forbidden' };
        }

        return { ok: false, error: 'unauthorized' };
      }

      let ranges: string[];

      try {
        ranges = await loadAuthorizedRanges(rangesPath());
      } catch {
        return { ok: false, error: 'invalid_input' };
      }

      const localIps = localIPv4Addresses().filter((ip) =>
        isTargetAuthorized(ip, ranges),
      );

      if (localIps.length === 0) {
        return { ok: false, error: 'not_authorized_range' };
      }

      if (!tryStartScan()) {
        return { ok: false, error: 'scan_in_progress' };
      }

      try {
        const raw = await runLocalWindowsCollect();
        const facts = parseWindowsFacts(raw, localIps);
        const hostname = facts.hostname ?? os.hostname();
        let assetId: string | undefined;

        for (const ip of localIps) {
          assetId = await findAssetIdByIp(ip);
          if (assetId) {
            break;
          }
        }

        if (!assetId) {
          const ip = localIps[0];

          if (!ip) {
            return { ok: false, error: 'not_authorized_range' };
          }

          assetId = await createLocalAsset(hostname, ip);
        }

        const assessment = await saveWindowsAssessment(
          assetId,
          facts,
          LOCAL_NOTES,
        );
        await writeAudit('windows_local', hostname);
        return { ok: true, assessment };
      } catch (error) {
        if (error instanceof Error && error.message === 'timeout') {
          return { ok: false, error: 'timeout' };
        }

        return { ok: false, error: 'powershell_failed' };
      } finally {
        endScan();
      }
    },
  );

  ipcMain.handle(
    ipcChannels.windowsAssessRemote,
    async (_event, payload: unknown): Promise<WindowsAssessmentResult> => {
      try {
        requireRole('administrator');
      } catch (error) {
        if (error instanceof Error && error.message === 'Forbidden') {
          return { ok: false, error: 'forbidden' };
        }

        return { ok: false, error: 'unauthorized' };
      }

      const assetId = parseAssetId(payload);

      if (!assetId) {
        return { ok: false, error: 'invalid_input' };
      }

      let ipAddress: string | null = null;

      try {
        const asset = await getAssetById(assetId);
        ipAddress = asset?.ipAddress ?? null;

        if (!asset) {
          return { ok: false, error: 'not_found' };
        }
      } catch {
        return { ok: false, error: 'database_unavailable' };
      }

      if (!ipAddress) {
        return { ok: false, error: 'invalid_input' };
      }

      let ranges: string[];

      try {
        ranges = await loadAuthorizedRanges(rangesPath());
      } catch {
        return { ok: false, error: 'invalid_input' };
      }

      if (!isTargetAuthorized(ipAddress, ranges)) {
        return { ok: false, error: 'not_authorized_range' };
      }

      const secret = await loadWinRmSecret(payload);

      if (!secret.ok) {
        return secret;
      }

      if (!tryStartScan()) {
        return { ok: false, error: 'scan_in_progress' };
      }

      try {
        const raw = await runRemoteWindowsCollect(ipAddress, secret.credential);
        const facts = parseWindowsFacts(raw, [ipAddress]);
        const assessment = await saveWindowsAssessment(
          assetId,
          facts,
          REMOTE_NOTES,
        );
        await writeAudit('windows_remote', ipAddress);
        return { ok: true, assessment };
      } catch (error) {
        if (error instanceof Error && error.message === 'timeout') {
          return { ok: false, error: 'timeout' };
        }

        if (error instanceof Error && error.message === 'invalid_input') {
          return { ok: false, error: 'invalid_input' };
        }

        return { ok: false, error: 'winrm_failed' };
      } finally {
        endScan();
      }
    },
  );

  ipcMain.handle(
    ipcChannels.windowsUninstallSoftware,
    async (_event, payload: unknown): Promise<WindowsAssessmentResult> => {
      try {
        requireRole('administrator');
      } catch (error) {
        if (error instanceof Error && error.message === 'Forbidden') {
          return { ok: false, error: 'forbidden' };
        }

        return { ok: false, error: 'unauthorized' };
      }

      const record =
        payload && typeof payload === 'object'
          ? (payload as Record<string, unknown>)
          : null;
      const assetId = parseAssetId(payload);
      const uninstallKey = parseUninstallKey(record?.key);
      const mode = parseUninstallMode(record?.mode);

      if (!assetId || !uninstallKey || !mode) {
        return { ok: false, error: 'invalid_input' };
      }

      let latest;

      try {
        latest = await getLatestWindowsAssessment(assetId);
      } catch {
        return { ok: false, error: 'database_unavailable' };
      }

      const known = latest?.facts.software.some(
        (item) => item.key === uninstallKey,
      );

      if (!known) {
        return { ok: false, error: 'not_found' };
      }

      let ranges: string[];

      try {
        ranges = await loadAuthorizedRanges(rangesPath());
      } catch {
        return { ok: false, error: 'invalid_input' };
      }

      if (mode === 'local') {
        const localIps = localIPv4Addresses().filter((ip) =>
          isTargetAuthorized(ip, ranges),
        );

        if (localIps.length === 0) {
          return { ok: false, error: 'not_authorized_range' };
        }

        if (!tryStartScan()) {
          return { ok: false, error: 'scan_in_progress' };
        }

        try {
          await runLocalWindowsUninstall(uninstallKey);
          const raw = await runLocalWindowsCollect();
          const facts = parseWindowsFacts(raw, localIps);
          const assessment = await saveWindowsAssessment(
            assetId,
            facts,
            LOCAL_NOTES,
          );
          await writeAudit('windows_uninstall', `local key ${uninstallKey.slice(0, 80)}`);
          return { ok: true, assessment };
        } catch (error) {
          return mapUninstallError(error);
        } finally {
          endScan();
        }
      }

      let ipAddress: string | null = null;

      try {
        const asset = await getAssetById(assetId);
        ipAddress = asset?.ipAddress ?? null;

        if (!asset) {
          return { ok: false, error: 'not_found' };
        }
      } catch {
        return { ok: false, error: 'database_unavailable' };
      }

      if (!ipAddress) {
        return { ok: false, error: 'invalid_input' };
      }

      if (!isTargetAuthorized(ipAddress, ranges)) {
        return { ok: false, error: 'not_authorized_range' };
      }

      const secret = await loadWinRmSecret(payload);

      if (!secret.ok) {
        return secret;
      }

      if (!tryStartScan()) {
        return { ok: false, error: 'scan_in_progress' };
      }

      try {
        await runRemoteWindowsUninstall(
          ipAddress,
          uninstallKey,
          secret.credential,
        );
        const raw = await runRemoteWindowsCollect(ipAddress, secret.credential);
        const facts = parseWindowsFacts(raw, [ipAddress]);
        const assessment = await saveWindowsAssessment(
          assetId,
          facts,
          REMOTE_NOTES,
        );
        await writeAudit(
          'windows_uninstall',
          `remote ${ipAddress} key ${uninstallKey.slice(0, 80)}`,
        );
        return { ok: true, assessment };
      } catch (error) {
        return mapUninstallError(error, true);
      } finally {
        endScan();
      }
    },
  );
}

async function loadWinRmSecret(
  payload: unknown,
): Promise<
  | { ok: true; credential?: { username: string; password: string } }
  | { ok: false; error: 'credential_missing' | 'invalid_input' }
> {
  const record =
    payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>)
      : null;
  const credentialId = record?.credentialId;

  if (credentialId === undefined || credentialId === null || credentialId === '') {
    return { ok: true };
  }

  const id = parseCredentialId(credentialId);

  if (!id) {
    return { ok: false, error: 'invalid_input' };
  }

  const secret = await readStoredSecret(id);

  if (!secret) {
    return { ok: false, error: 'credential_missing' };
  }

  return { ok: true, credential: secret };
}

function mapUninstallError(
  error: unknown,
  remote = false,
): WindowsAssessmentResult {
  if (error instanceof Error && error.message === 'timeout') {
    return { ok: false, error: 'timeout' };
  }

  if (error instanceof Error && error.message === 'invalid_input') {
    return { ok: false, error: 'invalid_input' };
  }

  if (error instanceof Error && error.message === 'uninstall_unsupported') {
    return { ok: false, error: 'uninstall_unsupported' };
  }

  if (error instanceof Error && error.message.startsWith('uninstall_failed:')) {
    return {
      ok: false,
      error: 'uninstall_failed',
      detail: error.message.slice('uninstall_failed:'.length),
    };
  }

  if (error instanceof Error && error.message === 'uninstall_failed') {
    return { ok: false, error: 'uninstall_failed' };
  }

  if (remote) {
    return { ok: false, error: 'winrm_failed' };
  }

  return { ok: false, error: 'powershell_failed' };
}
