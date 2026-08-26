import { randomUUID } from 'node:crypto';
import { getDb } from '../db/client';

export async function listLocationNames(): Promise<string[]> {
  const db = getDb();
  const [rows] = await db.query(
    'SELECT name FROM locations ORDER BY name',
  );
  return (rows as Array<{ name: string }>).map((row) => row.name);
}

export async function addLocationName(name: string): Promise<string[]> {
  const db = getDb();
  try {
    await db.query(
      `INSERT INTO locations (id, name) VALUES (:id, :name)`,
      { id: randomUUID(), name },
    );
  } catch (error) {
    if (
      !error ||
      typeof error !== 'object' ||
      !('code' in error) ||
      error.code !== 'ER_DUP_ENTRY'
    ) {
      throw error;
    }
  }

  return listLocationNames();
}
