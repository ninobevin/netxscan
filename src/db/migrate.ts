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
  {
    name: '018_asset_location',
    mysql: `
      ALTER TABLE assets
        ADD COLUMN location VARCHAR(128) NULL
    `,
    sqlite: `
      ALTER TABLE assets ADD COLUMN location TEXT
    `,
  },
  {
    name: '019_locations',
    mysql: `
      CREATE TABLE IF NOT EXISTS locations (
        id CHAR(36) NOT NULL,
        name VARCHAR(128) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY locations_name_unique (name)
      )
    `,
    sqlite: `
      CREATE TABLE IF NOT EXISTS locations (
        id TEXT NOT NULL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
  },
  {
    name: '020_asset_winrm_manageable',
    mysql: `
      ALTER TABLE assets
        ADD COLUMN winrm_manageable TINYINT NULL,
        ADD COLUMN winrm_checked_at DATETIME NULL,
        ADD COLUMN winrm_detail VARCHAR(500) NULL
    `,
    sqlite: `
      ALTER TABLE assets ADD COLUMN winrm_manageable INTEGER
    `,
  },
  {
    name: '021_asset_winrm_checked_at',
    mysql: null,
    sqlite: `
      ALTER TABLE assets ADD COLUMN winrm_checked_at TEXT
    `,
  },
  {
    name: '022_asset_winrm_detail',
    mysql: null,
    sqlite: `
      ALTER TABLE assets ADD COLUMN winrm_detail TEXT
    `,
  },
  {
    name: '023_asset_groups',
    mysql: `
      CREATE TABLE IF NOT EXISTS asset_groups (
        id CHAR(36) NOT NULL,
        name VARCHAR(128) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY asset_groups_name_unique (name)
      )
    `,
    sqlite: `
      CREATE TABLE IF NOT EXISTS asset_groups (
        id TEXT NOT NULL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
  },
  {
    name: '024_asset_group_column',
    mysql: `
      ALTER TABLE assets
        ADD COLUMN asset_group VARCHAR(128) NULL
    `,
    sqlite: `
      ALTER TABLE assets ADD COLUMN asset_group TEXT
    `,
  },
  {
    name: '025_assessment_modules',
    mysql: `
      CREATE TABLE IF NOT EXISTS assessment_modules (
        id CHAR(36) NOT NULL,
        slug VARCHAR(64) NULL,
        name VARCHAR(128) NOT NULL,
        description VARCHAR(500) NULL,
        assess_script MEDIUMTEXT NOT NULL,
        remediation_script MEDIUMTEXT NULL,
        reverse_script MEDIUMTEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY assessment_modules_slug_unique (slug)
      )
    `,
    sqlite: `
      CREATE TABLE IF NOT EXISTS assessment_modules (
        id TEXT NOT NULL PRIMARY KEY,
        slug TEXT UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        assess_script TEXT NOT NULL,
        remediation_script TEXT,
        reverse_script TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
  },
  {
    name: '026_assessment_results',
    mysql: `
      CREATE TABLE IF NOT EXISTS assessment_results (
        asset_id CHAR(36) NOT NULL,
        module_id CHAR(36) NOT NULL,
        positive TINYINT NOT NULL,
        summary VARCHAR(500) NULL,
        payload_json MEDIUMTEXT NULL,
        ran_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (asset_id, module_id)
      )
    `,
    sqlite: `
      CREATE TABLE IF NOT EXISTS assessment_results (
        asset_id TEXT NOT NULL,
        module_id TEXT NOT NULL,
        positive INTEGER NOT NULL,
        summary TEXT,
        payload_json TEXT,
        ran_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (asset_id, module_id)
      )
    `,
  },
  {
    name: '027_assessment_history',
    mysql: `
      CREATE TABLE IF NOT EXISTS assessment_history (
        id CHAR(36) NOT NULL,
        asset_id CHAR(36) NOT NULL,
        module_id CHAR(36) NOT NULL,
        kind VARCHAR(16) NOT NULL,
        params_json VARCHAR(1000) NULL,
        positive TINYINT NOT NULL,
        summary VARCHAR(500) NULL,
        payload_json MEDIUMTEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY assessment_history_asset (asset_id, created_at)
      )
    `,
    sqlite: `
      CREATE TABLE IF NOT EXISTS assessment_history (
        id TEXT NOT NULL PRIMARY KEY,
        asset_id TEXT NOT NULL,
        module_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        params_json TEXT,
        positive INTEGER NOT NULL,
        summary TEXT,
        payload_json TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
  },
  {
    name: '028_baseline_findings',
    mysql: `
      CREATE TABLE IF NOT EXISTS baseline_findings (
        asset_id CHAR(36) NOT NULL,
        check_id VARCHAR(80) NOT NULL,
        status VARCHAR(8) NOT NULL,
        detail VARCHAR(500) NULL,
        collected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (asset_id, check_id)
      )
    `,
    sqlite: `
      CREATE TABLE IF NOT EXISTS baseline_findings (
        asset_id TEXT NOT NULL,
        check_id TEXT NOT NULL,
        status TEXT NOT NULL,
        detail TEXT,
        collected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (asset_id, check_id)
      )
    `,
  },
  {
    name: '029_nmap_scan_results',
    mysql: `
      CREATE TABLE IF NOT EXISTS nmap_scan_results (
        asset_id CHAR(36) NOT NULL,
        payload_json MEDIUMTEXT NOT NULL,
        ran_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (asset_id)
      )
    `,
    sqlite: `
      CREATE TABLE IF NOT EXISTS nmap_scan_results (
        asset_id TEXT NOT NULL PRIMARY KEY,
        payload_json TEXT NOT NULL,
        ran_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
  },
  {
    name: '030_nvd_meta',
    mysql: `
      CREATE TABLE IF NOT EXISTS nvd_meta (
        name VARCHAR(64) NOT NULL,
        value VARCHAR(500) NOT NULL,
        PRIMARY KEY (name)
      )
    `,
    sqlite: `
      CREATE TABLE IF NOT EXISTS nvd_meta (
        name TEXT NOT NULL PRIMARY KEY,
        value TEXT NOT NULL
      )
    `,
  },
  {
    name: '031_cpe_cache',
    mysql: `
      CREATE TABLE IF NOT EXISTS cpe_cache (
        keyword VARCHAR(80) NOT NULL,
        cpe23 VARCHAR(255) NOT NULL,
        cpe_prefix VARCHAR(160) NOT NULL,
        title VARCHAR(255) NOT NULL,
        vendor VARCHAR(80) NOT NULL,
        product VARCHAR(80) NOT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (keyword)
      )
    `,
    sqlite: `
      CREATE TABLE IF NOT EXISTS cpe_cache (
        keyword TEXT NOT NULL PRIMARY KEY,
        cpe23 TEXT NOT NULL,
        cpe_prefix TEXT NOT NULL,
        title TEXT NOT NULL,
        vendor TEXT NOT NULL,
        product TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
  },
  {
    name: '032_nvd_cves',
    mysql: `
      CREATE TABLE IF NOT EXISTS nvd_cves (
        cve_id VARCHAR(32) NOT NULL,
        description TEXT NOT NULL,
        severity VARCHAR(16) NOT NULL,
        cvss_score DECIMAL(3,1) NULL,
        imported_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (cve_id)
      )
    `,
    sqlite: `
      CREATE TABLE IF NOT EXISTS nvd_cves (
        cve_id TEXT NOT NULL PRIMARY KEY,
        description TEXT NOT NULL,
        severity TEXT NOT NULL,
        cvss_score REAL,
        imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
  },
  {
    name: '033_nvd_cve_matches',
    mysql: `
      CREATE TABLE IF NOT EXISTS nvd_cve_matches (
        id BIGINT NOT NULL AUTO_INCREMENT,
        cve_id VARCHAR(32) NOT NULL,
        vendor VARCHAR(80) NOT NULL,
        product VARCHAR(80) NOT NULL,
        criteria VARCHAR(255) NOT NULL,
        vulnerable TINYINT NOT NULL,
        version_start_inc VARCHAR(64) NULL,
        version_start_exc VARCHAR(64) NULL,
        version_end_inc VARCHAR(64) NULL,
        version_end_exc VARCHAR(64) NULL,
        PRIMARY KEY (id),
        KEY nvd_cve_matches_product (vendor, product),
        KEY nvd_cve_matches_cve (cve_id)
      )
    `,
    sqlite: `
      CREATE TABLE IF NOT EXISTS nvd_cve_matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cve_id TEXT NOT NULL,
        vendor TEXT NOT NULL,
        product TEXT NOT NULL,
        criteria TEXT NOT NULL,
        vulnerable INTEGER NOT NULL,
        version_start_inc TEXT,
        version_start_exc TEXT,
        version_end_inc TEXT,
        version_end_exc TEXT
      )
    `,
  },
  {
    name: '034_nvd_cve_matches_index',
    mysql: null,
    sqlite: `
      CREATE INDEX IF NOT EXISTS nvd_cve_matches_product
        ON nvd_cve_matches (vendor, product)
    `,
  },
  {
    name: '035_software_cve_hits',
    mysql: `
      CREATE TABLE IF NOT EXISTS software_cve_hits (
        asset_id CHAR(36) NOT NULL,
        product_name VARCHAR(191) NOT NULL,
        product_version VARCHAR(64) NOT NULL,
        cve_id VARCHAR(32) NOT NULL,
        cvss_score DECIMAL(3,1) NULL,
        severity VARCHAR(16) NOT NULL,
        cpe23 VARCHAR(255) NOT NULL,
        detail VARCHAR(500) NOT NULL,
        collected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (asset_id, product_name, product_version, cve_id)
      )
    `,
    sqlite: `
      CREATE TABLE IF NOT EXISTS software_cve_hits (
        asset_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        product_version TEXT NOT NULL,
        cve_id TEXT NOT NULL,
        cvss_score REAL,
        severity TEXT NOT NULL,
        cpe23 TEXT NOT NULL,
        detail TEXT NOT NULL,
        collected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (asset_id, product_name, product_version, cve_id)
      )
    `,
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
