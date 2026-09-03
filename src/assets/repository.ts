import { getDb } from '../db/client';
import { CATEGORY_ICON_ALLOWLIST } from '../shared/asset-types';
import type { Asset, Category, Location, ScanHost } from '../shared/asset-types';

type AssetRow = {
  id: number;
  ipv4: string;
  hostname: string | null;
  category_id: number | null;
  category_name: string | null;
  category_icon: string | null;
  location_id: number | null;
  location_name: string | null;
  winrm_ok: number;
  os_version: string | null;
  mac_address: string | null;
  created_at: string;
  updated_at: string;
};

function mapAsset(row: AssetRow): Asset {
  return {
    id: row.id,
    ipv4: row.ipv4,
    hostname: row.hostname,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categoryIcon: row.category_icon,
    locationId: row.location_id,
    locationName: row.location_name,
    winrmOk: Boolean(row.winrm_ok),
    osVersion: row.os_version,
    macAddress: row.mac_address,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const ASSET_SELECT = `
  SELECT a.id, a.ipv4, a.hostname, a.category_id, c.name AS category_name,
         c.icon AS category_icon, a.location_id, l.name AS location_name,
         a.winrm_ok, a.os_version, a.mac_address, a.created_at, a.updated_at
  FROM assets a
  LEFT JOIN categories c ON c.id = a.category_id
  LEFT JOIN locations l ON l.id = a.location_id
`;

export function listAssets(): Asset[] {
  const rows = getDb().prepare(`${ASSET_SELECT} ORDER BY a.ipv4`).all() as AssetRow[];
  return rows.map(mapAsset);
}

export function getAssetById(id: number): Asset | null {
  const row = getDb().prepare(`${ASSET_SELECT} WHERE a.id = ?`).get(id) as
    | AssetRow
    | undefined;
  return row ? mapAsset(row) : null;
}

export function addScanHosts(hosts: ScanHost[]): { added: number; skipped: number } {
  const db = getDb();
  const exists = db.prepare('SELECT 1 FROM assets WHERE ipv4 = ?');
  const insert = db.prepare(`
    INSERT INTO assets (ipv4, hostname, category_id, location_id, winrm_ok, os_version, mac_address, created_at, updated_at)
    VALUES (?, ?, NULL, NULL, 0, NULL, NULL, ?, ?)
  `);
  const now = new Date().toISOString();
  let added = 0;
  let skipped = 0;

  for (const host of hosts) {
    if (exists.get(host.ipv4)) {
      skipped += 1;
      continue;
    }
    insert.run(host.ipv4, host.hostname, now, now);
    added += 1;
  }

  return { added, skipped };
}

export function updateAsset(
  id: number,
  input: { categoryId?: number | null; locationId?: number | null },
): Asset | null {
  const now = new Date().toISOString();
  if ('categoryId' in input) {
    getDb()
      .prepare('UPDATE assets SET category_id = ?, updated_at = ? WHERE id = ?')
      .run(input.categoryId ?? null, now, id);
  }
  if ('locationId' in input) {
    getDb()
      .prepare('UPDATE assets SET location_id = ?, updated_at = ? WHERE id = ?')
      .run(input.locationId ?? null, now, id);
  }
  return getAssetById(id);
}

export function updateWinrm(
  id: number,
  winrmOk: boolean,
  osVersion: string | null,
  macAddress: string | null,
): void {
  const existing = getAssetById(id);
  const nextOs = winrmOk
    ? (osVersion ?? existing?.osVersion ?? null)
    : (existing?.osVersion ?? null);
  const nextMac = macAddress ?? existing?.macAddress ?? null;
  const now = new Date().toISOString();
  getDb()
    .prepare(
      'UPDATE assets SET winrm_ok = ?, os_version = ?, mac_address = ?, updated_at = ? WHERE id = ?',
    )
    .run(winrmOk ? 1 : 0, nextOs, nextMac, now, id);
}

export function deleteAsset(id: number): boolean {
  const result = getDb().prepare('DELETE FROM assets WHERE id = ?').run(id);
  return result.changes > 0;
}

export function deleteAssets(ids: number[]): number {
  const del = getDb().prepare('DELETE FROM assets WHERE id = ?');
  const run = getDb().transaction((values: number[]) => {
    let count = 0;
    for (const id of values) {
      count += del.run(id).changes;
    }
    return count;
  });
  return run(ids);
}

export function listCategories(): Category[] {
  const rows = getDb()
    .prepare('SELECT id, name, icon, builtin FROM categories ORDER BY name')
    .all() as Array<{ id: number; name: string; icon: string; builtin: number }>;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    icon: row.icon,
    builtin: Boolean(row.builtin),
  }));
}

export function addCategory(name: string, icon: string): Category | { error: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { error: 'Device name is required.' };
  }
  const iconName = CATEGORY_ICON_ALLOWLIST.includes(
    icon as (typeof CATEGORY_ICON_ALLOWLIST)[number],
  )
    ? icon
    : 'Tag';

  try {
    const result = getDb()
      .prepare('INSERT INTO categories (name, icon, builtin) VALUES (?, ?, 0)')
      .run(trimmed, iconName);
    const created = listCategories().find((item) => item.id === Number(result.lastInsertRowid));
    if (!created) {
      return { error: 'Could not create device type.' };
    }
    return created;
  } catch {
    return { error: 'A device with that name already exists.' };
  }
}

export function listLocations(): Location[] {
  const rows = getDb()
    .prepare('SELECT id, name FROM locations ORDER BY name')
    .all() as Array<{ id: number; name: string }>;
  return rows.map((row) => ({ id: row.id, name: row.name }));
}

export function addLocation(name: string): Location | { error: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { error: 'Location name is required.' };
  }
  try {
    const result = getDb()
      .prepare('INSERT INTO locations (name) VALUES (?)')
      .run(trimmed);
    const created = listLocations().find((item) => item.id === Number(result.lastInsertRowid));
    if (!created) {
      return { error: 'Could not create location.' };
    }
    return created;
  } catch {
    return { error: 'A location with that name already exists.' };
  }
}
