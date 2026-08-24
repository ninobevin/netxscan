import { randomUUID } from 'node:crypto';
import { getDb } from '../db/client';
import type {
  ServiceAssessment,
  SmbFacts,
  TlsFacts,
} from '../shared/assessment-types';

type AssessmentRow = {
  id: string;
  asset_id: string;
  tls_json: string;
  smb_json: string;
  notes: string;
  created_at: Date | string;
};

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toAssessment(row: AssessmentRow): ServiceAssessment {
  return {
    id: row.id,
    assetId: row.asset_id,
    tls: JSON.parse(row.tls_json) as TlsFacts,
    smb: JSON.parse(row.smb_json) as SmbFacts,
    notes: row.notes,
    createdAt: asIso(row.created_at),
  };
}

export async function saveAssessment(
  assetId: string,
  tls: TlsFacts,
  smb: SmbFacts,
  notes: string,
): Promise<ServiceAssessment> {
  const db = getDb();
  const id = randomUUID();

  await db.query(
    `INSERT INTO asset_assessments (id, asset_id, tls_json, smb_json, notes)
     VALUES (:id, :assetId, :tlsJson, :smbJson, :notes)`,
    {
      id,
      assetId,
      tlsJson: JSON.stringify(tls),
      smbJson: JSON.stringify(smb),
      notes,
    },
  );

  const saved = await getLatestAssessment(assetId);

  if (!saved) {
    throw new Error('Assessment save failed.');
  }

  return saved;
}

export async function mapLatestAssessments(): Promise<
  Map<string, ServiceAssessment>
> {
  const db = getDb();
  const [rows] = await db.query(
    `SELECT id, asset_id, tls_json, smb_json, notes, created_at
     FROM asset_assessments a
     WHERE id = (
       SELECT b.id FROM asset_assessments b
       WHERE b.asset_id = a.asset_id
       ORDER BY b.created_at DESC
       LIMIT 1
     )`,
  );
  const map = new Map<string, ServiceAssessment>();
  for (const row of rows as AssessmentRow[]) {
    map.set(row.asset_id, toAssessment(row));
  }
  return map;
}

export async function getLatestAssessment(
  assetId: string,
): Promise<ServiceAssessment | undefined> {
  const db = getDb();
  const [rows] = await db.query(
    `SELECT id, asset_id, tls_json, smb_json, notes, created_at
     FROM asset_assessments
     WHERE asset_id = :assetId
     ORDER BY created_at DESC
     LIMIT 1`,
    { assetId },
  );
  const row = (rows as AssessmentRow[])[0];
  return row ? toAssessment(row) : undefined;
}
