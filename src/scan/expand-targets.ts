function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    return null;
  }

  let value = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) {
      return null;
    }
    const octet = Number(part);
    if (octet < 0 || octet > 255) {
      return null;
    }
    value = (value << 8) + octet;
  }

  return value >>> 0;
}

function intToIpv4(value: number): string {
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ].join('.');
}

const MAX_TARGETS = 1024;

export type ScanTarget =
  | { kind: 'ipv4'; ips: string[] }
  | { kind: 'hostname'; host: string };

export function expandScanTarget(input: string): ScanTarget | { error: string } {
  const raw = input.trim();
  if (!raw) {
    return { error: 'Enter an IP, hostname, CIDR, or range.' };
  }

  const rangeMatch = raw.match(
    /^(\d{1,3}(?:\.\d{1,3}){3})\s*[-–]\s*(\d{1,3}(?:\.\d{1,3}){3})$/,
  );
  if (rangeMatch) {
    const start = ipv4ToInt(rangeMatch[1]);
    const end = ipv4ToInt(rangeMatch[2]);
    if (start === null || end === null || end < start) {
      return { error: 'Invalid IP range.' };
    }
    if (end - start + 1 > MAX_TARGETS) {
      return { error: `Range is larger than ${MAX_TARGETS} addresses.` };
    }
    const ips: string[] = [];
    for (let value = start; value <= end; value += 1) {
      ips.push(intToIpv4(value));
    }
    return { kind: 'ipv4', ips };
  }

  const cidrMatch = raw.match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/);
  if (cidrMatch) {
    const base = ipv4ToInt(cidrMatch[1]);
    const prefix = Number(cidrMatch[2]);
    if (base === null || prefix < 16 || prefix > 32) {
      return { error: 'CIDR must use prefix /16 to /32.' };
    }
    const size = 2 ** (32 - prefix);
    if (size > MAX_TARGETS) {
      return { error: `CIDR is larger than ${MAX_TARGETS} addresses.` };
    }
    const mask = size - 1;
    const network = (base >>> 0) & ~mask;
    const ips: string[] = [];
    for (let i = 0; i < size; i += 1) {
      ips.push(intToIpv4(network + i));
    }
    return { kind: 'ipv4', ips };
  }

  if (ipv4ToInt(raw) !== null) {
    return { kind: 'ipv4', ips: [raw] };
  }

  if (/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(raw)) {
    return { kind: 'hostname', host: raw };
  }

  return { error: 'Enter an IP, hostname, CIDR, or range.' };
}
