const IPV4 =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

export function ipv4ToInt(ip: string): number | null {
  if (!IPV4.test(ip)) {
    return null;
  }

  const parts = ip.split('.').map((part) => Number(part));
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

export function parseCidr(
  value: string,
): { network: number; prefix: number; last: number } | null {
  const trimmed = value.trim();
  const slash = trimmed.indexOf('/');

  if (slash === -1) {
    return null;
  }

  const ip = trimmed.slice(0, slash);
  const prefix = Number(trimmed.slice(slash + 1));
  const base = ipv4ToInt(ip);

  if (base === null || !Number.isInteger(prefix) || prefix < 16 || prefix > 32) {
    return null;
  }

  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  const network = (base & mask) >>> 0;
  const last = (network + (2 ** (32 - prefix) - 1)) >>> 0;

  return { network, prefix, last };
}

export function parseAuthorizedTarget(value: string): string | null {
  const trimmed = value.trim();

  if (IPV4.test(trimmed)) {
    return trimmed;
  }

  if (parseCidr(trimmed)) {
    const slash = trimmed.indexOf('/');
    const ip = trimmed.slice(0, slash);
    const prefix = trimmed.slice(slash);
    return `${ip}${prefix}`;
  }

  return null;
}

export function isTargetAuthorized(target: string, ranges: string[]): boolean {
  const authorized = ranges
    .map(parseCidr)
    .filter((range): range is NonNullable<typeof range> => range !== null);

  if (authorized.length === 0) {
    return false;
  }

  const cidr = parseCidr(target);

  if (cidr) {
    return authorized.some(
      (range) => cidr.network >= range.network && cidr.last <= range.last,
    );
  }

  const ip = ipv4ToInt(target);

  if (ip === null) {
    return false;
  }

  return authorized.some((range) => ip >= range.network && ip <= range.last);
}

export function parseRangeList(value: unknown): string[] | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const ranges = (value as { ranges?: unknown }).ranges;

  if (!Array.isArray(ranges)) {
    return null;
  }

  const parsed: string[] = [];

  for (const item of ranges) {
    if (typeof item !== 'string') {
      return null;
    }

    const cidr = parseCidr(item);

    if (!cidr) {
      return null;
    }

    parsed.push(item.trim());
  }

  return parsed;
}
