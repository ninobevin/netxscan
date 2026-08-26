import { spawn } from 'node:child_process';
import { ipv4ToInt } from './authorize';
import { parseDnsHostname } from './hostnames';
import type { ScanHost } from '../shared/scan-types';

const PING_MS = 4_000;
const CONCURRENCY = 24;

export function parsePingAHostname(output: string, ipAddress: string): string | null {
  const match = output.match(
    /Pinging\s+(.+?)\s+\[(\d{1,3}(?:\.\d{1,3}){3})\]/i,
  );

  if (!match?.[1] || match[2] !== ipAddress) {
    return null;
  }

  return parseDnsHostname(match[1]);
}

export function pingReplied(output: string): boolean {
  if (/destination host unreachable|request timed out|transmit failed/i.test(output)) {
    return false;
  }

  return /\bTTL=/i.test(output);
}

export async function pingAddresses(
  ipAddresses: string[],
  onHost?: (host: ScanHost) => Promise<void> | void,
): Promise<ScanHost[]> {
  const hosts: ScanHost[] = ipAddresses.map((ipAddress) => ({
    ipAddress,
    status: 'down',
    hostname: null,
  }));
  let index = 0;

  const workers = Array.from(
    { length: Math.min(CONCURRENCY, Math.max(ipAddresses.length, 1)) },
    async () => {
      while (index < ipAddresses.length) {
        const current = index;
        index += 1;
        const ip = ipAddresses[current];
        if (!ip) {
          continue;
        }
        const host = await pingOne(ip);
        hosts[current] = host;
        if (onHost) {
          await onHost(host);
        }
      }
    },
  );

  await Promise.all(workers);
  return hosts;
}

function pingOne(ipAddress: string): Promise<ScanHost> {
  if (ipv4ToInt(ipAddress) === null) {
    return Promise.resolve({
      ipAddress,
      status: 'down',
      hostname: null,
    });
  }

  const pingPath = process.env.SystemRoot
    ? `${process.env.SystemRoot}\\System32\\ping.exe`
    : 'ping';

  return new Promise((resolve) => {
    const child = spawn(pingPath, ['-a', '-n', '1', '-w', '1000', ipAddress], {
      shell: false,
      windowsHide: true,
    });

    let stdout = '';
    const timer = setTimeout(() => {
      child.kill();
      resolve(fromOutput(ipAddress, stdout));
    }, PING_MS);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });

    child.on('error', () => {
      clearTimeout(timer);
      resolve({ ipAddress, status: 'down', hostname: null });
    });

    child.on('close', () => {
      clearTimeout(timer);
      resolve(fromOutput(ipAddress, stdout));
    });
  });
}

function fromOutput(ipAddress: string, stdout: string): ScanHost {
  const up = pingReplied(stdout);
  return {
    ipAddress,
    status: up ? 'up' : 'down',
    hostname: up ? parsePingAHostname(stdout, ipAddress) : null,
  };
}
