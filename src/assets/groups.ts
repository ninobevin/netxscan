import { randomUUID } from 'node:crypto';
import { getDb } from '../db/client';

export async function listGroupNames(): Promise<string[]> {
  const db = getDb();
  const [rows] = await db.query('SELECT name FROM asset_groups ORDER BY name');
  return (rows as Array<{ name: string }>).map((row) => row.name);
}

export async function addGroupName(name: string): Promise<string[]> {
  const db = getDb();
  try {
    await db.query(`INSERT INTO asset_groups (id, name) VALUES (:id, :name)`, {
      id: randomUUID(),
      name,
    });
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

  return listGroupNames();
}

export async function renameGroupName(
  name: string,
  newName: string,
): Promise<string[]> {
  const db = getDb();
  await db.query(
    `UPDATE asset_groups SET name = :newName WHERE name = :name`,
    { name, newName },
  );
  await db.query(
    `UPDATE assets SET asset_group = :newName WHERE asset_group = :name`,
    { name, newName },
  );
  return listGroupNames();
}

export async function deleteGroupName(name: string): Promise<string[]> {
  const db = getDb();
  await db.query(`UPDATE assets SET asset_group = NULL WHERE asset_group = :name`, {
    name,
  });
  await db.query(`DELETE FROM asset_groups WHERE name = :name`, { name });
  return listGroupNames();
}
