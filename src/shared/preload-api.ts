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
import type { CompanyProfileResult } from './company-types';
import type { AuditListResult } from './audit-types';

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
  getCompanyProfile: () => Promise<CompanyProfileResult>;
  saveCompanyName: (companyName: string) => Promise<CompanyProfileResult>;
  uploadCompanyLogo: () => Promise<CompanyProfileResult>;
  removeCompanyLogo: () => Promise<CompanyProfileResult>;
  listAudit: (query?: string) => Promise<AuditListResult>;
};

declare global {
  interface Window {
    netxscan: NetXScanApi;
  }
}

export {};
