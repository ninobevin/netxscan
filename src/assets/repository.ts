import { randomUUID } from 'node:crypto';
import { getDb } from '../db/client';
import type { Asset, AssetInput, AssetService } from '../shared/asset-types';
import type { AssetType } from '../shared/asset-types';
import type { NmapHost } from '../shared/scan-types';

type AssetRow = {
  id: string;
  hostname: string;
  ip_address: string | null;
  mac_address: string | null;
  asset_type: string;
  notes: string | null;
  archived_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

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
    archivedAt: asIso(row.archived_at),
    createdAt: asIso(row.created_at) ?? '',
    updatedAt: asIso(row.updated_at) ?? '',
    services: [],
  };
}

const SELECT_FIELDS = `id, hostname, ip_address, mac_address, asset_type, notes,
  archived_at, created_at, updated_at`;

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

export async function createAsset(input: AssetInput): Promise<Asset> {
  const db = getDb();
  const id = randomUUID();

  await db.query(
    `INSERT INTO assets (id, hostname, ip_address, mac_address, asset_type, notes)
     VALUES (:id, :hostname, :ipAddress, :macAddress, :assetType, :notes)`,
    {
      id,
      hostname: input.hostname,
      ipAddress: input.ipAddress,
      macAddress: input.macAddress,
      assetType: input.assetType,
      notes: input.notes,
    },
  );

  const created = await getAssetById(id);

  if (!created) {
    throw new Error('Asset create failed.');
  }

  return created;
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
         notes = :notes
     WHERE id = :id AND archived_at IS NULL`,
    {
      id,
      hostname: input.hostname,
      ipAddress: input.ipAddress,
      macAddress: input.macAddress,
      assetType: input.assetType,
      notes: input.notes,
    },
  );
  const header = result as { affectedRows?: number };

  if (!header.affectedRows) {
    return undefined;
  }

  return getAssetById(id);
}

export async function archiveAsset(id: string): Promise<Asset | undefined> {
  const db = getDb();
  const [result] = await db.query(
    `UPDATE assets
     SET archived_at = CURRENT_TIMESTAMP
     WHERE id = :id AND archived_at IS NULL`,
    { id },
  );
  const header = result as { affectedRows?: number };

  if (!header.affectedRows) {
    return undefined;
  }

  return getAssetById(id);
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

const MAC =
  /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

function discoveryHostname(host: NmapHost, fallback: string): string {
  const name = host.hostname?.trim() ?? '';

  if (name.length > 0 && name.length <= 128) {
    return name;
  }

  return fallback;
}

function discoveryMac(host: NmapHost): string | null {
  if (!host.macAddress || !MAC.test(host.macAddress)) {
    return null;
  }

  return host.macAddress.toUpperCase().replace(/-/g, ':');
}

export async function upsertDiscoveredHost(host: NmapHost): Promise<void> {
  if (host.status !== 'up') {
    return;
  }

  const db = getDb();
  const [rows] = await db.query(
    `SELECT ${SELECT_FIELDS} FROM assets WHERE ip_address = :ip LIMIT 1`,
    { ip: host.ipAddress },
  );
  const existing = (rows as AssetRow[])[0];
  const macAddress = discoveryMac(host);

  let assetId: string;

  if (existing) {
    assetId = existing.id;
    const hostname = discoveryHostname(host, existing.hostname);
    await db.query(
      `UPDATE assets
       SET hostname = :hostname,
           mac_address = COALESCE(:macAddress, mac_address)
       WHERE id = :id`,
      { id: assetId, hostname, macAddress },
    );
  } else {
    assetId = randomUUID();
    const hostname = discoveryHostname(host, host.ipAddress);
    await db.query(
      `INSERT INTO assets (id, hostname, ip_address, mac_address, asset_type, notes)
       VALUES (:id, :hostname, :ipAddress, :macAddress, 'other', NULL)`,
      {
        id: assetId,
        hostname,
        ipAddress: host.ipAddress,
        macAddress,
      },
    );
  }

  await db.query('DELETE FROM asset_services WHERE asset_id = :id', {
    id: assetId,
  });

  for (const service of host.ports) {
    await db.query(
      `INSERT INTO asset_services
        (id, asset_id, port, protocol, service_name, product, version)
       VALUES (:id, :assetId, :port, :protocol, :serviceName, :product, :version)`,
      {
        id: randomUUID(),
        assetId,
        port: service.port,
        protocol: service.protocol.slice(0, 8),
        serviceName: service.serviceName?.slice(0, 64) ?? null,
        product: service.product?.slice(0, 128) ?? null,
        version: service.version?.slice(0, 64) ?? null,
      },
    );
  }
}
