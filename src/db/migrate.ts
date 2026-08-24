import type { DbClient } from './types';

type Migration = {
  name: string;
  mysql: string | null;
  sqlite: string | null;
};

const migrations: Migration[] = [
  {
    name: '001_users',
    mysql: `
      CREATE TABLE IF NOT EXISTS users (
        id CHAR(36) NOT NULL,
        username VARCHAR(128) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(32) NOT NULL,
        failed_login_count INT NOT NULL DEFAULT 0,
        locked_until BIGINT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY users_username_unique (username)
      )
    `,
    sqlite: `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT NOT NULL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        failed_login_count INTEGER NOT NULL DEFAULT 0,
        locked_until INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
  },
  {
    name: '002_assets',
    mysql: `
      CREATE TABLE IF NOT EXISTS assets (
        id CHAR(36) NOT NULL,
        hostname VARCHAR(128) NOT NULL,
        ip_address VARCHAR(45) NULL,
        mac_address VARCHAR(32) NULL,
        asset_type VARCHAR(32) NOT NULL,
        notes VARCHAR(1000) NULL,
        archived_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY assets_ip_address_unique (ip_address)
      )
    `,
    sqlite: `
      CREATE TABLE IF NOT EXISTS assets (
        id TEXT NOT NULL PRIMARY KEY,
        hostname TEXT NOT NULL,
        ip_address TEXT UNIQUE,
        mac_address TEXT,
        asset_type TEXT NOT NULL,
        notes TEXT,
        archived_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
  },
  {
    name: '003_asset_services',
    mysql: `
      CREATE TABLE IF NOT EXISTS asset_services (
        id CHAR(36) NOT NULL,
        asset_id CHAR(36) NOT NULL,
        port INT NOT NULL,
        protocol VARCHAR(8) NOT NULL,
        service_name VARCHAR(64) NULL,
        product VARCHAR(128) NULL,
        version VARCHAR(64) NULL,
        PRIMARY KEY (id),
        KEY asset_services_asset_id (asset_id),
        CONSTRAINT asset_services_asset_fk
          FOREIGN KEY (asset_id) REFERENCES assets (id)
      )
    `,
    sqlite: `
      CREATE TABLE IF NOT EXISTS asset_services (
        id TEXT NOT NULL PRIMARY KEY,
        asset_id TEXT NOT NULL,
        port INTEGER NOT NULL,
        protocol TEXT NOT NULL,
        service_name TEXT,
        product TEXT,
        version TEXT,
        FOREIGN KEY (asset_id) REFERENCES assets (id)
      );
      CREATE INDEX IF NOT EXISTS asset_services_asset_id ON asset_services (asset_id)
    `,
  },
  {
    name: '004_asset_assessments',
    mysql: `
      CREATE TABLE IF NOT EXISTS asset_assessments (
        id CHAR(36) NOT NULL,
        asset_id CHAR(36) NOT NULL,
        tls_json TEXT NOT NULL,
        smb_json TEXT NOT NULL,
        notes VARCHAR(500) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY asset_assessments_asset_id (asset_id),
        CONSTRAINT asset_assessments_asset_fk
          FOREIGN KEY (asset_id) REFERENCES assets (id)
      )
    `,
    sqlite: `
      CREATE TABLE IF NOT EXISTS asset_assessments (
        id TEXT NOT NULL PRIMARY KEY,
        asset_id TEXT NOT NULL,
        tls_json TEXT NOT NULL,
        smb_json TEXT NOT NULL,
        notes TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (asset_id) REFERENCES assets (id)
      );
      CREATE INDEX IF NOT EXISTS asset_assessments_asset_id ON asset_assessments (asset_id)
    `,
  },
  {
    name: '005_windows_assessments',
    mysql: `
      CREATE TABLE IF NOT EXISTS windows_assessments (
        id CHAR(36) NOT NULL,
        asset_id CHAR(36) NOT NULL,
        facts_json TEXT NOT NULL,
        notes VARCHAR(500) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY windows_assessments_asset_id (asset_id),
        CONSTRAINT windows_assessments_asset_fk
          FOREIGN KEY (asset_id) REFERENCES assets (id)
      )
    `,
    sqlite: `
      CREATE TABLE IF NOT EXISTS windows_assessments (
        id TEXT NOT NULL PRIMARY KEY,
        asset_id TEXT NOT NULL,
        facts_json TEXT NOT NULL,
        notes TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (asset_id) REFERENCES assets (id)
      );
      CREATE INDEX IF NOT EXISTS windows_assessments_asset_id ON windows_assessments (asset_id)
    `,
  },
  {
    name: '006_windows_facts_mediumtext',
    mysql: `
      ALTER TABLE windows_assessments
        MODIFY facts_json MEDIUMTEXT NOT NULL
    `,
    sqlite: null,
  },
  {
    name: '007_cves',
    mysql: `
      CREATE TABLE IF NOT EXISTS cves (
        cve_id VARCHAR(32) NOT NULL,
        title VARCHAR(512) NOT NULL,
        description TEXT NOT NULL,
        severity VARCHAR(16) NOT NULL,
        cvss_score DECIMAL(3,1) NULL,
        published_at VARCHAR(32) NULL,
        products_json TEXT NOT NULL,
        source VARCHAR(16) NOT NULL,
        imported_at DATETIME NOT NULL,
        PRIMARY KEY (cve_id)
      )
    `,
    sqlite: `
      CREATE TABLE IF NOT EXISTS cves (
        cve_id TEXT NOT NULL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        severity TEXT NOT NULL,
        cvss_score REAL,
        published_at TEXT,
        products_json TEXT NOT NULL,
        source TEXT NOT NULL,
        imported_at TEXT NOT NULL
      )
    `,
  },
  {
    name: '008_cve_imports',
    mysql: `
      CREATE TABLE IF NOT EXISTS cve_imports (
        id CHAR(36) NOT NULL,
        source VARCHAR(16) NOT NULL,
        imported_count INT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `,
    sqlite: `
      CREATE TABLE IF NOT EXISTS cve_imports (
        id TEXT NOT NULL PRIMARY KEY,
        source TEXT NOT NULL,
        imported_count INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
  },
  {
    name: '009_correlation_runs',
    mysql: `
      CREATE TABLE IF NOT EXISTS correlation_runs (
        id CHAR(36) NOT NULL,
        match_count INT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `,
    sqlite: `
      CREATE TABLE IF NOT EXISTS correlation_runs (
        id TEXT NOT NULL PRIMARY KEY,
        match_count INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
  },
  {
    name: '010_correlation_matches',
    mysql: `
      CREATE TABLE IF NOT EXISTS correlation_matches (
        id CHAR(36) NOT NULL,
        run_id CHAR(36) NOT NULL,
        asset_id CHAR(36) NOT NULL,
        cve_id VARCHAR(32) NOT NULL,
        title VARCHAR(512) NOT NULL,
        severity VARCHAR(16) NOT NULL,
        evidence TEXT NOT NULL,
        recommendation VARCHAR(1000) NOT NULL,
        PRIMARY KEY (id),
        KEY correlation_matches_run_id (run_id),
        CONSTRAINT correlation_matches_run_fk
          FOREIGN KEY (run_id) REFERENCES correlation_runs (id),
        CONSTRAINT correlation_matches_asset_fk
          FOREIGN KEY (asset_id) REFERENCES assets (id)
      )
    `,
    sqlite: `
      CREATE TABLE IF NOT EXISTS correlation_matches (
        id TEXT NOT NULL PRIMARY KEY,
        run_id TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        cve_id TEXT NOT NULL,
        title TEXT NOT NULL,
        severity TEXT NOT NULL,
        evidence TEXT NOT NULL,
        recommendation TEXT NOT NULL,
        FOREIGN KEY (run_id) REFERENCES correlation_runs (id),
        FOREIGN KEY (asset_id) REFERENCES assets (id)
      )
    `,
  },
  {
    name: '011_correlation_matches_index',
    mysql: null,
    sqlite: `
      CREATE INDEX IF NOT EXISTS correlation_matches_run_id
        ON correlation_matches (run_id)
    `,
  },
  {
    name: '012_findings',
    mysql: `
      CREATE TABLE IF NOT EXISTS findings (
        id CHAR(36) NOT NULL,
        asset_id CHAR(36) NOT NULL,
        cve_id VARCHAR(32) NOT NULL,
        title VARCHAR(512) NOT NULL,
        description TEXT NOT NULL,
        severity VARCHAR(16) NOT NULL,
        source VARCHAR(16) NOT NULL,
        evidence TEXT NOT NULL,
        recommendation VARCHAR(1000) NOT NULL,
        status VARCHAR(32) NOT NULL,
        notes VARCHAR(2000) NOT NULL,
        first_detected DATETIME NOT NULL,
        last_detected DATETIME NOT NULL,
        resolved_at DATETIME NULL,
        PRIMARY KEY (id),
        UNIQUE KEY findings_asset_cve (asset_id, cve_id),
        KEY findings_status (status),
        CONSTRAINT findings_asset_fk
          FOREIGN KEY (asset_id) REFERENCES assets (id)
      )
    `,
    sqlite: `
      CREATE TABLE IF NOT EXISTS findings (
        id TEXT NOT NULL PRIMARY KEY,
        asset_id TEXT NOT NULL,
        cve_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        severity TEXT NOT NULL,
        source TEXT NOT NULL,
        evidence TEXT NOT NULL,
        recommendation TEXT NOT NULL,
        status TEXT NOT NULL,
        notes TEXT NOT NULL,
        first_detected TEXT NOT NULL,
        last_detected TEXT NOT NULL,
        resolved_at TEXT,
        UNIQUE(asset_id, cve_id),
        FOREIGN KEY (asset_id) REFERENCES assets (id)
      )
    `,
  },
  {
    name: '013_findings_status_index',
    mysql: null,
    sqlite: `
      CREATE INDEX IF NOT EXISTS findings_status ON findings (status)
    `,
  },
  {
    name: '014_scan_history',
    mysql: `
      CREATE TABLE IF NOT EXISTS scan_history (
        id CHAR(36) NOT NULL,
        kind VARCHAR(16) NOT NULL,
        target VARCHAR(64) NOT NULL,
        up_count INT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `,
    sqlite: `
      CREATE TABLE IF NOT EXISTS scan_history (
        id TEXT NOT NULL PRIMARY KEY,
        kind TEXT NOT NULL,
        target TEXT NOT NULL,
        up_count INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
  },
  {
    name: '015_assets_last_seen_scan',
    mysql: `
      ALTER TABLE assets
        ADD COLUMN last_seen_scan_id CHAR(36) NULL
    `,
    sqlite: `
      ALTER TABLE assets
        ADD COLUMN last_seen_scan_id TEXT
    `,
  },
  {
    name: '016_audit_log',
    mysql: `
      CREATE TABLE IF NOT EXISTS audit_log (
        id CHAR(36) NOT NULL,
        username VARCHAR(128) NOT NULL,
        action VARCHAR(64) NOT NULL,
        detail VARCHAR(500) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY audit_log_created_at (created_at)
      )
    `,
    sqlite: `
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT NOT NULL PRIMARY KEY,
        username TEXT NOT NULL,
        action TEXT NOT NULL,
        detail TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
  },
  {
    name: '017_assessment_notes_text',
    mysql: `
      ALTER TABLE asset_assessments
        MODIFY notes TEXT NOT NULL
    `,
    sqlite: null,
  },
];

export async function runMigrations(db: DbClient): Promise<void> {
  if (db.engine === 'sqlite') {
    await db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT NOT NULL PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } else {
    await db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name VARCHAR(255) NOT NULL,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (name)
      )
    `);
  }

  const [rows] = await db.query('SELECT name FROM schema_migrations');
  const applied = new Set(
    (rows as Array<{ name: string }>).map((row) => row.name),
  );

  for (const migration of migrations) {
    if (applied.has(migration.name)) {
      continue;
    }

    const sql = db.engine === 'sqlite' ? migration.sqlite : migration.mysql;

    if (sql) {
      await db.query(sql);
    }

    await db.query('INSERT INTO schema_migrations (name) VALUES (:name)', {
      name: migration.name,
    });
  }
}
