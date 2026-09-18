import bcrypt from 'bcryptjs';
import type { AppDatabase } from './client';
import { ADHICS_CATALOG_V2, ADHICS_CATALOG_VERSION } from '../adhics/catalog-v2';
import { DUMMY_ASSESSMENT_SCRIPTS } from '../adhics/dummy-scripts';

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

function setCatalogVersion(db: AppDatabase): void {
  const existing = db.prepare(`SELECT key FROM app_meta WHERE key = 'adhics_catalog_version'`).get();
  if (existing) {
    db.prepare(`UPDATE app_meta SET value = ? WHERE key = 'adhics_catalog_version'`).run(
      ADHICS_CATALOG_VERSION,
    );
    return;
  }
  db.prepare(`INSERT INTO app_meta (key, value) VALUES ('adhics_catalog_version', ?)`).run(
    ADHICS_CATALOG_VERSION,
  );
}

function catalogVersion(db: AppDatabase): string {
  const row = db.prepare(`SELECT value FROM app_meta WHERE key = 'adhics_catalog_version'`).get();
  return row ? String(row.value) : '';
}

function isOldDomain5Sample(db: AppDatabase): boolean {
  const domains = db.prepare('SELECT COUNT(*) AS n FROM adhics_domains').get();
  const controls = db.prepare('SELECT COUNT(*) AS n FROM adhics_controls').get();
  const onlyFive = db.prepare(`SELECT COUNT(*) AS n FROM adhics_domains WHERE code = '5'`).get();
  return (
    Number(domains?.n) === 1 &&
    Number(onlyFive?.n) === 1 &&
    Number(controls?.n) <= 4
  );
}

function clearAdhicsCatalog(db: AppDatabase): void {
  db.exec(`
    DELETE FROM assessment_results;
    DELETE FROM assessment_batches;
    DELETE FROM findings;
    DELETE FROM assessment_scripts;
    DELETE FROM adhics_controls;
    DELETE FROM adhics_families;
    DELETE FROM adhics_domains;
  `);
}

function insertAdhicsCatalog(db: AppDatabase): void {
  const insertDomain = db.prepare('INSERT INTO adhics_domains (code, name) VALUES (?, ?)');
  const insertFamily = db.prepare(
    'INSERT INTO adhics_families (domain_id, code, title) VALUES (?, ?, ?)',
  );
  const insertControl = db.prepare(
    `INSERT INTO adhics_controls (family_id, code, title, tags, description, status)
     VALUES (?, ?, ?, '', '', 'not_assessed')`,
  );

  for (const domain of ADHICS_CATALOG_V2) {
    insertDomain.run(domain.code, domain.name);
    const domainId = Number(
      db.prepare('SELECT id FROM adhics_domains WHERE code = ?').get(domain.code)?.id,
    );
    for (const family of domain.families) {
      insertFamily.run(domainId, family.code, family.title);
      const familyId = Number(
        db
          .prepare('SELECT id FROM adhics_families WHERE domain_id = ? AND code = ?')
          .get(domainId, family.code)?.id,
      );
      for (const control of family.controls) {
        insertControl.run(familyId, control.code, control.title);
      }
    }
  }
}

function seedDummyScripts(db: AppDatabase): void {
  const count = Number(db.prepare('SELECT COUNT(*) AS n FROM assessment_scripts').get()?.n ?? 0);
  if (count > 0) {
    return;
  }
  const insertScript = db.prepare(
    `INSERT INTO assessment_scripts
      (control_id, name, runner, enabled, timeout_sec, body, last_result)
     VALUES (?, ?, 'winrm', 1, 30, ?, ?)`,
  );
  const insertFinding = db.prepare(
    `INSERT INTO findings (script_id, asset_id, title, severity, status)
     VALUES (?, NULL, ?, 'medium', 'open')`,
  );
  for (const script of DUMMY_ASSESSMENT_SCRIPTS) {
    const control = db.prepare('SELECT id FROM adhics_controls WHERE code = ?').get(script.controlCode);
    if (!control) {
      continue;
    }
    insertScript.run(Number(control.id), script.name, script.body, script.result);
    if (script.result !== 'fail') {
      continue;
    }
    const row = db
      .prepare('SELECT id FROM assessment_scripts WHERE control_id = ? AND name = ?')
      .get(Number(control.id), script.name);
    if (row) {
      insertFinding.run(Number(row.id), script.name);
    }
  }
  seedDummyBatch(db);
}

function seedDummyBatch(db: AppDatabase): void {
  const existing = Number(db.prepare('SELECT COUNT(*) AS n FROM assessment_batches').get()?.n ?? 0);
  if (existing > 0) {
    return;
  }
  const started = new Date().toISOString();
  const code = started.replace(/[-:TZ.]/g, '').slice(0, 14) + '-DEMO';
  db.prepare('INSERT INTO assessment_batches (code, started_at) VALUES (?, ?)').run(code, started);
  const batchId = Number(db.prepare('SELECT id FROM assessment_batches WHERE code = ?').get(code)?.id);
  const insert = db.prepare(
    `INSERT INTO assessment_results (batch_id, script_id, asset_id, result, created_at)
     VALUES (?, ?, NULL, ?, ?)`,
  );
  const scripts = db.prepare('SELECT id, last_result FROM assessment_scripts WHERE last_result IS NOT NULL').all();
  for (const script of scripts) {
    insert.run(batchId, Number(script.id), String(script.last_result), started);
  }
}

function seedAdhicsCatalog(db: AppDatabase): void {
  if (catalogVersion(db) === ADHICS_CATALOG_VERSION) {
    return;
  }
  const domainCount = Number(db.prepare('SELECT COUNT(*) AS n FROM adhics_domains').get()?.n ?? 0);
  if (domainCount === 0) {
    insertAdhicsCatalog(db);
    setCatalogVersion(db);
    return;
  }
  if (isOldDomain5Sample(db)) {
    clearAdhicsCatalog(db);
    insertAdhicsCatalog(db);
    setCatalogVersion(db);
    return;
  }
  setCatalogVersion(db);
}

export function runMigrations(db: AppDatabase): void {
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('administrator', 'user')),
      must_change_password INTEGER NOT NULL DEFAULT 0,
      totp_secret TEXT,
      totp_enabled INTEGER NOT NULL DEFAULT 0,
      full_name TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      contact TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      position TEXT NOT NULL DEFAULT ''
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

    CREATE TABLE IF NOT EXISTS company_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      contact TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      logo_file TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS adhics_domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS adhics_families (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain_id INTEGER NOT NULL REFERENCES adhics_domains(id),
      code TEXT NOT NULL,
      title TEXT NOT NULL,
      UNIQUE (domain_id, code)
    );

    CREATE TABLE IF NOT EXISTS adhics_controls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id INTEGER NOT NULL REFERENCES adhics_families(id),
      code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK (status IN ('mapped', 'gap', 'not_assessed'))
    );

    CREATE TABLE IF NOT EXISTS assessment_scripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      control_id INTEGER NOT NULL REFERENCES adhics_controls(id),
      name TEXT NOT NULL,
      runner TEXT NOT NULL CHECK (runner IN ('winrm', 'nmap')),
      enabled INTEGER NOT NULL DEFAULT 1,
      timeout_sec INTEGER NOT NULL DEFAULT 30,
      body TEXT NOT NULL DEFAULT '',
      last_result TEXT CHECK (last_result IN ('pass', 'fail'))
    );

    CREATE TABLE IF NOT EXISTS findings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      script_id INTEGER NOT NULL UNIQUE REFERENCES assessment_scripts(id),
      asset_id INTEGER REFERENCES assets(id),
      title TEXT NOT NULL,
      severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
      status TEXT NOT NULL CHECK (status IN ('open', 'acknowledged', 'closed'))
    );

    CREATE TABLE IF NOT EXISTS assessment_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      started_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assessment_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL REFERENCES assessment_batches(id),
      script_id INTEGER NOT NULL REFERENCES assessment_scripts(id),
      asset_id INTEGER REFERENCES assets(id),
      result TEXT NOT NULL CHECK (result IN ('pass', 'fail')),
      created_at TEXT NOT NULL
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

  const companyColumns = columnNames(db, 'company_profile');
  if (companyColumns.includes('id') && !companyColumns.includes('logo_file')) {
    db.exec(`ALTER TABLE company_profile ADD COLUMN logo_file TEXT NOT NULL DEFAULT '';`);
  }

  const userTable = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'`)
    .get() as { sql?: string } | undefined;
  if (userTable?.sql?.includes('it_support')) {
    db.exec(`
      CREATE TABLE users_rebuild (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('administrator', 'user'))
      );
      INSERT INTO users_rebuild (id, username, password_hash, role)
      SELECT id, username, password_hash,
        CASE WHEN role = 'it_support' THEN 'user' ELSE role END
      FROM users;
      DROP TABLE users;
      ALTER TABLE users_rebuild RENAME TO users;
    `);
  }

  const userColumns = columnNames(db, 'users');
  const addedPasswordFlag =
    userColumns.includes('id') && !userColumns.includes('must_change_password');
  if (addedPasswordFlag) {
    db.exec(
      'ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;',
    );
  }
  if (userColumns.includes('id') && !userColumns.includes('totp_secret')) {
    db.exec('ALTER TABLE users ADD COLUMN totp_secret TEXT;');
  }
  if (userColumns.includes('id') && !userColumns.includes('totp_enabled')) {
    db.exec('ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0;');
  }

  const latestUserColumns = columnNames(db, 'users');
  const profileColumns: Array<[string, string]> = [
    ['full_name', "ALTER TABLE users ADD COLUMN full_name TEXT NOT NULL DEFAULT '';"],
    ['address', "ALTER TABLE users ADD COLUMN address TEXT NOT NULL DEFAULT '';"],
    ['contact', "ALTER TABLE users ADD COLUMN contact TEXT NOT NULL DEFAULT '';"],
    ['email', "ALTER TABLE users ADD COLUMN email TEXT NOT NULL DEFAULT '';"],
    ['position', "ALTER TABLE users ADD COLUMN position TEXT NOT NULL DEFAULT '';"],
  ];
  for (const [name, sql] of profileColumns) {
    if (latestUserColumns.includes('id') && !latestUserColumns.includes(name)) {
      db.exec(sql);
    }
  }

  const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  if (!userCount || Number(userCount.n) === 0) {
    const insert = db.prepare(
      `INSERT INTO users (username, password_hash, role, must_change_password, totp_enabled)
       VALUES (?, ?, ?, ?, 0)`,
    );
    insert.run('admin', bcrypt.hashSync('Admin123!', 10), 'administrator', 1);
    insert.run('support', bcrypt.hashSync('Support123!', 10), 'user', 0);
  } else if (addedPasswordFlag) {
    db.prepare(
      `UPDATE users SET must_change_password = 1
       WHERE username = 'admin' AND IFNULL(totp_enabled, 0) = 0`,
    ).run();
  }

  const insertCategory = db.prepare(
    'INSERT OR IGNORE INTO categories (name, icon, builtin) VALUES (?, ?, 1)',
  );
  for (const category of SEED_CATEGORIES) {
    insertCategory.run(category.name, category.icon);
  }

  seedAdhicsCatalog(db);
  seedDummyScripts(db);
  seedDummyBatch(db);
  db.prepare(
    `UPDATE adhics_families
        SET title = ?
      WHERE code = 'CO 7'`,
  ).run('Security Assessment and Vulnerability Management');

  const companyRow = db.prepare('SELECT id FROM company_profile WHERE id = 1').get();
  if (!companyRow) {
    db.prepare(
      `INSERT INTO company_profile (id, name, address, contact, notes, updated_at)
       VALUES (1, ?, ?, ?, ?, ?)`,
    ).run(
      'Al Noor Dental Clinic',
      'Khalifa City, Abu Dhabi',
      'it@alnoordental.local',
      '',
      new Date().toISOString(),
    );
  }
}
