import type { CveSeverity } from './cve-types';

export const FINDING_STATUSES = [
  'open',
  'acknowledged',
  'in_progress',
  'resolved',
  'accepted_risk',
  'false_positive',
] as const;

export type FindingStatus = (typeof FINDING_STATUSES)[number];

export type Finding = {
  id: string;
  assetId: string;
  hostname: string;
  ipAddress: string | null;
  cveId: string;
  title: string;
  description: string;
  severity: CveSeverity;
  source: 'correlation' | 'assessment';
  evidence: string;
  recommendation: string;
  status: FindingStatus;
  notes: string;
  firstDetected: string;
  lastDetected: string;
  resolvedAt: string | null;
};

export type FindingError =
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_input'
  | 'not_found'
  | 'database_unavailable';

export type FindingListResult =
  | { ok: true; findings: Finding[] }
  | { ok: false; error: FindingError };

export type FindingItemResult =
  | { ok: true; finding: Finding }
  | { ok: false; error: FindingError };

export type FindingSyncResult =
  | { ok: true; created: number; updated: number; findings: Finding[] }
  | { ok: false; error: FindingError };
