import type { LoginResult, PublicSession, TotpBeginResult, UserListResult, UserRole } from './auth-types';
import type {
  AddToAssetsResult,
  AssetListResult,
  CategoryListResult,
  LocationListResult,
  OkError,
  ScanHost,
  ScanRunResult,
  WinrmProgress,
} from './asset-types';
import type { CompanyProfile, CompanyResult } from './company-types';

export type NetXScanApi = {
  ping: () => Promise<string>;
  getAppVersion: () => Promise<string>;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  getSession: () => Promise<PublicSession | null>;
  changePassword: (currentPassword: string, nextPassword: string) => Promise<LoginResult>;
  beginTotpSetup: () => Promise<TotpBeginResult>;
  confirmTotpSetup: (code: string) => Promise<LoginResult>;
  forgotPassword: (
    username: string,
    authenticatorCode: string,
    nextPassword: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  listUsers: () => Promise<UserListResult>;
  addUser: (username: string, password: string, role: UserRole) => Promise<UserListResult>;
  updateUser: (
    id: number,
    input: { username: string; role: UserRole; password?: string },
  ) => Promise<UserListResult>;
  deleteUser: (id: number) => Promise<UserListResult>;
  runScan: (target: string, mode: 'ping' | 'nmap') => Promise<ScanRunResult>;
  onScanHostFound: (listener: (host: ScanHost) => void) => () => void;
  addScanToAssets: (hosts: ScanHost[]) => Promise<AddToAssetsResult>;
  listAssets: () => Promise<AssetListResult>;
  updateAsset: (
    id: number,
    input: { categoryId?: number | null; locationId?: number | null },
  ) => Promise<AssetListResult>;
  deleteAssets: (ids: number[]) => Promise<AssetListResult>;
  listCategories: () => Promise<CategoryListResult>;
  addCategory: (name: string, icon: string) => Promise<CategoryListResult>;
  updateCategory: (id: number, name: string, icon: string) => Promise<CategoryListResult>;
  deleteCategory: (id: number) => Promise<CategoryListResult>;
  listLocations: () => Promise<LocationListResult>;
  addLocation: (name: string) => Promise<LocationListResult>;
  updateLocation: (id: number, name: string) => Promise<LocationListResult>;
  deleteLocation: (id: number) => Promise<LocationListResult>;
  getCompany: () => Promise<CompanyResult>;
  updateCompany: (profile: CompanyProfile) => Promise<CompanyResult>;
  checkAccessibility: (ids: number[]) => Promise<AssetListResult | OkError>;
  onWinrmProgress: (listener: (event: WinrmProgress) => void) => () => void;
};

declare global {
  interface Window {
    netxscan: NetXScanApi;
  }
}

export {};
