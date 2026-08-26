import { spawn } from 'node:child_process';
import { ipv4ToInt, isTargetAuthorized } from '../nmap/authorize';
import { parseDnsHostname } from '../nmap/hostnames';
import type { Asset } from '../shared/asset-types';
import type { WinrmAction } from '../shared/winrm-types';

const SC_TIMEOUT_MS = 30_000;
const PS_TIMEOUT_MS = 20_000;

export function resolveComputerName(asset: Asset): string | null {
  const dns = parseDnsHostname(asset.hostname);
  if (dns) {
    return dns;
  }

  const ip = asset.ipAddress?.trim() ?? '';
  if (ipv4ToInt(ip) !== null) {
    return ip;
  }

  return null;
}

export function isAssetHostAuthorized(
  asset: Asset,
  ranges: string[],
): boolean {
  const ip = asset.ipAddress?.trim() ?? '';
  if (ipv4ToInt(ip) === null) {
    return false;
  }

  return isTargetAuthorized(ip, ranges);
}

export async function startOrStopWinrm(
  computer: string,
  action: WinrmAction,
): Promise<{ ok: boolean; detail: string }> {
  const scPath = process.env.SystemRoot
    ? `${process.env.SystemRoot}\\System32\\sc.exe`
    : 'sc.exe';
  const verb = action === 'enable' ? 'start' : 'stop';
  const result = await runArgv(scPath, [`\\\\${computer}`, verb, 'WinRM'], SC_TIMEOUT_MS);

  if (result.code === 0) {
    return { ok: true, detail: `${verb} WinRM succeeded` };
  }

  const combined = `${result.stdout}\n${result.stderr}`;
  if (action === 'enable' && /1056/.test(combined)) {
    return { ok: true, detail: 'WinRM already running' };
  }

  if (action === 'disable' && /1062/.test(combined)) {
    return { ok: true, detail: 'WinRM already stopped' };
  }

  return {
    ok: false,
    detail: truncate(`sc.exe ${verb} exit ${result.code ?? 'timeout'}`),
  };
}

export async function probePowerShellRemoting(
  computer: string,
): Promise<{ manageable: boolean; detail: string }> {
  const psPath = process.env.SystemRoot
    ? `${process.env.SystemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
    : 'powershell.exe';
  const command = `Invoke-Command -ComputerName '${computer}' -ScriptBlock { hostname } -ErrorAction Stop`;
  const result = await runArgv(
    psPath,
    ['-NoProfile', '-NonInteractive', '-Command', command],
    PS_TIMEOUT_MS,
  );

  if (result.code === 0 && result.stdout.trim().length > 0) {
    return { manageable: true, detail: 'PowerShell remoting succeeded' };
  }

  const snippet = truncate(result.stderr || result.stdout || `exit ${result.code ?? 'timeout'}`);
  return { manageable: false, detail: snippet };
}

function truncate(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function runArgv(
  exe: string,
  args: string[],
  timeoutMs: number,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(exe, args, { shell: false, windowsHide: true });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = (code: number | null) => {
      if (settled) {
        return;
      }

      settled = true;
      resolve({ code, stdout, stderr });
    };

    const timer = setTimeout(() => {
      child.kill();
      finish(null);
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', () => {
      clearTimeout(timer);
      finish(null);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      finish(code);
    });
  });
}
