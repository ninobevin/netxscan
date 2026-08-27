export function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(x64|x86|64-bit|32-bit|win64|win32)\b/g, ' ')
    .replace(/\b\d+(\.\d+){1,4}\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .slice(0, 80);
}

export function searchKeyword(name: string): string {
  const normalized = normalizeProductName(name);
  const tokens = normalized.split(' ').filter((token) => token.length > 1);
  return tokens.slice(0, 3).join(' ');
}

export function parseCpe23(value: string): {
  part: string;
  vendor: string;
  product: string;
  version: string;
} | null {
  const parts = value.split(':');
  if (parts.length < 6 || parts[0] !== 'cpe' || parts[1] !== '2.3') {
    return null;
  }
  return {
    part: parts[2] ?? '',
    vendor: (parts[3] ?? '').toLowerCase(),
    product: (parts[4] ?? '').toLowerCase(),
    version: parts[5] ?? '*',
  };
}

export function cpeProductPrefix(cpe23: string): string | null {
  const parsed = parseCpe23(cpe23);
  if (!parsed || parsed.part !== 'a' || !parsed.vendor || !parsed.product) {
    return null;
  }
  return `cpe:2.3:a:${parsed.vendor}:${parsed.product}`;
}

export function parseVersionParts(value: string): number[] | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '*' || trimmed === '-') {
    return null;
  }
  const parts = trimmed.split(/[^\d]+/).filter((part) => part.length > 0);
  if (parts.length === 0) {
    return null;
  }
  return parts.map((part) => Number(part)).filter((part) => Number.isFinite(part));
}

export function compareVersions(left: string, right: string): number | null {
  const a = parseVersionParts(left);
  const b = parseVersionParts(right);
  if (!a || !b) {
    return null;
  }
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av > bv) {
      return 1;
    }
    if (av < bv) {
      return -1;
    }
  }
  return 0;
}

export function versionInRange(
  installed: string,
  range: {
    versionStartIncluding?: string;
    versionStartExcluding?: string;
    versionEndIncluding?: string;
    versionEndExcluding?: string;
  },
): boolean {
  const checks: Array<[string | undefined, (cmp: number) => boolean]> = [
    [range.versionStartIncluding, (cmp) => cmp >= 0],
    [range.versionStartExcluding, (cmp) => cmp > 0],
    [range.versionEndIncluding, (cmp) => cmp <= 0],
    [range.versionEndExcluding, (cmp) => cmp < 0],
  ];
  let any = false;
  for (const [bound, ok] of checks) {
    if (!bound) {
      continue;
    }
    any = true;
    const cmp = compareVersions(installed, bound);
    if (cmp === null || !ok(cmp)) {
      return false;
    }
  }
  return any;
}

export type MatchableCpe = {
  criteria: string;
  vulnerable: boolean;
  versionStartIncluding?: string;
  versionStartExcluding?: string;
  versionEndIncluding?: string;
  versionEndExcluding?: string;
};

export function cpeAppliesToInstalled(
  installedVersion: string,
  vendor: string,
  product: string,
  match: MatchableCpe,
): boolean {
  if (!match.vulnerable) {
    return false;
  }
  const parsed = parseCpe23(match.criteria);
  if (
    !parsed ||
    parsed.part !== 'a' ||
    parsed.vendor !== vendor ||
    parsed.product !== product
  ) {
    return false;
  }

  const hasRange = Boolean(
    match.versionStartIncluding ||
      match.versionStartExcluding ||
      match.versionEndIncluding ||
      match.versionEndExcluding,
  );
  if (hasRange) {
    return versionInRange(installedVersion, match);
  }

  if (!parsed.version || parsed.version === '*' || parsed.version === '-') {
    return false;
  }

  return compareVersions(installedVersion, parsed.version) === 0;
}

export function skipSoftwareInventory(name: string): boolean {
  const lower = name.toLowerCase();
  if (lower.length < 3) {
    return true;
  }
  if (/\bkb\d{5,}\b/i.test(name)) {
    return true;
  }
  if (
    /^update for /i.test(name) ||
    /security update/i.test(name) ||
    /hotfix/i.test(name)
  ) {
    return true;
  }
  if (/^microsoft windows(\s|$)/i.test(name)) {
    return true;
  }
  return false;
}
