import bcrypt from 'bcryptjs';
import type { AppDatabase } from './client';

const SEED_CATEGORIES: Array<{ name: string; icon: string }> = [
  { name: 'Workstation (PC)', icon: 'Monitor' },
  { name: 'Workstation (Laptop)', icon: 'Laptop' },
  { name: 'CCTV Camera', icon: 'Cctv' },
  { name: 'NVR', icon: 'HardDrive' },
  { name: 'Managed Switch', icon: 'Network' },
  { name: 'Firewall', icon: 'Shield' },
];

function columnNames(db: AppDatabase, table: string): string[] {
  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((row) => String(row.name));
}

function rebuildAssetsTable(db: AppDatabase, columns: string[]): void {
  const ipSource = columns.includes('ipv4')
    ? 'ipv4'
    : columns.includes('ip')
      ? 'ip'
      : null;

  db.exec(`
    CREATE TABLE assets_rebuild (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ipv4 TEXT NOT NULL UNIQUE,
      hostname TEXT,
      category_id INTEGER REFERENCES categories(id),
      location_id INTEGER REFERENCES locations(id),
      winrm_ok INTEGER NOT NULL DEFAULT 0,
      os_version TEXT,
      mac_address TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  if (ipSource) {
    const hostname = columns.includes('hostname') ? 'hostname' : 'NULL';
    const categoryId = columns.includes('category_id') ? 'category_id' : 'NULL';
    const locationId = columns.includes('location_id') ? 'location_id' : 'NULL';
    const winrmOk = columns.includes('winrm_ok') ? 'winrm_ok' : '0';
    const osVersion = columns.includes('os_version') ? 'os_version' : 'NULL';
    const macAddress = columns.includes('mac_address') ? 'mac_address' : 'NULL';
    const createdAt = columns.includes('created_at')
      ? 'created_at'
      : `'${new Date().toISOString()}'`;
    const updatedAt = columns.includes('updated_at')
      ? 'updated_at'
      : `'${new Date().toISOString()}'`;

    db.exec(`
      INSERT OR IGNORE INTO assets_rebuild
        (id, ipv4, hostname, category_id, location_id, winrm_ok, os_version, mac_address, created_at, updated_at)
      SELECT id, ${ipSource}, ${hostname}, ${categoryId}, ${locationId}, ${winrmOk}, ${osVersion}, ${macAddress},
             ${createdAt}, ${updatedAt}
      FROM assets
      WHERE ${ipSource} IS NOT NULL AND ${ipSource} != '';
    `);
  }

  db.exec(`
    DROP TABLE assets;
    ALTER TABLE assets_rebuild RENAME TO assets;
  `);
}

export function runMigrations(db: AppDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('administrator', 'it_support'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      icon TEXT NOT NULL,
      builtin INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ipv4 TEXT NOT NULL UNIQUE,
      hostname TEXT,
      category_id INTEGER REFERENCES categories(id),
      location_id INTEGER REFERENCES locations(id),
      winrm_ok INTEGER NOT NULL DEFAULT 0,
      os_version TEXT,
      mac_address TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const assetColumns = columnNames(db, 'assets');
  const requiredAsset = [
    'ipv4',
    'hostname',
    'category_id',
    'winrm_ok',
    'os_version',
    'mac_address',
    'location_id',
    'created_at',
    'updated_at',
  ];
  if (
    assetColumns.length > 0 &&
    requiredAsset.some((name) => !assetColumns.includes(name))
  ) {
    rebuildAssetsTable(db, assetColumns);
  }

  const latestAssetColumns = columnNames(db, 'assets');
  if (latestAssetColumns.includes('id') && !latestAssetColumns.includes('mac_address')) {
    db.exec('ALTER TABLE assets ADD COLUMN mac_address TEXT;');
  }
  if (latestAssetColumns.includes('id') && !latestAssetColumns.includes('location_id')) {
    db.exec('ALTER TABLE assets ADD COLUMN location_id INTEGER REFERENCES locations(id);');
  }

  const categoryColumns = columnNames(db, 'categories');
  if (categoryColumns.length > 0 && !categoryColumns.includes('icon')) {
    db.exec(`ALTER TABLE categories ADD COLUMN icon TEXT NOT NULL DEFAULT 'Tag';`);
  }
  if (categoryColumns.length > 0 && !categoryColumns.includes('builtin')) {
    db.exec(`ALTER TABLE categories ADD COLUMN builtin INTEGER NOT NULL DEFAULT 0;`);
  }

  const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  if (!userCount || Number(userCount.n) === 0) {
    const insert = db.prepare(
      'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
    );
    insert.run('admin', bcrypt.hashSync('Admin123!', 10), 'administrator');
    insert.run('support', bcrypt.hashSync('Support123!', 10), 'it_support');
  }

  const insertCategory = db.prepare(
    'INSERT OR IGNORE INTO categories (name, icon, builtin) VALUES (?, ?, 1)',
  );
  for (const category of SEED_CATEGORIES) {
    insertCategory.run(category.name, category.icon);
  }
}
