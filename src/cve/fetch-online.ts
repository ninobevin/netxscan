import type { ParsedCve } from './parse-cve';

const ONLINE_CVE_IDS = [
  'CVE-2014-0160',
  'CVE-2017-0144',
  'CVE-2021-34527',
  'CVE-2021-44228',
] as const;

const FETCH_TIMEOUT_MS = 20_000;

export async function fetchOnlineTestCves(): Promise<ParsedCve[]> {
  const cves: ParsedCve[] = [];

  for (const id of ONLINE_CVE_IDS) {
    const parsed = await fetchOne(id);
    if (parsed) {
      cves.push(parsed);
    }
  }

  if (cves.length === 0) {
    throw new Error('network_unavailable');
  }

  return cves;
}

async function fetchOne(id: string): Promise<ParsedCve | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://cveawg.mitre.org/api/cve/${id}`,
      {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      },
    );

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as unknown;
    return fromMitre(id, body);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function fromMitre(id: string, body: unknown): ParsedCve | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const cna = (body as { containers?: { cna?: Record<string, unknown> } })
    .containers?.cna;
  if (!cna) {
    return null;
  }

  const descriptions = cna.descriptions;
  let description = '';
  if (Array.isArray(descriptions)) {
    const english = descriptions.find(
      (item) =>
        item &&
        typeof item === 'object' &&
        (item as { lang?: string }).lang === 'en',
    ) as { value?: string } | undefined;
    description = typeof english?.value === 'string' ? english.value : '';
  }

  const titleRaw = cna.title;
  const title =
    typeof titleRaw === 'string' && titleRaw.trim().length > 0
      ? titleRaw.trim()
      : description.slice(0, 120) || id;

  const products: string[] = [];
  const affected = cna.affected;
  if (Array.isArray(affected)) {
    for (const item of affected) {
      const product =
        item && typeof item === 'object'
          ? (item as { product?: unknown }).product
          : null;
      if (typeof product === 'string') {
        const token = product.trim().toLowerCase().slice(0, 64);
        if (/^[a-z0-9][a-z0-9._-]*$/.test(token) && !products.includes(token)) {
          products.push(token);
        }
      }
    }
  }

  const { severity, cvss } = parseMetrics(cna.metrics);
  const published = parseMitreDate(
    (body as { cveMetadata?: { datePublished?: unknown } }).cveMetadata
      ?.datePublished,
  );

  if (description.trim().length === 0) {
    return null;
  }

  return {
    id,
    title: title.slice(0, 512),
    description: description.trim().slice(0, 4000),
    severity,
    cvss,
    published,
    products: products.slice(0, 20),
  };
}

function parseMetrics(metrics: unknown): {
  severity: ParsedCve['severity'];
  cvss: number | null;
} {
  if (!Array.isArray(metrics) || metrics.length === 0) {
    return { severity: 'none', cvss: null };
  }

  for (const item of metrics) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const cvssData =
      (item as { cvssV3_1?: { baseScore?: unknown; baseSeverity?: unknown } })
        .cvssV3_1 ??
      (item as { cvssV3_0?: { baseScore?: unknown; baseSeverity?: unknown } })
        .cvssV3_0;

    if (!cvssData) {
      continue;
    }

    const score =
      typeof cvssData.baseScore === 'number' ? cvssData.baseScore : null;
    const raw =
      typeof cvssData.baseSeverity === 'string'
        ? cvssData.baseSeverity.toLowerCase()
        : '';
    const severity =
      raw === 'critical' ||
      raw === 'high' ||
      raw === 'medium' ||
      raw === 'low' ||
      raw === 'none'
        ? raw
        : scoreToSeverity(score);

    return { severity, cvss: score };
  }

  return { severity: 'none', cvss: null };
}

function scoreToSeverity(score: number | null): ParsedCve['severity'] {
  if (score === null) {
    return 'none';
  }

  if (score >= 9) {
    return 'critical';
  }

  if (score >= 7) {
    return 'high';
  }

  if (score >= 4) {
    return 'medium';
  }

  if (score > 0) {
    return 'low';
  }

  return 'none';
}

function parseMitreDate(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  return value.trim().slice(0, 32);
}
