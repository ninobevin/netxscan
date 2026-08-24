import { spawn } from 'node:child_process';
import { access, readFile, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { NmapHost } from '../shared/scan-types';
import { enrichHostsWithDns } from './hostnames';
import { enrichHostsWithPingA } from './ping-hostname';
import { parseNmapXml } from './parse-xml';

const PING_TIMEOUT_MS = 120_000;
const DISCOVERY_TIMEOUT_MS = 900_000;

const PING_ARGS = ['-sn', '-T3', '--max-retries', '1'] as const;
const DISCOVERY_ARGS = [
  '-sT',
  '-sV',
  '-R',
  '--version-intensity',
  '2',
  '-T3',
  '--max-retries',
  '1',
  '--top-ports',
  '20',
] as const;

const NMAP_CANDIDATES = [
  'nmap',
  'C:\\Program Files (x86)\\Nmap\\nmap.exe',
  'C:\\Program Files\\Nmap\\nmap.exe',
];

export async function resolveNmapPath(): Promise<string | null> {
  for (const candidate of NMAP_CANDIDATES) {
    if (candidate === 'nmap') {
      continue;
    }

    try {
      await access(candidate);
      return candidate;
    } catch {
      // try next
    }
  }

  return 'nmap';
}

export async function runAuthorizedPingScan(
  nmapPath: string,
  target: string,
): Promise<NmapHost[]> {
  const xml = await runNmapXml(nmapPath, [...PING_ARGS], target, PING_TIMEOUT_MS);
  return enrichHostsWithPingA(parseNmapXml(xml));
}

export async function runAuthorizedDiscoveryScan(
  nmapPath: string,
  target: string,
): Promise<NmapHost[]> {
  return runNmap(nmapPath, [...DISCOVERY_ARGS], target, DISCOVERY_TIMEOUT_MS);
}

export const ASSESSMENT_TCP_PORTS =
  '21,23,25,80,110,139,143,389,443,445,1433,3306,3389,5432,5900,5985,6379,8080,9100,27017';

export async function runAuthorizedServiceAssessment(
  nmapPath: string,
  target: string,
): Promise<string> {
  return runNmapXml(
    nmapPath,
    [
      '-sT',
      '-p',
      ASSESSMENT_TCP_PORTS,
      '--script',
      'ssl-cert,ssl-enum-ciphers,smb-protocols,smb2-security-mode',
      '-T3',
      '--max-retries',
      '1',
      '--script-timeout',
      '30s',
    ],
    target,
    240_000,
  );
}

async function runNmap(
  nmapPath: string,
  profileArgs: string[],
  target: string,
  timeoutMs: number,
): Promise<NmapHost[]> {
  const xml = await runNmapXml(nmapPath, profileArgs, target, timeoutMs);
  return enrichHostsWithDns(parseNmapXml(xml));
}

async function runNmapXml(
  nmapPath: string,
  profileArgs: string[],
  target: string,
  timeoutMs: number,
): Promise<string> {
  const outputFile = path.join(
    os.tmpdir(),
    `netxscan-nmap-${Date.now()}.xml`,
  );
  const args = [...profileArgs, '-oX', outputFile, target];

  try {
    await spawnNmap(nmapPath, args, timeoutMs);
    return readFile(outputFile, 'utf8');
  } finally {
    try {
      await unlink(outputFile);
    } catch {
      // temp file may not exist if nmap failed early
    }
  }
}

function spawnNmap(
  nmapPath: string,
  args: string[],
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(nmapPath, args, {
      shell: false,
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('timeout'));
    }, timeoutMs);

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timer);

      if (code === 0 || code === 1) {
        resolve();
        return;
      }

      reject(new Error('scan_failed'));
    });
  });
}
