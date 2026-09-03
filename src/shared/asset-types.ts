export const CATEGORY_ICON_ALLOWLIST = [
  'Monitor',
  'Laptop',
  'Cctv',
  'HardDrive',
  'Network',
  'Shield',
  'Printer',
  'Server',
  'Router',
  'Smartphone',
  'Radio',
  'Tag',
] as const;

export type CategoryIconName = (typeof CATEGORY_ICON_ALLOWLIST)[number];

export type Category = {
  id: number;
  name: string;
  icon: string;
  builtin: boolean;
};

export type Location = {
  id: number;
  name: string;
};

export type Asset = {
  id: number;
  ipv4: string;
  hostname: string | null;
  categoryId: number | null;
  categoryName: string | null;
  categoryIcon: string | null;
  locationId: number | null;
  locationName: string | null;
  winrmOk: boolean;
  osVersion: string | null;
  macAddress: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ScanHost = {
  ipv4: string;
  hostname: string | null;
  winrmOk: boolean;
  osVersion: string | null;
};

export type OkError = { ok: true } | { ok: false; error: string };

export type AssetListResult = { ok: true; assets: Asset[] } | { ok: false; error: string };

export type CategoryListResult =
  | { ok: true; categories: Category[] }
  | { ok: false; error: string };

export type LocationListResult =
  | { ok: true; locations: Location[] }
  | { ok: false; error: string };

export type ScanRunResult =
  | { ok: true; scanned: number; live: number }
  | { ok: false; error: string };

export type AddToAssetsResult =
  | { ok: true; added: number; skipped: number }
  | { ok: false; error: string };

export type WinrmProgress = {
  assetId: number;
  ipv4: string;
  status: 'checking' | 'starting' | 'ok' | 'failed';
  osVersion?: string | null;
  macAddress?: string | null;
};
