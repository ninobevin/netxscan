import type {
  Asset,
  AssetDeleteManyResult,
  AssetInput,
  AssetItemResult,
  AssetListResult,
  LocationListResult,
} from './asset-types';
import type { LoginResult, PublicSession } from './auth-types';
import type { DatabaseStatus } from './database-status';
import type {
  AuthorizedRangesResult,
  AuthorizedScanResult,
} from './scan-types';
import type { CompanyProfileResult } from './company-types';
import type { AuditListResult } from './audit-types';
import type {
  WinrmAction,
  WinrmBatchResult,
  WinrmProgress,
} from './winrm-types';

export type NetXScanApi = {
  ping: () => Promise<string>;
  getAppVersion: () => Promise<string>;
  getDatabaseStatus: () => Promise<DatabaseStatus>;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  getSession: () => Promise<PublicSession | null>;
  listAssets: (includeArchived?: boolean) => Promise<AssetListResult>;
  getAsset: (id: string) => Promise<AssetItemResult>;
  updateAsset: (id: string, input: AssetInput) => Promise<AssetItemResult>;
  deleteAsset: (id: string) => Promise<AssetItemResult>;
  deleteAssets: (ids: string[]) => Promise<AssetDeleteManyResult>;
  runWinrmBatch: (
    action: WinrmAction,
    ids: string[],
  ) => Promise<WinrmBatchResult>;
  onWinrmProgress: (listener: (event: WinrmProgress) => void) => () => void;
  listLocations: () => Promise<LocationListResult>;
  addLocation: (name: string) => Promise<LocationListResult>;
  getAuthorizedRanges: () => Promise<AuthorizedRangesResult>;
  runAuthorizedScan: (target: string) => Promise<AuthorizedScanResult>;
  onScanHostFound: (listener: (asset: Asset) => void) => () => void;
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
