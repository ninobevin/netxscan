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

export function intToIpv4(value: number): string {
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ].join('.');
}

export function expandTargetToHostIps(target: string): string[] | null {
  if (IPV4.test(target)) {
    return [target];
  }

  const dash = parseDashRange(target);
  if (dash) {
    const ips: string[] = [];
    for (let value = dash.first; value <= dash.last; value += 1) {
      ips.push(intToIpv4(value >>> 0));
    }
    return ips;
  }

  const cidr = parseCidr(target);
  if (!cidr) {
    return null;
  }

  const ips: string[] = [];
  let first = cidr.network;
  let last = cidr.last;

  if (cidr.prefix <= 30) {
    first += 1;
    last -= 1;
  }

  for (let value = first; value <= last; value += 1) {
    ips.push(intToIpv4(value >>> 0));
  }

  return ips;
}

export function parseDashRange(
  value: string,
): { first: number; last: number } | null {
  const parts = value.trim().split(/\s*-\s*/);
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }

  const first = ipv4ToInt(parts[0]);
  const last = ipv4ToInt(parts[1]);
  if (first === null || last === null || last < first) {
    return null;
  }

  if (last - first > 65_534) {
    return null;
  }

  return { first, last };
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

  const dash = parseDashRange(trimmed);
  if (dash) {
    return `${intToIpv4(dash.first)}-${intToIpv4(dash.last)}`;
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

  const dash = parseDashRange(target);
  if (dash) {
    for (let ip = dash.first; ip <= dash.last; ip += 1) {
      const allowed = authorized.some(
        (range) => ip >= range.network && ip <= range.last,
      );
      if (!allowed) {
        return false;
      }
    }
    return true;
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
