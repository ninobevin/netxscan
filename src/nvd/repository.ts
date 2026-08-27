import { getDb } from '../db/client';
import type { SoftwareCveHit } from '../shared/nvd-types';
import type { NvdCveHit } from './client';
import { cpeProductPrefix, parseCpe23 } from './cpe';

export async function setNvdMeta(key: string, value: string): Promise<void> {
  const db = getDb();
  await db.query(`DELETE FROM nvd_meta WHERE name = :key`, { key });
  await db.query(`INSERT INTO nvd_meta (name, value) VALUES (:key, :value)`, {
    key,
    value,
  });
}

export async function getNvdMeta(key: string): Promise<string | null> {
  const db = getDb();
  const [rows] = await db.query(
    `SELECT value FROM nvd_meta WHERE name = :key`,
    { key },
  );
  const row = (rows as Array<{ value: string }>)[0];
  return row?.value ?? null;
}

export async function countNvdRows(): Promise<{ cpes: number; cves: number }> {
  const db = getDb();
  const [cpeRows] = await db.query(`SELECT COUNT(*) AS n FROM cpe_cache`);
  const [cveRows] = await db.query(`SELECT COUNT(*) AS n FROM nvd_cves`);
  const cpes = Number((cpeRows as Array<{ n: number }>)[0]?.n ?? 0);
  const cves = Number((cveRows as Array<{ n: number }>)[0]?.n ?? 0);
  return { cpes, cves };
}

export async function upsertCpeCache(row: {
  keyword: string;
  cpe23: string;
  cpePrefix: string;
  title: string;
  vendor: string;
  product: string;
}): Promise<void> {
  const db = getDb();
  await db.query(`DELETE FROM cpe_cache WHERE keyword = :keyword`, {
    keyword: row.keyword,
  });
  await db.query(
    `INSERT INTO cpe_cache (keyword, cpe23, cpe_prefix, title, vendor, product)
     VALUES (:keyword, :cpe23, :cpePrefix, :title, :vendor, :product)`,
    row,
  );
}

export async function getCpeByKeyword(keyword: string): Promise<{
  cpe23: string;
  cpePrefix: string;
  vendor: string;
  product: string;
} | null> {
  const db = getDb();
  const [rows] = await db.query(
    `SELECT cpe23, cpe_prefix, vendor, product FROM cpe_cache WHERE keyword = :keyword`,
    { keyword },
  );
  const row = (
    rows as Array<{
      cpe23: string;
      cpe_prefix: string;
      vendor: string;
      product: string;
    }>
  )[0];
  if (!row) {
    return null;
  }
  return {
    cpe23: row.cpe23,
    cpePrefix: row.cpe_prefix,
    vendor: row.vendor,
    product: row.product,
  };
}

export async function listCpePrefixes(): Promise<string[]> {
  const db = getDb();
  const [rows] = await db.query(
    `SELECT DISTINCT cpe_prefix FROM cpe_cache WHERE cpe_prefix IS NOT NULL`,
  );
  return (rows as Array<{ cpe_prefix: string }>).map((row) => row.cpe_prefix);
}

export async function upsertNvdCve(cve: NvdCveHit): Promise<void> {
  const db = getDb();
  await db.query(`DELETE FROM nvd_cve_matches WHERE cve_id = :cveId`, {
    cveId: cve.cveId,
  });
  await db.query(`DELETE FROM nvd_cves WHERE cve_id = :cveId`, {
    cveId: cve.cveId,
  });
  await db.query(
    `INSERT INTO nvd_cves (cve_id, description, severity, cvss_score)
     VALUES (:cveId, :description, :severity, :cvss)`,
    {
      cveId: cve.cveId,
      description: cve.description.slice(0, 2000),
      severity: cve.severity.slice(0, 16),
      cvss: cve.cvss,
    },
  );
  for (const match of cve.matches) {
    const parsed = parseCpe23(match.criteria);
    const prefix = cpeProductPrefix(match.criteria);
    if (!parsed || !prefix || parsed.part !== 'a') {
      continue;
    }
    await db.query(
      `INSERT INTO nvd_cve_matches (
        cve_id, vendor, product, criteria, vulnerable,
        version_start_inc, version_start_exc, version_end_inc, version_end_exc
      ) VALUES (
        :cveId, :vendor, :product, :criteria, :vulnerable,
        :startInc, :startExc, :endInc, :endExc
      )`,
      {
        cveId: cve.cveId,
        vendor: parsed.vendor.slice(0, 80),
        product: parsed.product.slice(0, 80),
        criteria: match.criteria.slice(0, 255),
        vulnerable: match.vulnerable ? 1 : 0,
        startInc: match.versionStartIncluding ?? null,
        startExc: match.versionStartExcluding ?? null,
        endInc: match.versionEndIncluding ?? null,
        endExc: match.versionEndExcluding ?? null,
      },
    );
  }
}

export async function listMatchesForProduct(
  vendor: string,
  product: string,
): Promise<
  Array<{
    cveId: string;
    description: string;
    severity: string;
    cvss: number | null;
    criteria: string;
    vulnerable: boolean;
    versionStartIncluding?: string;
    versionStartExcluding?: string;
    versionEndIncluding?: string;
    versionEndExcluding?: string;
  }>
> {
  const db = getDb();
  const [rows] = await db.query(
    `SELECT c.cve_id, c.description, c.severity, c.cvss_score,
            m.criteria, m.vulnerable, m.version_start_inc, m.version_start_exc,
            m.version_end_inc, m.version_end_exc
     FROM nvd_cve_matches m
     JOIN nvd_cves c ON c.cve_id = m.cve_id
     WHERE m.vendor = :vendor AND m.product = :product`,
    { vendor, product },
  );
  return (
    rows as Array<{
      cve_id: string;
      description: string;
      severity: string;
      cvss_score: number | string | null;
      criteria: string;
      vulnerable: number | boolean;
      version_start_inc: string | null;
      version_start_exc: string | null;
      version_end_inc: string | null;
      version_end_exc: string | null;
    }>
  ).map((row) => ({
    cveId: row.cve_id,
    description: row.description,
    severity: row.severity,
    cvss:
      row.cvss_score === null || row.cvss_score === undefined
        ? null
        : Number(row.cvss_score),
    criteria: row.criteria,
    vulnerable: Number(row.vulnerable) === 1 || row.vulnerable === true,
    versionStartIncluding: row.version_start_inc ?? undefined,
    versionStartExcluding: row.version_start_exc ?? undefined,
    versionEndIncluding: row.version_end_inc ?? undefined,
    versionEndExcluding: row.version_end_exc ?? undefined,
  }));
}

export async function replaceSoftwareHits(
  assetId: string,
  hits: SoftwareCveHit[],
): Promise<void> {
  const db = getDb();
  await db.query(`DELETE FROM software_cve_hits WHERE asset_id = :assetId`, {
    assetId,
  });
  for (const hit of hits) {
    await db.query(
      `INSERT INTO software_cve_hits (
        asset_id, product_name, product_version, cve_id, cvss_score, severity, cpe23, detail
      ) VALUES (
        :assetId, :productName, :productVersion, :cveId, :cvss, :severity, :cpe23, :detail
      )`,
      {
        assetId,
        productName: hit.productName.slice(0, 191),
        productVersion: hit.productVersion.slice(0, 64),
        cveId: hit.cveId.slice(0, 32),
        cvss: hit.cvss,
        severity: hit.severity.slice(0, 16),
        cpe23: hit.cpe23.slice(0, 255),
        detail: hit.detail.slice(0, 500),
      },
    );
  }
}

export async function listSoftwareHits(
  assetId: string,
): Promise<SoftwareCveHit[]> {
  const db = getDb();
  const [rows] = await db.query(
    `SELECT product_name, product_version, cve_id, cvss_score, severity, cpe23, detail
     FROM software_cve_hits WHERE asset_id = :assetId
     ORDER BY cvss_score DESC, cve_id`,
    { assetId },
  );
  return (
    rows as Array<{
      product_name: string;
      product_version: string;
      cve_id: string;
      cvss_score: number | string | null;
      severity: string;
      cpe23: string;
      detail: string;
    }>
  ).map((row) => ({
    productName: row.product_name,
    productVersion: row.product_version,
    cveId: row.cve_id,
    cvss:
      row.cvss_score === null || row.cvss_score === undefined
        ? null
        : Number(row.cvss_score),
    severity: row.severity,
    cpe23: row.cpe23,
    detail: row.detail,
  }));
}

export async function listSoftwareHitsByAsset(
  assetIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (assetIds.length === 0) {
    return map;
  }
  const db = getDb();
  for (const assetId of assetIds) {
    const [rows] = await db.query(
      `SELECT DISTINCT cve_id FROM software_cve_hits WHERE asset_id = :assetId LIMIT 20`,
      { assetId },
    );
    map.set(
      assetId,
      (rows as Array<{ cve_id: string }>).map((row) => row.cve_id),
    );
  }
  return map;
}
