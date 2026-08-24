import { reverse } from 'node:dns/promises';
import { ipv4ToInt } from './authorize';
import type { NmapHost } from '../shared/scan-types';

const DNS_NAME =
  /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/;
const LOOKUP_MS = 2_000;
const LOOKUP_CONCURRENCY = 8;

export function parseDnsHostname(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const name = value.trim().replace(/\.$/, '');

  if (name.length < 1 || name.length > 253) {
    return null;
  }

  if (ipv4ToInt(name) !== null) {
    return null;
  }

  if (name.includes('..') || !DNS_NAME.test(name)) {
    return null;
  }

  return name;
}

export function winRmComputerName(
  hostname: string | null | undefined,
  ipAddress: string,
): string {
  return parseDnsHostname(hostname) ?? ipAddress;
}

export async function enrichHostsWithDns(hosts: NmapHost[]): Promise<NmapHost[]> {
  const pending = hosts.filter(
    (host) => host.status === 'up' && !parseDnsHostname(host.hostname),
  );

  let index = 0;

  const workers = Array.from(
    { length: Math.min(LOOKUP_CONCURRENCY, Math.max(pending.length, 0)) },
    async () => {
      while (index < pending.length) {
        const host = pending[index];
        index += 1;
        if (!host) {
          continue;
        }

        const name = await reverseDnsName(host.ipAddress);
        if (name) {
          host.hostname = name;
        }
      }
    },
  );

  await Promise.all(workers);
  return hosts;
}

async function reverseDnsName(ip: string): Promise<string | null> {
  try {
    const names = await Promise.race([
      reverse(ip),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), LOOKUP_MS);
      }),
    ]);
    return parseDnsHostname(names[0] ?? null);
  } catch {
    return null;
  }
}
