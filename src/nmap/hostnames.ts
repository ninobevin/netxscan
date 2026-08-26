import { ipv4ToInt } from './authorize';

const DNS_NAME =
  /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/;

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

  if (name.includes("'") || name.includes('"') || name.includes('\\')) {
    return null;
  }

  return name;
}
