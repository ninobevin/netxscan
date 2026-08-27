import {
  ASSET_TYPES,
  type AssetInput,
  type AssetType,
} from '../shared/asset-types';

const MAX_HOSTNAME = 128;
const MAX_NOTES = 1000;
const IPV4 =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const MAC = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
}

function optionalText(value: unknown, max: number): string | null | undefined {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.length > max) {
    return undefined;
  }

  return trimmed;
}

function isAssetType(value: unknown): value is AssetType {
  return typeof value === 'string' && ASSET_TYPES.includes(value as AssetType);
}

export function parseAssetInput(payload: unknown): AssetInput | null {
  const record = asRecord(payload);

  if (!record) {
    return null;
  }

  const hostname =
    typeof record.hostname === 'string' ? record.hostname.trim() : '';

  if (hostname.length === 0 || hostname.length > MAX_HOSTNAME) {
    return null;
  }

  if (!isAssetType(record.assetType)) {
    return null;
  }

  const ipAddress = optionalText(record.ipAddress, 45);
  const macAddress = optionalText(record.macAddress, 32);
  const notes = optionalText(record.notes, MAX_NOTES);
  const location = optionalText(record.location, 128);
  const assetGroup = optionalText(record.assetGroup, 128);

  if (
    ipAddress === undefined ||
    macAddress === undefined ||
    notes === undefined ||
    location === undefined ||
    assetGroup === undefined
  ) {
    return null;
  }

  if (ipAddress && !IPV4.test(ipAddress)) {
    return null;
  }

  if (macAddress && !MAC.test(macAddress)) {
    return null;
  }

  return {
    hostname,
    ipAddress,
    macAddress,
    assetType: record.assetType,
    notes,
    location,
    assetGroup,
  };
}

export function parseAssetId(payload: unknown): string | null {
  const record = asRecord(payload);
  const id = record?.id;

  if (typeof id !== 'string' || id.length !== 36) {
    return null;
  }

  return id;
}

export function parseAssetIds(payload: unknown): string[] | null {
  const record = asRecord(payload);
  const ids = record?.ids;

  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200) {
    return null;
  }

  const unique: string[] = [];
  const seen = new Set<string>();

  for (const id of ids) {
    if (typeof id !== 'string' || id.length !== 36) {
      return null;
    }

    if (seen.has(id)) {
      continue;
    }

    seen.add(id);
    unique.push(id);
  }

  return unique;
}

export function parseLocationName(payload: unknown): string | null {
  const record = asRecord(payload);
  const name =
    typeof record?.name === 'string' ? record.name.trim() : '';

  if (name.length < 1 || name.length > 128) {
    return null;
  }

  if (!/^[A-Za-z0-9][A-Za-z0-9 .,_-]{0,127}$/.test(name)) {
    return null;
  }

  return name;
}

export function parseRenameNames(payload: unknown): {
  name: string;
  newName: string;
} | null {
  const record = asRecord(payload);
  const name = parseLocationName({ name: record?.name });
  const newName = parseLocationName({ name: record?.newName });
  if (!name || !newName) {
    return null;
  }

  return { name, newName };
}
