import { randomUUID } from 'node:crypto';
import { getDb } from '../db/client';
import type {
  CorrelationMatch,
  CorrelationRun,
} from '../shared/correlation-types';
import type { CveSeverity } from '../shared/cve-types';
import type { EngineMatch } from './engine';

type RunRow = {
  id: string;
  match_count: number;
  created_at: Date | string;
};

type MatchRow = {
  id: string;
  asset_id: string;
  hostname: string;
  ip_address: string | null;
  cve_id: string;
  title: string;
  severity: string;
  evidence: string;
  recommendation: string;
};

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function toMatch(row: MatchRow): CorrelationMatch {
  return {
    id: row.id,
    assetId: row.asset_id,
    hostname: row.hostname,
    ipAddress: row.ip_address,
    cveId: row.cve_id,
    title: row.title,
    severity: row.severity as CveSeverity,
    evidence: row.evidence,
    recommendation: row.recommendation,
  };
}

export async function saveCorrelationRun(
  matches: EngineMatch[],
): Promise<CorrelationRun> {
  const db = getDb();
  const runId = randomUUID();

  await db.query(
    `INSERT INTO correlation_runs (id, match_count)
     VALUES (:id, :matchCount)`,
    { id: runId, matchCount: matches.length },
  );

  for (const match of matches) {
    await db.query(
      `INSERT INTO correlation_matches (
         id, run_id, asset_id, cve_id, title, severity, evidence, recommendation
       ) VALUES (
         :id, :runId, :assetId, :cveId, :title, :severity, :evidence, :recommendation
       )`,
      {
        id: randomUUID(),
        runId,
        assetId: match.assetId,
        cveId: match.cveId,
        title: match.title,
        severity: match.severity,
        evidence: match.evidence.slice(0, 4000),
        recommendation: match.recommendation.slice(0, 1000),
      },
    );
  }

  const saved = await getLatestCorrelationRun();
  if (!saved) {
    throw new Error('Correlation save failed.');
  }

  return saved;
}

export async function getLatestCorrelationRun(): Promise<CorrelationRun | null> {
  const db = getDb();
  const [runRows] = await db.query(
    `SELECT id, match_count, created_at
     FROM correlation_runs
     ORDER BY created_at DESC
     LIMIT 1`,
  );
  const run = (runRows as RunRow[])[0];
  if (!run) {
    return null;
  }

  const [matchRows] = await db.query(
    `SELECT m.id, m.asset_id, a.hostname, a.ip_address, m.cve_id, m.title,
            m.severity, m.evidence, m.recommendation
     FROM correlation_matches m
     INNER JOIN assets a ON a.id = m.asset_id
     WHERE m.run_id = :runId
     ORDER BY m.severity, a.hostname, m.cve_id`,
    { runId: run.id },
  );

  return {
    id: run.id,
    matchCount: Number(run.match_count),
    createdAt: asIso(run.created_at),
    matches: (matchRows as MatchRow[]).map(toMatch),
  };
}
