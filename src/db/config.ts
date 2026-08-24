import path from 'node:path';

export type MysqlDatabaseConfig = {
  engine: 'mysql';
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

export type SqliteDatabaseConfig = {
  engine: 'sqlite';
  filePath: string;
};

export type DatabaseConfig = MysqlDatabaseConfig | SqliteDatabaseConfig;

const SQLITE_FILE = /^[A-Za-z0-9._-]+\.sqlite$/;

function parseMysql(record: Record<string, unknown>): MysqlDatabaseConfig {
  const host = record.host;
  const port = record.port;
  const user = record.user;
  const password = record.password;
  const database = record.database;

  const portValue =
    typeof port === 'string' && /^\d+$/.test(port) ? Number(port) : port;
  const passwordValue = password === undefined ? '' : password;

  if (
    typeof host !== 'string' ||
    host.length === 0 ||
    typeof portValue !== 'number' ||
    !Number.isInteger(portValue) ||
    portValue < 1 ||
    portValue > 65535 ||
    typeof user !== 'string' ||
    user.length === 0 ||
    typeof passwordValue !== 'string' ||
    typeof database !== 'string' ||
    !/^[A-Za-z0-9_]+$/.test(database)
  ) {
    throw new Error('Database configuration is invalid.');
  }

  return {
    engine: 'mysql',
    host,
    port: portValue,
    user,
    password: passwordValue,
    database,
  };
}

export function parseDatabaseConfig(
  value: unknown,
  userDataDir: string,
): DatabaseConfig {
  if (!value || typeof value !== 'object') {
    throw new Error('Database configuration is invalid.');
  }

  const record = value as Record<string, unknown>;
  const engine = record.engine;
  const host = record.host;
  const useSqlite =
    engine === 'sqlite' ||
    (engine === undefined && (typeof host !== 'string' || host.length === 0));

  if (useSqlite) {
    const file =
      record.file === undefined || record.file === null
        ? 'netxscan.sqlite'
        : record.file;

    if (typeof file !== 'string' || !SQLITE_FILE.test(file)) {
      throw new Error('Database configuration is invalid.');
    }

    return {
      engine: 'sqlite',
      filePath: path.join(userDataDir, file),
    };
  }

  if (engine !== undefined && engine !== 'mysql') {
    throw new Error('Database configuration is invalid.');
  }

  return parseMysql(record);
}
