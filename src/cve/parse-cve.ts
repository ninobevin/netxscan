import type { CveRecord, CveSeverity, CveSource } from '../shared/cve-types';

const CVE_ID = /^CVE-[0-9]{4}-[0-9]{4,}$/;
const SEVERITIES: CveSeverity[] = [
  'none',
  'low',
  'medium',
  'high',
  'critical',
];

export type ParsedCve = Omit<CveRecord, 'source' | 'importedAt'>;

export function parseCveSearch(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, 64);
}

export function parseCveDocument(
  value: unknown,
): { ok: true; cves: ParsedCve[] } | { ok: false } {
  if (!value || typeof value !== 'object') {
    return { ok: false };
  }

  const cves = (value as { cves?: unknown }).cves;

  if (!Array.isArray(cves) || cves.length === 0 || cves.length > 500) {
    return { ok: false };
  }

  const parsed: ParsedCve[] = [];

  for (const item of cves) {
    const record = parseOne(item);
    if (!record) {
      return { ok: false };
    }

    parsed.push(record);
  }

  return { ok: true, cves: parsed };
}

function parseOne(value: unknown): ParsedCve | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id.trim().toUpperCase() : '';
  const title = asText(record.title, 512);
  const description = asText(record.description, 4000);
  const severity = parseSeverity(record.severity);
  const cvss = parseCvss(record.cvss);
  const published = parsePublished(record.published);
  const products = parseProducts(record.products);

  if (!CVE_ID.test(id) || !title || !description || !severity) {
    return null;
  }

  return { id, title, description, severity, cvss, published, products };
}

function parseSeverity(value: unknown): CveSeverity | null {
  return typeof value === 'string' && SEVERITIES.includes(value as CveSeverity)
    ? (value as CveSeverity)
    : null;
}

function parseCvss(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const score = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(score) || score < 0 || score > 10) {
    return null;
  }

  return Math.round(score * 10) / 10;
}

function parsePublished(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  return value.trim().slice(0, 32);
}

function parseProducts(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const products: string[] = [];

  for (const item of value) {
    if (typeof item !== 'string') {
      continue;
    }

    const token = item.trim().toLowerCase().slice(0, 64);
    if (/^[a-z0-9][a-z0-9._-]*$/.test(token) && !products.includes(token)) {
      products.push(token);
    }
  }

  return products.slice(0, 20);
}

function asText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const text = value.trim();
  if (text.length === 0) {
    return null;
  }

  return text.slice(0, max);
}

export function withSource(
  cves: ParsedCve[],
  source: CveSource,
  importedAt: string,
): CveRecord[] {
  return cves.map((cve) => ({ ...cve, source, importedAt }));
}
