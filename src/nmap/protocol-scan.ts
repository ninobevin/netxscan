import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseNmapXml } from './parse-xml';
import type { NmapProtocolPayload } from '../shared/nmap-types';

const SCAN_MS = 180_000;

const COMMON_PORTS =
  '21,22,23,25,53,80,110,135,139,143,443,445,993,995,1433,3306,3389,5432,5900,5985,5986,8080,8443';

const NSE_SCRIPTS =
  'ssl-cert,ssl-enum-ciphers,smb-enum-shares,smb-security-mode,ftp-anon,banner';

export function resolveNmapPath(): string | null {
  const dirs = [process.env.ProgramFiles, process.env['ProgramFiles(x86)']];
  for (const dir of dirs) {
    if (!dir) {
      continue;
    }
    const candidate = path.join(dir, 'Nmap', 'nmap.exe');
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return process.platform === 'win32' ? 'nmap.exe' : 'nmap';
}

export function runProtocolScan(
  nmapPath: string,
  ipAddress: string,
  hostname: string,
): Promise<NmapProtocolPayload> {
  const args = [
    '-Pn',
    '-sV',
    '-T4',
    '-p',
    COMMON_PORTS,
    '--script',
    NSE_SCRIPTS,
    '-oX',
    '-',
    '--no-stylesheet',
    ipAddress,
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(nmapPath, args, {
      shell: false,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('scan_failed'));
    }, SCAN_MS);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
      if (stdout.length > 8_000_000) {
        child.kill();
      }
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (error.code === 'ENOENT') {
        reject(new Error('nmap_missing'));
        return;
      }
      reject(new Error('scan_failed'));
    });
    child.on('close', () => {
      clearTimeout(timer);
      if (!stdout.includes('<nmaprun')) {
        reject(new Error('scan_failed'));
        return;
      }
      const notes: string[] = [];
      const trimmedErr = stderr.trim().slice(0, 800);
      if (trimmedErr) {
        notes.push(trimmedErr);
      }
      resolve(parseNmapXml(stdout, hostname, ipAddress, notes));
    });
  });
}
