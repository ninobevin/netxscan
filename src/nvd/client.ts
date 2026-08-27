import { getNvdApiKey } from './settings';

const CPE_URL = 'https://services.nvd.nist.gov/rest/json/cpes/2.0';
const CVE_URL = 'https://services.nvd.nist.gov/rest/json/cves/2.0';

export class NvdHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'NvdHttpError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

let lastRequestAt = 0;

async function throttle(hasKey: boolean): Promise<void> {
  const minGap = hasKey ? 700 : 6500;
  const wait = lastRequestAt + minGap - Date.now();
  if (wait > 0) {
    await sleep(wait);
  }
  lastRequestAt = Date.now();
}

async function nvdGet(url: string): Promise<unknown> {
  const apiKey = await getNvdApiKey();
  await throttle(Boolean(apiKey));
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'NetXScan/1.0',
  };
  if (apiKey) {
    headers.apiKey = apiKey;
  }

  const response = await fetch(url, { headers });
  if (response.status === 429) {
    const retry = Number(response.headers.get('retry-after')) || 30;
    await sleep(Math.min(retry, 60) * 1000);
    const again = await fetch(url, { headers });
    if (!again.ok) {
      throw new NvdHttpError(`NVD HTTP ${again.status}`, again.status);
    }
    return again.json();
  }
  if (!response.ok) {
    throw new NvdHttpError(`NVD HTTP ${response.status}`, response.status);
  }
  return response.json();
}

export type NvdCpeHit = {
  cpeName: string;
  title: string;
  deprecated: boolean;
};

export async function searchCpes(keyword: string): Promise<NvdCpeHit[]> {
  const query = new URL(CPE_URL);
  query.searchParams.set('keywordSearch', keyword.slice(0, 80));
  query.searchParams.set('resultsPerPage', '8');
  const body = (await nvdGet(query.toString())) as {
    products?: Array<{
      cpe?: {
        cpeName?: string;
        deprecated?: boolean;
        titles?: Array<{ title?: string; lang?: string }>;
      };
    }>;
  };
  const hits: NvdCpeHit[] = [];
  for (const item of body.products ?? []) {
    const cpe = item.cpe;
    if (!cpe?.cpeName) {
      continue;
    }
    const en = cpe.titles?.find((title) => title.lang === 'en');
    hits.push({
      cpeName: cpe.cpeName,
      title: en?.title ?? cpe.titles?.[0]?.title ?? cpe.cpeName,
      deprecated: cpe.deprecated === true,
    });
  }
  return hits;
}

export type NvdCveHit = {
  cveId: string;
  description: string;
  cvss: number | null;
  severity: string;
  matches: Array<{
    criteria: string;
    vulnerable: boolean;
    versionStartIncluding?: string;
    versionStartExcluding?: string;
    versionEndIncluding?: string;
    versionEndExcluding?: string;
  }>;
};

function metricScore(cve: {
  metrics?: {
    cvssMetricV31?: Array<{
      cvssData?: { baseScore?: number; baseSeverity?: string };
    }>;
    cvssMetricV30?: Array<{
      cvssData?: { baseScore?: number; baseSeverity?: string };
    }>;
    cvssMetricV2?: Array<{
      cvssData?: { baseScore?: number };
      baseSeverity?: string;
    }>;
  };
}): { cvss: number | null; severity: string } {
  const v31 = cve.metrics?.cvssMetricV31?.[0]?.cvssData;
  if (v31?.baseScore != null) {
    return {
      cvss: v31.baseScore,
      severity: (v31.baseSeverity ?? 'UNKNOWN').toUpperCase(),
    };
  }
  const v30 = cve.metrics?.cvssMetricV30?.[0]?.cvssData;
  if (v30?.baseScore != null) {
    return {
      cvss: v30.baseScore,
      severity: (v30.baseSeverity ?? 'UNKNOWN').toUpperCase(),
    };
  }
  const v2 = cve.metrics?.cvssMetricV2?.[0];
  if (v2?.cvssData?.baseScore != null) {
    return {
      cvss: v2.cvssData.baseScore,
      severity: (v2.baseSeverity ?? 'UNKNOWN').toUpperCase(),
    };
  }
  return { cvss: null, severity: 'UNKNOWN' };
}

export async function fetchCvesForPrefix(prefix: string): Promise<NvdCveHit[]> {
  const out: NvdCveHit[] = [];
  let startIndex = 0;
  const page = 50;
  for (let round = 0; round < 4; round += 1) {
    const query = new URL(CVE_URL);
    query.searchParams.set('virtualMatchString', prefix);
    query.searchParams.set('resultsPerPage', String(page));
    query.searchParams.set('startIndex', String(startIndex));
    const body = (await nvdGet(query.toString())) as {
      totalResults?: number;
      vulnerabilities?: Array<{
        cve?: {
          id?: string;
          descriptions?: Array<{ lang?: string; value?: string }>;
          metrics?: {
            cvssMetricV31?: Array<{
              cvssData?: { baseScore?: number; baseSeverity?: string };
            }>;
            cvssMetricV30?: Array<{
              cvssData?: { baseScore?: number; baseSeverity?: string };
            }>;
            cvssMetricV2?: Array<{
              cvssData?: { baseScore?: number };
              baseSeverity?: string;
            }>;
          };
          configurations?: Array<{
            nodes?: Array<{
              cpeMatch?: Array<{
                criteria?: string;
                vulnerable?: boolean;
                versionStartIncluding?: string;
                versionStartExcluding?: string;
                versionEndIncluding?: string;
                versionEndExcluding?: string;
              }>;
            }>;
          }>;
        };
      }>;
    };
    const rows = body.vulnerabilities ?? [];
    for (const row of rows) {
      const cve = row.cve;
      if (!cve?.id) {
        continue;
      }
      const en = cve.descriptions?.find((item) => item.lang === 'en');
      const { cvss, severity } = metricScore(cve);
      const matches: NvdCveHit['matches'] = [];
      for (const config of cve.configurations ?? []) {
        for (const node of config.nodes ?? []) {
          for (const match of node.cpeMatch ?? []) {
            if (!match.criteria) {
              continue;
            }
            matches.push({
              criteria: match.criteria,
              vulnerable: match.vulnerable !== false,
              versionStartIncluding: match.versionStartIncluding,
              versionStartExcluding: match.versionStartExcluding,
              versionEndIncluding: match.versionEndIncluding,
              versionEndExcluding: match.versionEndExcluding,
            });
          }
        }
      }
      out.push({
        cveId: cve.id,
        description: (en?.value ?? '').slice(0, 2000),
        cvss,
        severity,
        matches,
      });
    }
    startIndex += rows.length;
    if (rows.length < page || startIndex >= (body.totalResults ?? 0)) {
      break;
    }
  }
  return out;
}
