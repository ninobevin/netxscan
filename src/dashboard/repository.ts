import { randomUUID } from 'node:crypto';
import { getDb } from '../db/client';
import type {
  DashboardFinding,
  DashboardScan,
  DashboardSnapshot,
} from '../shared/dashboard-types';
import type { CveSeverity } from '../shared/cve-types';
import type { FindingStatus } from '../shared/finding-types';

const OPEN_STATUSES = `('open', 'acknowledged', 'in_progress')`;

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

export async function recordScan(
  kind: 'ping' | 'discovery',
  target: string,
  upCount: number,
): Promise<string> {
  const db = getDb();
  const id = randomUUID();
  await db.query(
    `INSERT INTO scan_history (id, kind, target, up_count)
     VALUES (:id, :kind, :target, :upCount)`,
    { id, kind, target: target.slice(0, 64), upCount },
  );
  return id;
}

export async function markAssetsSeenInScan(
  scanId: string,
  ipAddresses: string[],
): Promise<void> {
  if (ipAddresses.length === 0) {
    return;
  }

  const db = getDb();
  for (const ip of ipAddresses) {
    await db.query(
      `UPDATE assets
       SET last_seen_scan_id = :scanId
       WHERE ip_address = :ip AND archived_at IS NULL`,
      { scanId, ip },
    );
  }
}

export async function getDashboard(): Promise<DashboardSnapshot> {
  const db = getDb();

  const [totalRows] = await db.query(
    `SELECT COUNT(*) AS total FROM assets WHERE archived_at IS NULL`,
  );
  const totalAssets = Number(
    (totalRows as Array<{ total: number }>)[0]?.total ?? 0,
  );

  const [latestRows] = await db.query(
    `SELECT id FROM scan_history ORDER BY created_at DESC LIMIT 1`,
  );
  const latestId = (latestRows as Array<{ id: string }>)[0]?.id;

  let onlineAssets = 0;
  let offlineAssets = 0;
  let unscannedAssets = 0;

  if (latestId) {
    const [onlineRows] = await db.query(
      `SELECT COUNT(*) AS total
       FROM assets
       WHERE archived_at IS NULL
         AND ip_address IS NOT NULL
         AND last_seen_scan_id = :scanId`,
      { scanId: latestId },
    );
    onlineAssets = Number(
      (onlineRows as Array<{ total: number }>)[0]?.total ?? 0,
    );

    const [offlineRows] = await db.query(
      `SELECT COUNT(*) AS total
       FROM assets
       WHERE archived_at IS NULL
         AND ip_address IS NOT NULL
         AND (last_seen_scan_id IS NULL OR last_seen_scan_id <> :scanId)`,
      { scanId: latestId },
    );
    offlineAssets = Number(
      (offlineRows as Array<{ total: number }>)[0]?.total ?? 0,
    );
  } else {
    const [ipRows] = await db.query(
      `SELECT COUNT(*) AS total
       FROM assets
       WHERE archived_at IS NULL AND ip_address IS NOT NULL`,
    );
    unscannedAssets = Number(
      (ipRows as Array<{ total: number }>)[0]?.total ?? 0,
    );
  }

  const [severityRows] = await db.query(
    `SELECT severity, COUNT(*) AS total
     FROM findings
     WHERE status IN ${OPEN_STATUSES}
     GROUP BY severity`,
  );

  const bySeverity: Record<string, number> = {};
  for (const row of severityRows as Array<{ severity: string; total: number }>) {
    bySeverity[row.severity] = Number(row.total);
  }

  const [scanRows] = await db.query(
    `SELECT id, kind, target, up_count, created_at
     FROM scan_history
     ORDER BY created_at DESC
     LIMIT 8`,
  );
  const recentScans: DashboardScan[] = (
    scanRows as Array<{
      id: string;
      kind: string;
      target: string;
      up_count: number;
      created_at: Date | string;
    }>
  ).map((row) => ({
    id: row.id,
    kind: row.kind === 'ping' ? 'ping' : 'discovery',
    target: row.target,
    upCount: Number(row.up_count),
    createdAt: asIso(row.created_at),
  }));

  const [findingRows] = await db.query(
    `SELECT f.id, a.hostname, f.cve_id, f.title, f.severity, f.status,
            f.last_detected
     FROM findings f
     INNER JOIN assets a ON a.id = f.asset_id
     WHERE f.status IN ${OPEN_STATUSES}
     ORDER BY f.last_detected DESC
     LIMIT 8`,
  );
  const recentFindings: DashboardFinding[] = (
    findingRows as Array<{
      id: string;
      hostname: string;
      cve_id: string;
      title: string;
      severity: string;
      status: string;
      last_detected: Date | string;
    }>
  ).map((row) => ({
    id: row.id,
    hostname: row.hostname,
    cveId: row.cve_id,
    title: row.title,
    severity: row.severity as CveSeverity,
    status: row.status as FindingStatus,
    lastDetected: asIso(row.last_detected),
  }));

  return {
    totalAssets,
    onlineAssets,
    offlineAssets,
    unscannedAssets,
    criticalFindings: bySeverity.critical ?? 0,
    highFindings: bySeverity.high ?? 0,
    mediumFindings: bySeverity.medium ?? 0,
    lowFindings: (bySeverity.low ?? 0) + (bySeverity.none ?? 0),
    recentScans,
    recentFindings,
  };
}
