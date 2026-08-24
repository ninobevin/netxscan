import path from 'node:path';
import { spawn } from 'node:child_process';
import { WINDOWS_UNINSTALL_LOOKUP_SCRIPT } from './collect-script';
import { runPowerShellEncoded } from './collect';
import { parseUninstallKey } from './validate';

const UNINSTALL_TIMEOUT_MS = 180_000;
const SUCCESS_CODES = new Set([0, 3010, 1605, 1641]);
const GUID =
  /^\{[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\}$/;
const GUID_IN_TEXT =
  /\{[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\}/;
const BLOCKED_EXES = new Set([
  'cmd.exe',
  'powershell.exe',
  'pwsh.exe',
  'wscript.exe',
  'cscript.exe',
  'mshta.exe',
]);

type UninstallLookup = {
  windowsInstaller: boolean;
  quiet: string | null;
  uninstall: string | null;
};

type SpawnPlan = {
  exe: string;
  args: string[];
};

export async function runLocalWindowsUninstall(
  uninstallKey: string,
): Promise<void> {
  const key = parseUninstallKey(uninstallKey);

  if (!key) {
    throw new Error('invalid_input');
  }

  const info = await lookupUninstallEntry(key);
  const plan = planSilentUninstall(key, info);

  if (!plan) {
    throw new Error('uninstall_unsupported');
  }

  const code = await spawnAndWait(plan.exe, plan.args, UNINSTALL_TIMEOUT_MS);

  if (code === null) {
    throw new Error('timeout');
  }

  if (!SUCCESS_CODES.has(code)) {
    throw new Error(`uninstall_failed:${code}`);
  }
}

async function lookupUninstallEntry(key: string): Promise<UninstallLookup> {
  const raw = await runPowerShellEncoded(
    WINDOWS_UNINSTALL_LOOKUP_SCRIPT,
    [key],
    30_000,
    'uninstall_failed',
  );
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  return {
    windowsInstaller: record.windowsInstaller === true,
    quiet: asLine(record.quiet),
    uninstall: asLine(record.uninstall),
  };
}

export function planSilentUninstall(
  key: string,
  info: UninstallLookup,
): SpawnPlan | null {
  const msiexec = path.join(
    process.env.SystemRoot ?? 'C:\\Windows',
    'System32',
    'msiexec.exe',
  );
  const product =
    (GUID.test(key) ? key : null) ??
    guidFrom(info.quiet) ??
    guidFrom(info.uninstall);

  if (info.windowsInstaller || GUID.test(key)) {
    if (!product) {
      return null;
    }

    return { exe: msiexec, args: ['/x', product, '/qn', '/norestart'] };
  }

  if (info.quiet && /msiexec/i.test(info.quiet)) {
    const guid = guidFrom(info.quiet);
    if (!guid) {
      return null;
    }

    return { exe: msiexec, args: ['/x', guid, '/qn', '/norestart'] };
  }

  if (info.quiet) {
    return parseExeCommand(info.quiet);
  }

  if (info.uninstall && /msiexec/i.test(info.uninstall) && /\/[Xx]/.test(info.uninstall)) {
    const guid = guidFrom(info.uninstall);
    if (!guid) {
      return null;
    }

    return { exe: msiexec, args: ['/x', guid, '/qn', '/norestart'] };
  }

  return null;
}

function guidFrom(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const match = value.match(GUID_IN_TEXT);
  return match ? match[0] : null;
}

function parseExeCommand(line: string): SpawnPlan | null {
  const quoted = line.match(/^"([^"]+\.exe)"\s*(.*)$/i);
  const unquoted = line.match(/^([a-zA-Z]:\\[^\s]+\.exe)\s*(.*)$/i);
  const match = quoted ?? unquoted;

  if (!match) {
    return null;
  }

  const exe = path.normalize(match[1]);
  const rest = match[2]?.trim() ?? '';

  if (
    !path.isAbsolute(exe) ||
    exe.includes('..') ||
    BLOCKED_EXES.has(path.basename(exe).toLowerCase())
  ) {
    return null;
  }

  return { exe, args: rest.length > 0 ? tokenizeArgs(rest) : [] };
}

function tokenizeArgs(value: string): string[] {
  const tokens: string[] = [];
  const matcher = /"([^"]*)"|[^\s]+/g;
  let part = matcher.exec(value);

  while (part) {
    tokens.push(part[1] ?? part[0]);
    part = matcher.exec(value);
  }

  return tokens;
}

function spawnAndWait(
  exe: string,
  args: string[],
  timeoutMs: number,
): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { shell: false, windowsHide: true });

    const timer = setTimeout(() => {
      child.kill();
      resolve(null);
    }, timeoutMs);

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

function asLine(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim().slice(0, 1024)
    : null;
}
