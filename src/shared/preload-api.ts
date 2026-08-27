import type {
  Asset,
  AssetDeleteManyResult,
  AssetInput,
  AssetItemResult,
  AssetListResult,
  GroupListResult,
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
  AssessRunResult,
  AssessmentKind,
  HistoryListResult,
  ModuleItemResult,
  ModuleListResult,
  ResultGetResult,
} from './assess-types';
import type { FindingsMatrixResult } from './findings-types';
import type { NmapProtocolResult } from './nmap-types';
import type {
  NvdSaveKeyResult,
  NvdStatusResult,
  NvdSyncResult,
  SoftwareCveHitsResult,
} from './nvd-types';
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
  deleteLocation: (name: string) => Promise<LocationListResult>;
  listGroups: () => Promise<GroupListResult>;
  addGroup: (name: string) => Promise<GroupListResult>;
  renameGroup: (name: string, newName: string) => Promise<GroupListResult>;
  deleteGroup: (name: string) => Promise<GroupListResult>;
  listAssessModules: () => Promise<ModuleListResult>;
  saveAssessModule: (input: {
    id?: string;
    name: string;
    description: string | null;
    assessScript: string;
    remediationScript: string | null;
    reverseScript: string | null;
  }) => Promise<ModuleItemResult>;
  deleteAssessModule: (id: string) => Promise<ModuleItemResult>;
  runAssessment: (input: {
    id: string;
    moduleId: string;
    kind?: AssessmentKind;
    params?: Record<string, string>;
  }) => Promise<AssessRunResult>;
  reverseAssessment: (historyId: string) => Promise<AssessRunResult>;
  listAssessHistory: (assetId: string) => Promise<HistoryListResult>;
  getAssessResult: (
    assetId: string,
    moduleId: string,
  ) => Promise<ResultGetResult>;
  getFindingsMatrix: () => Promise<FindingsMatrixResult>;
  getAuthorizedRanges: () => Promise<AuthorizedRangesResult>;
  runAuthorizedScan: (target: string) => Promise<AuthorizedScanResult>;
  onScanHostFound: (listener: (asset: Asset) => void) => () => void;
  runNmapProtocolScan: (id: string) => Promise<NmapProtocolResult>;
  getNmapProtocolResult: (id: string) => Promise<NmapProtocolResult>;
  getNvdStatus: () => Promise<NvdStatusResult>;
  saveNvdApiKey: (apiKey: string) => Promise<NvdSaveKeyResult>;
  syncNvdCatalog: () => Promise<NvdSyncResult>;
  getSoftwareCveHits: (id: string) => Promise<SoftwareCveHitsResult>;
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
