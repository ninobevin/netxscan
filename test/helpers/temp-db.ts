import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { closeDatabase, getDb, initializeDatabase } from '../../src/db/client';
import { runMigrations } from '../../src/db/migrate';

export async function withSqlite<T>(fn: () => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'netxscan-test-'));
  const filePath = path.join(dir, 'netxscan.sqlite');

  try {
    const db = await initializeDatabase({ engine: 'sqlite', filePath });
    await runMigrations(db);
    return await fn();
  } finally {
    await closeDatabase();
    await rm(dir, { recursive: true, force: true });
  }
}

export { getDb };
