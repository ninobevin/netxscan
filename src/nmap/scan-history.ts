import { randomUUID } from 'node:crypto';
import { getDb } from '../db/client';

export async function recordScan(
  kind: 'ping',
  target: string,
  upCount: number,
): Promise<string> {
  const db = getDb();
  const id = randomUUID();
  await db.query(
    `INSERT INTO scan_history (id, kind, target, up_count)
     VALUES (:id, :kind, :target, :upCount)`,
    { id, kind, target: target.slice(0, 64), upCount },
  );
  return id;
}

export async function markAssetsSeenInScan(
  scanId: string,
  ipAddresses: string[],
): Promise<void> {
  if (ipAddresses.length === 0) {
    return;
  }

  const db = getDb();
  for (const ip of ipAddresses) {
    await db.query(
      `UPDATE assets
       SET last_seen_scan_id = :scanId
       WHERE ip_address = :ip AND archived_at IS NULL`,
      { scanId, ip },
    );
  }
}
