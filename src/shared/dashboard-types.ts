import type { CveSeverity } from './cve-types';
import type { FindingStatus } from './finding-types';

export type DashboardScanKind = 'ping' | 'discovery';

export type DashboardScan = {
  id: string;
  kind: DashboardScanKind;
  target: string;
  upCount: number;
  createdAt: string;
};

export type DashboardFinding = {
  id: string;
  hostname: string;
  cveId: string;
  title: string;
  severity: CveSeverity;
  status: FindingStatus;
  lastDetected: string;
};

export type DashboardSnapshot = {
  totalAssets: number;
  onlineAssets: number;
  offlineAssets: number;
  unscannedAssets: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  recentScans: DashboardScan[];
  recentFindings: DashboardFinding[];
};

export type DashboardError = 'unauthorized' | 'database_unavailable';

export type DashboardResult =
  | { ok: true; dashboard: DashboardSnapshot }
  | { ok: false; error: DashboardError };
