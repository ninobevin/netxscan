import { spawn } from 'node:child_process';
import os from 'node:os';
import { ipv4ToInt } from '../nmap/authorize';
import { winRmComputerName } from '../nmap/hostnames';
import {
  WINDOWS_COLLECT_SCRIPT,
  WINDOWS_UNINSTALL_SCRIPT,
} from './collect-script';
import type { WindowsFacts } from '../shared/windows-types';
import { parseUninstallKey } from './validate';

const LOCAL_TIMEOUT_MS = 180_000;
const REMOTE_TIMEOUT_MS = 180_000;
const UNINSTALL_TIMEOUT_MS = 180_000;
const POWERSHELL =
  process.env.SystemRoot
    ? `${process.env.SystemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
    : 'powershell.exe';

const PS_VALIDATE_COMPUTER = `
if (
  $ComputerName -notmatch '^(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)$' -and
  -not (
    $ComputerName -match '^[A-Za-z0-9][A-Za-z0-9.-]{0,252}$' -and
    $ComputerName -notmatch '\\.\\.'
  )
) {
  throw 'invalid_host'
}
`.trim();

export function localIPv4Addresses(): string[] {
  const nets = os.networkInterfaces();
  const addresses: string[] = [];

  for (const entries of Object.values(nets)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        addresses.push(entry.address);
      }
    }
  }

  return addresses;
}

export function runLocalWindowsCollect(): Promise<unknown> {
  return runPowerShellEncoded(
    WINDOWS_COLLECT_SCRIPT,
    [],
    LOCAL_TIMEOUT_MS,
    'powershell_failed',
  );
}

export function runRemoteWindowsCollect(
  ipAddress: string,
  credential?: { username: string; password: string },
  hostname?: string | null,
): Promise<unknown> {
  if (ipv4ToInt(ipAddress) === null) {
    return Promise.reject(new Error('invalid_input'));
  }

  const computerName = winRmComputerName(hostname, ipAddress);

  if (WINDOWS_COLLECT_SCRIPT.includes("'@")) {
    return Promise.reject(new Error('powershell_failed'));
  }

  if (!credential) {
    const wrapper = `
$ErrorActionPreference = 'Stop'
$ComputerName = [string]$args[0]
${PS_VALIDATE_COMPUTER}
$inner = @'
${WINDOWS_COLLECT_SCRIPT}
'@
$json = Invoke-Command -ComputerName $ComputerName -ScriptBlock ([scriptblock]::Create($inner))
if ($json -is [string]) {
  [Console]::Out.WriteLine($json)
} else {
  $json | ConvertTo-Json -Compress -Depth 6
}
`.trim();

    return runPowerShellEncoded(
      wrapper,
      [computerName],
      REMOTE_TIMEOUT_MS,
      'winrm_failed',
    );
  }

  const wrapper = `
$ErrorActionPreference = 'Stop'
$ComputerName = [string]$args[0]
$User = [string]$args[1]
${PS_VALIDATE_COMPUTER}
$Password = [Console]::In.ReadToEnd()
$secure = ConvertTo-SecureString -String $Password -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential ($User, $secure)
$inner = @'
${WINDOWS_COLLECT_SCRIPT}
'@
$json = Invoke-Command -ComputerName $ComputerName -Credential $cred -Authentication Negotiate -ScriptBlock ([scriptblock]::Create($inner))
if ($json -is [string]) {
  [Console]::Out.WriteLine($json)
} else {
  $json | ConvertTo-Json -Compress -Depth 6
}
`.trim();

  return runPowerShellEncoded(
    wrapper,
    [computerName, credential.username],
    REMOTE_TIMEOUT_MS,
    'winrm_failed',
    true,
    credential.password,
  );
}

export function runRemoteWindowsUninstall(
  ipAddress: string,
  uninstallKey: string,
  credential?: { username: string; password: string },
  hostname?: string | null,
): Promise<unknown> {
  const key = parseUninstallKey(uninstallKey);

  if (ipv4ToInt(ipAddress) === null || !key) {
    return Promise.reject(new Error('invalid_input'));
  }

  const computerName = winRmComputerName(hostname, ipAddress);

  if (
    WINDOWS_UNINSTALL_SCRIPT.includes("'@") ||
    WINDOWS_COLLECT_SCRIPT.includes("'@")
  ) {
    return Promise.reject(new Error('powershell_failed'));
  }

  if (!credential) {
    const wrapper = `
$ErrorActionPreference = 'Stop'
$ComputerName = [string]$args[0]
$Key = [string]$args[1]
${PS_VALIDATE_COMPUTER}
if ($Key -notmatch '^[A-Za-z0-9._\\-{}]{1,128}$') {
  throw 'invalid_key'
}
$inner = @'
${WINDOWS_UNINSTALL_SCRIPT}
'@
$json = Invoke-Command -ComputerName $ComputerName -ScriptBlock ([scriptblock]::Create($inner)) -ArgumentList $Key
if ($json -is [string]) {
  [Console]::Out.WriteLine($json)
} else {
  $json | ConvertTo-Json -Compress -Depth 6
}
`.trim();

    return runPowerShellEncoded(
      wrapper,
      [computerName, key],
      UNINSTALL_TIMEOUT_MS,
      'winrm_failed',
    );
  }

  const wrapper = `
$ErrorActionPreference = 'Stop'
$ComputerName = [string]$args[0]
$Key = [string]$args[1]
$User = [string]$args[2]
${PS_VALIDATE_COMPUTER}
if ($Key -notmatch '^[A-Za-z0-9._\\-{}]{1,128}$') {
  throw 'invalid_key'
}
$Password = [Console]::In.ReadToEnd()
$secure = ConvertTo-SecureString -String $Password -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential ($User, $secure)
$inner = @'
${WINDOWS_UNINSTALL_SCRIPT}
'@
$json = Invoke-Command -ComputerName $ComputerName -Credential $cred -Authentication Negotiate -ScriptBlock ([scriptblock]::Create($inner)) -ArgumentList $Key
if ($json -is [string]) {
  [Console]::Out.WriteLine($json)
} else {
  $json | ConvertTo-Json -Compress -Depth 6
}
`.trim();

  return runPowerShellEncoded(
    wrapper,
    [computerName, key, credential.username],
    UNINSTALL_TIMEOUT_MS,
    'winrm_failed',
    true,
    credential.password,
  );
}

export function parseWindowsFacts(
  raw: unknown,
  ipAddresses: string[],
): WindowsFacts {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  return {
    hostname: asString(record.hostname),
    ipAddresses,
    operatingSystem: asString(record.operatingSystem),
    osVersion: asString(record.osVersion),
    domain: asString(record.domain),
    cpu: asString(record.cpu),
    ramGb: asNumber(record.ramGb),
    disks: asArray(record.disks).map((item) => ({
      device: asString((item as Record<string, unknown>).device) ?? '',
      sizeGb: asNumber((item as Record<string, unknown>).sizeGb),
      freeGb: asNumber((item as Record<string, unknown>).freeGb),
    })),
    software: asArray(record.software)
      .map((item) => {
        const row = item as Record<string, unknown>;
        return {
          name: asString(row.name) ?? '',
          version: asString(row.version),
          key: parseUninstallKey(row.key),
          canUninstall: asBoolean(row.canUninstall) === true,
        };
      })
      .filter((item) => item.name.length > 0)
      .sort((left, right) => left.name.localeCompare(right.name)),
    updates: asArray(record.updates)
      .map((item) => ({
        id: asString((item as Record<string, unknown>).id) ?? '',
        installedOn: asString((item as Record<string, unknown>).installedOn),
      }))
      .filter((item) => item.id.length > 0)
      .slice(0, 25),
    firewall: asArray(record.firewall).map((item) => ({
      name: asString((item as Record<string, unknown>).name) ?? '',
      enabled: asBoolean((item as Record<string, unknown>).enabled),
    })),
    defenderEnabled: asBoolean(record.defenderEnabled),
    defenderRealtime: asBoolean(record.defenderRealtime),
    bitlocker: asArray(record.bitlocker).map((item) => ({
      mountPoint: asString((item as Record<string, unknown>).mountPoint) ?? '',
      protection: asString((item as Record<string, unknown>).protection),
    })),
  };
}

export function runPowerShellEncoded(
  script: string,
  extraArgs: string[],
  timeoutMs: number,
  failCode: 'powershell_failed' | 'winrm_failed' | 'uninstall_failed',
  hideWindow = true,
  stdin?: string,
): Promise<unknown> {
  const encoded = Buffer.from(script, 'utf16le').toString('base64');

  return new Promise((resolve, reject) => {
    const child = spawn(
      POWERSHELL,
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-EncodedCommand',
        encoded,
        ...extraArgs,
      ],
      { shell: false, windowsHide: hideWindow },
    );

    let stdout = '';

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('timeout'));
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timer);

      if (code !== 0) {
        reject(new Error(failCode));
        return;
      }

      try {
        let parsed: unknown = JSON.parse(stdout.trim());
        if (typeof parsed === 'string') {
          parsed = JSON.parse(parsed);
        }
        resolve(parsed);
      } catch {
        reject(new Error(failCode));
      }
    });

    if (stdin !== undefined) {
      child.stdin.write(stdin, 'utf8');
      child.stdin.end();
    } else {
      child.stdin.end();
    }
  });
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim().slice(0, 256)
    : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
