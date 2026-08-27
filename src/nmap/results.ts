import { getDb } from '../db/client';
import type { NmapProtocolPayload } from '../shared/nmap-types';

type Row = {
  payload_json: string;
  ran_at: Date | string;
};

export async function saveNmapResult(
  assetId: string,
  payload: NmapProtocolPayload,
): Promise<void> {
  const db = getDb();
  await db.query(`DELETE FROM nmap_scan_results WHERE asset_id = :assetId`, {
    assetId,
  });
  await db.query(
    `INSERT INTO nmap_scan_results (asset_id, payload_json)
     VALUES (:assetId, :payloadJson)`,
    {
      assetId,
      payloadJson: JSON.stringify(payload),
    },
  );
}

export async function getNmapResult(
  assetId: string,
): Promise<NmapProtocolPayload | null> {
  const db = getDb();
  const [rows] = await db.query(
    `SELECT payload_json, ran_at FROM nmap_scan_results WHERE asset_id = :assetId`,
    { assetId },
  );
  const row = (rows as Row[])[0];
  if (!row) {
    return null;
  }
  try {
    return JSON.parse(row.payload_json) as NmapProtocolPayload;
  } catch {
    return null;
  }
}
