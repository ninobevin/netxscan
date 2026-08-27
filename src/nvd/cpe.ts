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

const VENDOR_STOP = new Set([
  'microsoft',
  'google',
  'mozilla',
  'oracle',
  'adobe',
  'apple',
  'inc',
  'llc',
  'ltd',
  'corp',
  'corporation',
  'the',
  'software',
]);

export function searchKeyword(name: string): string {
  const normalized = normalizeProductName(name);
  const tokens = normalized
    .split(' ')
    .filter((token) => token.length > 1 && !VENDOR_STOP.has(token));
  return tokens.slice(0, 4).join(' ');
}

export type SoftwareFamily = 'vc_redist' | 'visual_studio' | 'unknown';

export function softwareFamily(text: string): SoftwareFamily {
  const t = text
    .toLowerCase()
    .replace(/\+/g, 'plus')
    .replace(/[_-]+/g, ' ');
  const redist = /\bredistributable\b/.test(t) || /\bredist\b/.test(t);
  const studio = /\bvisual studio\b/.test(t) || /\bvisualstudio\b/.test(t);
  const visualC =
    /\bvisual c(\s*plus\s*plus)?\b/.test(t) || /\bvisualcpp\b/.test(t);
  if (redist && (visualC || /\bvisual c\b/.test(t))) {
    return 'vc_redist';
  }
  if (studio && !redist) {
    return 'visual_studio';
  }
  if (visualC && !studio) {
    return 'vc_redist';
  }
  return 'unknown';
}

export function cpeIdentityFits(
  inventoryName: string,
  cpeProduct: string,
  cpeTitle: string,
): boolean {
  const invFamily = softwareFamily(inventoryName);
  const cpeFamily = softwareFamily(`${cpeProduct.replace(/_/g, ' ')} ${cpeTitle}`);
  if (
    invFamily !== 'unknown' &&
    cpeFamily !== 'unknown' &&
    invFamily !== cpeFamily
  ) {
    return false;
  }

  const hay = `${cpeProduct.replace(/_/g, ' ')} ${cpeTitle}`.toLowerCase();
  const distinctive = normalizeProductName(inventoryName)
    .split(' ')
    .filter(
      (token) =>
        token.length >= 5 &&
        !VENDOR_STOP.has(token) &&
        token !== 'visual',
    );
  if (distinctive.length === 0) {
    return invFamily === 'unknown' || invFamily === cpeFamily;
  }
  return distinctive.every((token) => hay.includes(token));
}

function versionKind(value: string): 'year' | 'numeric' | null {
  const parts = parseVersionParts(value);
  if (!parts || parts.length === 0) {
    return null;
  }
  if (parts[0] >= 1990 && parts[0] <= 2100) {
    return 'year';
  }
  return 'numeric';
}

export function versionsComparable(installed: string, bound: string): boolean {
  const left = versionKind(installed);
  const right = versionKind(bound);
  if (!left || !right) {
    return false;
  }
  return left === right;
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
    if (!versionsComparable(installed, bound)) {
      return false;
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

  if (!versionsComparable(installedVersion, parsed.version)) {
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
