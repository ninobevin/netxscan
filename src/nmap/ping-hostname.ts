import { spawn } from 'node:child_process';
import { ipv4ToInt } from './authorize';
import { parseDnsHostname } from './hostnames';
import type { NmapHost } from '../shared/scan-types';

const PING_MS = 4_000;
const CONCURRENCY = 8;

export function parsePingAHostname(output: string, ipAddress: string): string | null {
  const match = output.match(
    /Pinging\s+(.+?)\s+\[(\d{1,3}(?:\.\d{1,3}){3})\]/i,
  );

  if (!match?.[1] || match[2] !== ipAddress) {
    return null;
  }

  return parseDnsHostname(match[1]);
}

export async function enrichHostsWithPingA(
  hosts: NmapHost[],
): Promise<NmapHost[]> {
  const pending = hosts.filter((host) => host.status === 'up');
  let index = 0;

  const workers = Array.from(
    { length: Math.min(CONCURRENCY, pending.length) },
    async () => {
      while (index < pending.length) {
        const host = pending[index];
        index += 1;
        if (!host) {
          continue;
        }

        const name = await pingAHostname(host.ipAddress);
        if (name) {
          host.hostname = name;
        }
      }
    },
  );

  await Promise.all(workers);
  return hosts;
}

function pingAHostname(ipAddress: string): Promise<string | null> {
  if (ipv4ToInt(ipAddress) === null) {
    return Promise.resolve(null);
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
      resolve(parsePingAHostname(stdout, ipAddress));
    }, PING_MS);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });

    child.on('error', () => {
      clearTimeout(timer);
      resolve(null);
    });

    child.on('close', () => {
      clearTimeout(timer);
      resolve(parsePingAHostname(stdout, ipAddress));
    });
  });
}
