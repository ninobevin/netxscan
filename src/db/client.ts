import { DatabaseSync } from 'node:sqlite';
import type { Pool } from 'mysql2/promise';
import type { DatabaseConfig } from './config';
import type { DbClient, QueryHeader, QueryParams } from './types';

let client: DbClient | undefined;
let mysqlPool: Pool | undefined;
let sqliteDb: DatabaseSync | undefined;

async function mysqlDriver() {
  const mod = await import('mysql2/promise');
  return mod.default ?? mod;
}

export async function initializeDatabase(
  config: DatabaseConfig,
): Promise<DbClient> {
  await closeDatabase();

  if (config.engine === 'sqlite') {
    client = createSqliteClient(config.filePath);
    return client;
  }

  const mysql = await mysqlDriver();

  const bootstrap = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
  });

  try {
    await bootstrap.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await bootstrap.end();
  }

  mysqlPool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: 5,
    namedPlaceholders: true,
  });

  const pool = mysqlPool;
  client = {
    engine: 'mysql',
    query: async (sql: string, params?: QueryParams) => {
      const [rows, extra] = await pool.query(
        sql,
        params as never,
      );
      return [rows, extra as QueryHeader];
    },
  };

  return client;
}

export function getDb(): DbClient {
  if (!client) {
    throw new Error('The database is not initialized.');
  }

  return client;
}

export async function closeDatabase(): Promise<void> {
  if (mysqlPool) {
    await mysqlPool.end();
    mysqlPool = undefined;
  }

  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = undefined;
  }

  client = undefined;
}

function createSqliteClient(filePath: string): DbClient {
  const db = new DatabaseSync(filePath);
  db.exec('PRAGMA foreign_keys = ON');
  sqliteDb = db;

  return {
    engine: 'sqlite',
    query: async (sql: string, params?: QueryParams) => {
      const trimmed = sql.trim();
      const isSelect = /^(SELECT|WITH|PRAGMA|SHOW)\b/i.test(trimmed);

      try {
        if (!params || Object.keys(params).length === 0) {
          if (isSelect) {
            return [db.prepare(trimmed).all() as unknown];
          }

          db.exec(trimmed);
          return [{ affectedRows: 0 }];
        }

        const statement = db.prepare(trimmed);
        const bound = bindSqliteParams(params);

        if (isSelect) {
          return [statement.all(bound as never) as unknown];
        }

        const result = statement.run(bound as never);
        return [{ affectedRows: Number(result.changes) }];
      } catch (error) {
        throw mapSqliteError(error);
      }
    },
  };
}

function bindSqliteParams(params: QueryParams): QueryParams {
  const bound: QueryParams = {};

  for (const [key, value] of Object.entries(params)) {
    const next = value === undefined ? null : value;
    bound[key] = next;
    bound[`:${key}`] = next;
  }

  return bound;
}

function mapSqliteError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  const mapped = new Error(message) as Error & { code?: string };

  if (/unique/i.test(message)) {
    mapped.code = 'ER_DUP_ENTRY';
    return mapped;
  }

  if (error && typeof error === 'object' && 'code' in error) {
    mapped.code = String(error.code);
  }

  return mapped;
}
