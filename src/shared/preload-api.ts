import type {
  AssetInput,
  AssetItemResult,
  AssetListResult,
} from './asset-types';
import type { AssessmentResult } from './assessment-types';
import type { LoginResult, PublicSession } from './auth-types';
import type { DatabaseStatus } from './database-status';
import type {
  AuthorizedRangesResult,
  AuthorizedScanResult,
} from './scan-types';
import type { WindowsAssessmentResult } from './windows-types';
import type {
  CredentialItemResult,
  CredentialListResult,
} from './credential-types';
import type { CveImportResult, CveListResult } from './cve-types';
import type {
  CorrelationListResult,
  CorrelationRunResult,
} from './correlation-types';
import type {
  FindingItemResult,
  FindingListResult,
  FindingStatus,
  FindingSyncResult,
} from './finding-types';
import type { DashboardResult } from './dashboard-types';
import type { CompanyProfileResult } from './company-types';
import type { AuditListResult } from './audit-types';
import type {
  ReportExportResult,
  ReportKind,
  ReportPreviewResult,
} from './report-types';

export type NetXScanApi = {
  ping: () => Promise<string>;
  getAppVersion: () => Promise<string>;
  getDatabaseStatus: () => Promise<DatabaseStatus>;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  getSession: () => Promise<PublicSession | null>;
  listAssets: (includeArchived?: boolean) => Promise<AssetListResult>;
  getAsset: (id: string) => Promise<AssetItemResult>;
  createAsset: (input: AssetInput) => Promise<AssetItemResult>;
  updateAsset: (id: string, input: AssetInput) => Promise<AssetItemResult>;
  archiveAsset: (id: string) => Promise<AssetItemResult>;
  getAuthorizedRanges: () => Promise<AuthorizedRangesResult>;
  runAuthorizedScan: (target: string) => Promise<AuthorizedScanResult>;
  runDiscoveryScan: (target: string) => Promise<AuthorizedScanResult>;
  runServiceAssessment: (assetId: string) => Promise<AssessmentResult>;
  getLatestAssessment: (assetId: string) => Promise<AssessmentResult>;
  runLocalWindowsAssessment: () => Promise<WindowsAssessmentResult>;
  runRemoteWindowsAssessment: (
    assetId: string,
    credentialId?: string,
  ) => Promise<WindowsAssessmentResult>;
  uninstallWindowsSoftware: (
    assetId: string,
    key: string,
    mode: 'local' | 'remote',
    credentialId?: string,
  ) => Promise<WindowsAssessmentResult>;
  getLatestWindowsAssessment: (assetId: string) => Promise<WindowsAssessmentResult>;
  listCredentials: () => Promise<CredentialListResult>;
  saveCredential: (
    label: string,
    username: string,
    password: string,
  ) => Promise<CredentialItemResult>;
  deleteCredential: (id: string) => Promise<CredentialItemResult>;
  listCves: (query?: string) => Promise<CveListResult>;
  importCveTestDataset: () => Promise<CveImportResult>;
  importCveFile: () => Promise<CveImportResult>;
  updateCvesOnline: () => Promise<CveImportResult>;
  getLatestCorrelation: () => Promise<CorrelationListResult>;
  runCorrelation: () => Promise<CorrelationRunResult>;
  listFindings: (status?: FindingStatus | 'all') => Promise<FindingListResult>;
  syncFindings: () => Promise<FindingSyncResult>;
  updateFinding: (
    id: string,
    status: FindingStatus,
    notes: string,
  ) => Promise<FindingItemResult>;
  getDashboard: () => Promise<DashboardResult>;
  getCompanyProfile: () => Promise<CompanyProfileResult>;
  saveCompanyName: (companyName: string) => Promise<CompanyProfileResult>;
  uploadCompanyLogo: () => Promise<CompanyProfileResult>;
  removeCompanyLogo: () => Promise<CompanyProfileResult>;
  listAudit: (query?: string) => Promise<AuditListResult>;
  previewReport: (kind: ReportKind) => Promise<ReportPreviewResult>;
  exportReport: (kind: ReportKind) => Promise<ReportExportResult>;
};

declare global {
  interface Window {
    netxscan: NetXScanApi;
  }
}

export {};
