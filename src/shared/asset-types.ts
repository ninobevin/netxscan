export const ASSET_TYPES = [
  'workstation',
  'server',
  'virtual_server',
  'network_device',
  'printer',
  'other',
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

export type AssetService = {
  port: number;
  protocol: string;
  serviceName: string | null;
  product: string | null;
  version: string | null;
};

export type Asset = {
  id: string;
  hostname: string;
  ipAddress: string | null;
  macAddress: string | null;
  assetType: AssetType;
  notes: string | null;
  location: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  services: AssetService[];
};

export type AssetInput = {
  hostname: string;
  ipAddress: string | null;
  macAddress: string | null;
  assetType: AssetType;
  notes: string | null;
  location: string | null;
};

export type AssetMutationError =
  | 'invalid_input'
  | 'not_found'
  | 'duplicate'
  | 'unauthorized'
  | 'database_unavailable';

export type AssetListResult =
  | { ok: true; assets: Asset[] }
  | { ok: false; error: AssetMutationError };

export type AssetItemResult =
  | { ok: true; asset: Asset }
  | { ok: false; error: AssetMutationError };

export type LocationListResult =
  | { ok: true; locations: string[] }
  | { ok: false; error: AssetMutationError };
