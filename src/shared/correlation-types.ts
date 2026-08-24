import type { CveSeverity } from './cve-types';

export type CorrelationMatch = {
  id: string;
  assetId: string;
  hostname: string;
  ipAddress: string | null;
  cveId: string;
  title: string;
  severity: CveSeverity;
  evidence: string;
  recommendation: string;
};

export type CorrelationRun = {
  id: string;
  matchCount: number;
  createdAt: string;
  matches: CorrelationMatch[];
};

export type CorrelationError =
  | 'unauthorized'
  | 'forbidden'
  | 'database_unavailable';

export type CorrelationListResult =
  | { ok: true; run: CorrelationRun | null }
  | { ok: false; error: CorrelationError };

export type CorrelationRunResult =
  | { ok: true; run: CorrelationRun }
  | { ok: false; error: CorrelationError };
