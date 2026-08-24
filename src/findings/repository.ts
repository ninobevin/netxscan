import { randomUUID } from 'node:crypto';
import { getDb } from '../db/client';
import type { EngineMatch } from '../correlate/engine';
import type {
  Finding,
  FindingStatus,
} from '../shared/finding-types';
import type { CveSeverity } from '../shared/cve-types';

type FindingRow = {
  id: string;
  asset_id: string;
  hostname: string;
  ip_address: string | null;
  cve_id: string;
  title: string;
  description: string;
  severity: string;
  source: string;
  evidence: string;
  recommendation: string;
  status: string;
  notes: string;
  first_detected: Date | string;
  last_detected: Date | string;
  resolved_at: Date | string | null;
};

function asIso(value: Date | string | null): string | null {
  if (value === null) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : String(value);
}

function toFinding(row: FindingRow): Finding {
  return {
    id: row.id,
    assetId: row.asset_id,
    hostname: row.hostname,
    ipAddress: row.ip_address,
    cveId: row.cve_id,
    title: row.title,
    description: row.description,
    severity: row.severity as CveSeverity,
    source: row.source === 'assessment' ? 'assessment' : 'correlation',
    evidence: row.evidence,
    recommendation: row.recommendation,
    status: row.status as FindingStatus,
    notes: row.notes,
    firstDetected: asIso(row.first_detected) ?? '',
    lastDetected: asIso(row.last_detected) ?? '',
    resolvedAt: asIso(row.resolved_at),
  };
}

const SELECT = `SELECT f.id, f.asset_id, a.hostname, a.ip_address, f.cve_id,
  f.title, f.description, f.severity, f.source, f.evidence, f.recommendation,
  f.status, f.notes, f.first_detected, f.last_detected, f.resolved_at
  FROM findings f
  INNER JOIN assets a ON a.id = f.asset_id`;

export async function listFindings(
  status: FindingStatus | 'all',
): Promise<Finding[]> {
  const db = getDb();
  const sql =
    status === 'all'
      ? `${SELECT} ORDER BY f.last_detected DESC LIMIT 500`
      : `${SELECT} WHERE f.status = :status ORDER BY f.last_detected DESC LIMIT 500`;
  const [rows] = await db.query(
    sql,
    status === 'all' ? undefined : { status },
  );
  return (rows as FindingRow[]).map(toFinding);
}

export async function getFindingById(id: string): Promise<Finding | undefined> {
  const db = getDb();
  const [rows] = await db.query(`${SELECT} WHERE f.id = :id LIMIT 1`, { id });
  const row = (rows as FindingRow[])[0];
  return row ? toFinding(row) : undefined;
}

export async function updateFinding(
  id: string,
  status: FindingStatus,
  notes: string,
): Promise<Finding | undefined> {
  const existing = await getFindingById(id);
  if (!existing) {
    return undefined;
  }

  const now = new Date().toISOString();
  let resolvedAt: string | null = existing.resolvedAt;

  if (status === 'resolved' && existing.status !== 'resolved') {
    resolvedAt = now;
  }

  if (status !== 'resolved') {
    resolvedAt = null;
  }

  const db = getDb();
  await db.query(
    `UPDATE findings
     SET status = :status, notes = :notes, resolved_at = :resolvedAt
     WHERE id = :id`,
    { id, status, notes, resolvedAt },
  );

  return getFindingById(id);
}

export async function upsertFindingsFromMatches(
  matches: EngineMatch[],
  source: 'correlation' | 'assessment' = 'correlation',
): Promise<{ created: number; updated: number }> {
  const db = getDb();
  let created = 0;
  let updated = 0;
  const now = new Date().toISOString();

  for (const match of matches) {
    const [rows] = await db.query(
      `SELECT id, status, resolved_at
       FROM findings
       WHERE asset_id = :assetId AND cve_id = :cveId
       LIMIT 1`,
      { assetId: match.assetId, cveId: match.cveId },
    );
    const existing = (
      rows as Array<{
        id: string;
        status: string;
        resolved_at: Date | string | null;
      }>
    )[0];

    if (!existing) {
      await db.query(
        `INSERT INTO findings (
           id, asset_id, cve_id, title, description, severity, source,
           evidence, recommendation, status, notes, first_detected,
           last_detected, resolved_at
         ) VALUES (
           :id, :assetId, :cveId, :title, :description, :severity, :source,
           :evidence, :recommendation, 'open', '', :firstDetected,
           :lastDetected, NULL
         )`,
        {
          id: randomUUID(),
          assetId: match.assetId,
          cveId: match.cveId,
          title: match.title.slice(0, 512),
          description: match.description.slice(0, 4000),
          severity: match.severity,
          source,
          evidence: match.evidence.slice(0, 4000),
          recommendation: match.recommendation.slice(0, 1000),
          firstDetected: now,
          lastDetected: now,
        },
      );
      created += 1;
      continue;
    }

    const keepClosed =
      existing.status === 'accepted_risk' ||
      existing.status === 'false_positive';
    const reopen = existing.status === 'resolved';
    const nextStatus = keepClosed
      ? existing.status
      : reopen
        ? 'open'
        : existing.status;

    await db.query(
      `UPDATE findings
       SET title = :title,
           description = :description,
           severity = :severity,
           evidence = :evidence,
           recommendation = :recommendation,
           last_detected = :lastDetected,
           status = :status,
           source = :source,
           resolved_at = :resolvedAt
       WHERE id = :id`,
      {
        id: existing.id,
        title: match.title.slice(0, 512),
        description: match.description.slice(0, 4000),
        severity: match.severity,
        evidence: match.evidence.slice(0, 4000),
        recommendation: match.recommendation.slice(0, 1000),
        lastDetected: now,
        status: nextStatus,
        source,
        resolvedAt: reopen || nextStatus !== 'resolved' ? null : asIso(existing.resolved_at),
      },
    );
    updated += 1;
  }

  return { created, updated };
}

export async function matchesFromLatestRun(): Promise<EngineMatch[]> {
  const db = getDb();
  const [runRows] = await db.query(
    `SELECT id FROM correlation_runs ORDER BY created_at DESC LIMIT 1`,
  );
  const run = (runRows as Array<{ id: string }>)[0];
  if (!run) {
    return [];
  }

  const [rows] = await db.query(
    `SELECT m.asset_id, a.hostname, a.ip_address, m.cve_id, m.title,
            COALESCE(c.description, m.title) AS description, m.severity,
            m.evidence, m.recommendation
     FROM correlation_matches m
     INNER JOIN assets a ON a.id = m.asset_id
     LEFT JOIN cves c ON c.cve_id = m.cve_id
     WHERE m.run_id = :runId`,
    { runId: run.id },
  );

  return (
    rows as Array<{
      asset_id: string;
      hostname: string;
      ip_address: string | null;
      cve_id: string;
      title: string;
      description: string;
      severity: CveSeverity;
      evidence: string;
      recommendation: string;
    }>
  ).map((row) => ({
    assetId: row.asset_id,
    hostname: row.hostname,
    ipAddress: row.ip_address,
    cveId: row.cve_id,
    title: row.title,
    description: row.description,
    severity: row.severity,
    evidence: row.evidence,
    recommendation: row.recommendation,
  }));
}
