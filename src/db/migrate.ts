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

    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ipv4 TEXT NOT NULL UNIQUE,
      hostname TEXT,
      category_id INTEGER REFERENCES categories(id),
      winrm_ok INTEGER NOT NULL DEFAULT 0,
      os_version TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

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
