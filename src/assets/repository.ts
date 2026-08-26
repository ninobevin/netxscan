import { randomUUID } from 'node:crypto';
import { getDb } from '../db/client';
import type {
  Asset,
  AssetInput,
  AssetService,
  AssetType,
} from '../shared/asset-types';
import type { ScanHost } from '../shared/scan-types';
import { parseDnsHostname } from '../nmap/hostnames';

type AssetRow = {
  id: string;
  hostname: string;
  ip_address: string | null;
  mac_address: string | null;
  asset_type: string;
  notes: string | null;
  location: string | null;
  archived_at: Date | string | null;
  winrm_manageable: number | boolean | null;
  winrm_checked_at: Date | string | null;
  winrm_detail: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function asBool(value: number | boolean | null | undefined): boolean | null {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value) === 1 || value === true;
}

function asIso(value: Date | string | null): string | null {
  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

function toAsset(row: AssetRow): Asset {
  return {
    id: row.id,
    hostname: row.hostname,
    ipAddress: row.ip_address,
    macAddress: row.mac_address,
    assetType: row.asset_type as AssetType,
    notes: row.notes,
    location: row.location,
    archivedAt: asIso(row.archived_at),
    winrmManageable: asBool(row.winrm_manageable),
    winrmCheckedAt: asIso(row.winrm_checked_at),
    winrmDetail: row.winrm_detail,
    createdAt: asIso(row.created_at) ?? '',
    updatedAt: asIso(row.updated_at) ?? '',
    services: [],
  };
}

const SELECT_FIELDS = `id, hostname, ip_address, mac_address, asset_type, notes,
  location, archived_at, winrm_manageable, winrm_checked_at, winrm_detail,
  created_at, updated_at`;

export async function listAssets(includeArchived: boolean): Promise<Asset[]> {
  const db = getDb();
  const sql = includeArchived
    ? `SELECT ${SELECT_FIELDS} FROM assets ORDER BY hostname`
    : `SELECT ${SELECT_FIELDS} FROM assets WHERE archived_at IS NULL ORDER BY hostname`;
  const [rows] = await db.query(sql);
  const assets = (rows as AssetRow[]).map(toAsset);
  await attachServices(assets);
  return assets;
}

export async function getAssetById(id: string): Promise<Asset | undefined> {
  const db = getDb();
  const [rows] = await db.query(
    `SELECT ${SELECT_FIELDS} FROM assets WHERE id = :id LIMIT 1`,
    { id },
  );
  const row = (rows as AssetRow[])[0];
  if (!row) {
    return undefined;
  }

  const asset = toAsset(row);
  await attachServices([asset]);
  return asset;
}

export async function updateAsset(
  id: string,
  input: AssetInput,
): Promise<Asset | undefined> {
  const db = getDb();
  const [result] = await db.query(
    `UPDATE assets
     SET hostname = :hostname,
         ip_address = :ipAddress,
         mac_address = :macAddress,
         asset_type = :assetType,
         notes = :notes,
         location = :location
     WHERE id = :id`,
    {
      id,
      hostname: input.hostname,
      ipAddress: input.ipAddress,
      macAddress: input.macAddress,
      assetType: input.assetType,
      notes: input.notes,
      location: input.location,
    },
  );
  const header = result as { affectedRows?: number };

  if (!header.affectedRows) {
    return undefined;
  }

  return getAssetById(id);
}

export async function setWinrmManageable(
  id: string,
  manageable: boolean,
  detail: string,
): Promise<Asset | undefined> {
  const db = getDb();
  const trimmed = detail.trim().slice(0, 500);
  const [result] = await db.query(
    `UPDATE assets
     SET winrm_manageable = :manageable,
         winrm_checked_at = :checkedAt,
         winrm_detail = :detail
     WHERE id = :id`,
    {
      id,
      manageable: manageable ? 1 : 0,
      checkedAt: new Date().toISOString(),
      detail: trimmed || null,
    },
  );
  const header = result as { affectedRows?: number };
  if (!header.affectedRows) {
    return undefined;
  }

  return getAssetById(id);
}

export async function deleteAsset(id: string): Promise<Asset | undefined> {
  const existing = await getAssetById(id);
  if (!existing) {
    return undefined;
  }

  const db = getDb();
  const statements = [
    'DELETE FROM asset_services WHERE asset_id = :id',
    'DELETE FROM asset_assessments WHERE asset_id = :id',
    'DELETE FROM windows_assessments WHERE asset_id = :id',
    'DELETE FROM findings WHERE asset_id = :id',
    'DELETE FROM correlation_matches WHERE asset_id = :id',
  ];

  for (const sql of statements) {
    try {
      await db.query(sql, { id });
    } catch {
      // table may not exist on a fresh schema
    }
  }

  const [result] = await db.query(`DELETE FROM assets WHERE id = :id`, { id });
  const header = result as { affectedRows?: number };
  if (!header.affectedRows) {
    return undefined;
  }

  return existing;
}

export function isDuplicateError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ER_DUP_ENTRY'
  );
}

type ServiceRow = {
  asset_id: string;
  port: number;
  protocol: string;
  service_name: string | null;
  product: string | null;
  version: string | null;
};

async function attachServices(assets: Asset[]): Promise<void> {
  if (assets.length === 0) {
    return;
  }

  const db = getDb();
  const ids = assets.map((asset) => asset.id);
  const placeholders = ids.map((_, index) => `:id${index}`).join(', ');
  const params = Object.fromEntries(ids.map((id, index) => [`id${index}`, id]));
  const [rows] = await db.query(
    `SELECT asset_id, port, protocol, service_name, product, version
     FROM asset_services
     WHERE asset_id IN (${placeholders})
     ORDER BY port`,
    params,
  );

  const byAsset = new Map<string, AssetService[]>();

  for (const row of rows as ServiceRow[]) {
    const list = byAsset.get(row.asset_id) ?? [];
    list.push({
      port: Number(row.port),
      protocol: row.protocol,
      serviceName: row.service_name,
      product: row.product,
      version: row.version,
    });
    byAsset.set(row.asset_id, list);
  }

  for (const asset of assets) {
    asset.services = byAsset.get(asset.id) ?? [];
  }
}

function discoveryHostname(host: ScanHost, fallback: string): string {
  const resolved = parseDnsHostname(host.hostname);
  if (resolved) {
    return resolved.slice(0, 128);
  }

  const previous = parseDnsHostname(fallback);
  if (previous) {
    return previous.slice(0, 128);
  }

  return fallback;
}

export async function upsertPingHost(host: ScanHost): Promise<Asset | undefined> {
  if (host.status !== 'up') {
    return undefined;
  }

  const db = getDb();
  const [rows] = await db.query(
    `SELECT ${SELECT_FIELDS} FROM assets WHERE ip_address = :ip LIMIT 1`,
    { ip: host.ipAddress },
  );
  const existing = (rows as AssetRow[])[0];
  const hostname = discoveryHostname(host, existing?.hostname ?? host.ipAddress);

  if (existing) {
    await db.query(
      `UPDATE assets
       SET hostname = :hostname, archived_at = NULL
       WHERE id = :id`,
      { id: existing.id, hostname },
    );
    return getAssetById(existing.id);
  }

  const id = randomUUID();
  await db.query(
    `INSERT INTO assets (id, hostname, ip_address, mac_address, asset_type, notes, location)
     VALUES (:id, :hostname, :ipAddress, NULL, 'other', NULL, NULL)`,
    {
      id,
      hostname,
      ipAddress: host.ipAddress,
    },
  );
  return getAssetById(id);
}

