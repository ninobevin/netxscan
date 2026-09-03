import type { LoginResult, PublicSession } from './auth-types';
import type {
  AddToAssetsResult,
  AssetListResult,
  CategoryListResult,
  OkError,
  ScanHost,
  ScanRunResult,
  WinrmProgress,
} from './asset-types';

export type NetXScanApi = {
  ping: () => Promise<string>;
  getAppVersion: () => Promise<string>;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  getSession: () => Promise<PublicSession | null>;
  runScan: (target: string) => Promise<ScanRunResult>;
  onScanHostFound: (listener: (host: ScanHost) => void) => () => void;
  addScanToAssets: (hosts: ScanHost[]) => Promise<AddToAssetsResult>;
  listAssets: () => Promise<AssetListResult>;
  updateAsset: (id: number, categoryId: number | null) => Promise<AssetListResult>;
  deleteAssets: (ids: number[]) => Promise<AssetListResult>;
  listCategories: () => Promise<CategoryListResult>;
  addCategory: (name: string, icon: string) => Promise<CategoryListResult>;
  checkAccessibility: (ids: number[]) => Promise<AssetListResult | OkError>;
  onWinrmProgress: (listener: (event: WinrmProgress) => void) => () => void;
};

declare global {
  interface Window {
    netxscan: NetXScanApi;
  }
}

export {};
