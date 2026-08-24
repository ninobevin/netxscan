import { randomUUID } from 'node:crypto';
import { getDb } from '../db/client';
import type {
  CveCatalogStatus,
  CveRecord,
  CveSource,
} from '../shared/cve-types';

type CveRow = {
  cve_id: string;
  title: string;
  description: string;
  severity: string;
  cvss_score: number | string | null;
  published_at: string | null;
  products_json: string;
  source: string;
  imported_at: Date | string;
};

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function toRecord(row: CveRow): CveRecord {
  let products: string[] = [];
  try {
    const parsed = JSON.parse(row.products_json) as unknown;
    products = Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    products = [];
  }

  const cvss =
    row.cvss_score === null || row.cvss_score === undefined
      ? null
      : Number(row.cvss_score);

  return {
    id: row.cve_id,
    title: row.title,
    description: row.description,
    severity: row.severity as CveRecord['severity'],
    cvss: Number.isFinite(cvss) ? cvss : null,
    published: row.published_at,
    products,
    source: row.source as CveSource,
    importedAt: asIso(row.imported_at),
  };
}

export async function listAllCves(): Promise<CveRecord[]> {
  const db = getDb();
  const [rows] = await db.query(
    `SELECT cve_id, title, description, severity, cvss_score, published_at,
            products_json, source, imported_at
     FROM cves
     ORDER BY cve_id`,
  );
  return (rows as CveRow[]).map(toRecord);
}

export async function listCves(search: string): Promise<CveRecord[]> {
  const db = getDb();
  const needle = `%${search.replace(/[%_]/g, '')}%`;
  const sql = search
    ? `SELECT cve_id, title, description, severity, cvss_score, published_at,
              products_json, source, imported_at
       FROM cves
       WHERE cve_id LIKE :needle OR title LIKE :needle OR description LIKE :needle
       ORDER BY cve_id DESC
       LIMIT 200`
    : `SELECT cve_id, title, description, severity, cvss_score, published_at,
              products_json, source, imported_at
       FROM cves
       ORDER BY cve_id DESC
       LIMIT 200`;
  const [rows] = await db.query(sql, search ? { needle } : undefined);
  return (rows as CveRow[]).map(toRecord);
}

export async function getCveStatus(): Promise<CveCatalogStatus> {
  const db = getDb();
  const [countRows] = await db.query(
    'SELECT COUNT(*) AS total FROM cves',
  );
  const [importRows] = await db.query(
    `SELECT source, created_at
     FROM cve_imports
     ORDER BY created_at DESC
     LIMIT 1`,
  );
  const last = (importRows as Array<{ source: string; created_at: Date | string }>)[0];

  return {
    count: Number(
      (countRows as Array<{ total: number }>)[0]?.total ?? 0,
    ),
    lastImportedAt: last ? asIso(last.created_at) : null,
    lastSource: last ? (last.source as CveSource) : null,
  };
}

export async function upsertCves(records: CveRecord[]): Promise<number> {
  const db = getDb();
  let imported = 0;

  for (const record of records) {
    if (db.engine === 'sqlite') {
      await db.query(
        `INSERT INTO cves (
           cve_id, title, description, severity, cvss_score, published_at,
           products_json, source, imported_at
         ) VALUES (
           :id, :title, :description, :severity, :cvss, :published,
           :products, :source, :importedAt
         )
         ON CONFLICT(cve_id) DO UPDATE SET
           title = excluded.title,
           description = excluded.description,
           severity = excluded.severity,
           cvss_score = excluded.cvss_score,
           published_at = excluded.published_at,
           products_json = excluded.products_json,
           source = excluded.source,
           imported_at = excluded.imported_at`,
        bind(record),
      );
    } else {
      await db.query(
        `INSERT INTO cves (
           cve_id, title, description, severity, cvss_score, published_at,
           products_json, source, imported_at
         ) VALUES (
           :id, :title, :description, :severity, :cvss, :published,
           :products, :source, :importedAt
         )
         ON DUPLICATE KEY UPDATE
           title = VALUES(title),
           description = VALUES(description),
           severity = VALUES(severity),
           cvss_score = VALUES(cvss_score),
           published_at = VALUES(published_at),
           products_json = VALUES(products_json),
           source = VALUES(source),
           imported_at = VALUES(imported_at)`,
        bind(record),
      );
    }

    imported += 1;
  }

  await db.query(
    `INSERT INTO cve_imports (id, source, imported_count)
     VALUES (:id, :source, :importedCount)`,
    {
      id: randomUUID(),
      source: records[0]?.source ?? 'file',
      importedCount: imported,
    },
  );

  return imported;
}

function bind(record: CveRecord): Record<string, unknown> {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    severity: record.severity,
    cvss: record.cvss,
    published: record.published,
    products: JSON.stringify(record.products),
    source: record.source,
    importedAt: record.importedAt,
  };
}
