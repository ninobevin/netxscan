import { randomUUID } from 'node:crypto';
import { getDb } from '../db/client';
import type { WindowsAssessment, WindowsFacts } from '../shared/windows-types';

type Row = {
  id: string;
  asset_id: string;
  facts_json: string;
  notes: string;
  created_at: Date | string;
};

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toAssessment(row: Row): WindowsAssessment {
  return {
    id: row.id,
    assetId: row.asset_id,
    facts: JSON.parse(row.facts_json) as WindowsFacts,
    notes: row.notes,
    createdAt: asIso(row.created_at),
  };
}

export async function findAssetIdByIp(ip: string): Promise<string | undefined> {
  const db = getDb();
  const [rows] = await db.query(
    'SELECT id FROM assets WHERE ip_address = :ip LIMIT 1',
    { ip },
  );
  return (rows as Array<{ id: string }>)[0]?.id;
}

export async function createLocalAsset(
  hostname: string,
  ip: string,
): Promise<string> {
  const db = getDb();
  const id = randomUUID();
  await db.query(
    `INSERT INTO assets (id, hostname, ip_address, mac_address, asset_type, notes)
     VALUES (:id, :hostname, :ip, NULL, 'workstation', NULL)`,
    { id, hostname: hostname.slice(0, 128), ip },
  );
  return id;
}

export async function saveWindowsAssessment(
  assetId: string,
  facts: WindowsFacts,
  notes: string,
): Promise<WindowsAssessment> {
  const db = getDb();
  const id = randomUUID();
  await db.query(
    `INSERT INTO windows_assessments (id, asset_id, facts_json, notes)
     VALUES (:id, :assetId, :factsJson, :notes)`,
    {
      id,
      assetId,
      factsJson: JSON.stringify(facts),
      notes,
    },
  );
  const saved = await getLatestWindowsAssessment(assetId);

  if (!saved) {
    throw new Error('Windows assessment save failed.');
  }

  return saved;
}

export async function mapLatestWindowsAssessments(): Promise<
  Map<string, WindowsAssessment>
> {
  const db = getDb();
  const [rows] = await db.query(
    `SELECT id, asset_id, facts_json, notes, created_at
     FROM windows_assessments a
     WHERE id = (
       SELECT b.id FROM windows_assessments b
       WHERE b.asset_id = a.asset_id
       ORDER BY b.created_at DESC
       LIMIT 1
     )`,
  );
  const map = new Map<string, WindowsAssessment>();
  for (const row of rows as Row[]) {
    map.set(row.asset_id, toAssessment(row));
  }
  return map;
}

export async function getLatestWindowsAssessment(
  assetId: string,
): Promise<WindowsAssessment | undefined> {
  const db = getDb();
  const [rows] = await db.query(
    `SELECT id, asset_id, facts_json, notes, created_at
     FROM windows_assessments
     WHERE asset_id = :assetId
     ORDER BY created_at DESC
     LIMIT 1`,
    { assetId },
  );
  const row = (rows as Row[])[0];
  return row ? toAssessment(row) : undefined;
}
