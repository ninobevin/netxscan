import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';

const require = createRequire(__filename);

type RunResult = {
  changes: number;
  lastInsertRowid: number;
};

class Statement {
  constructor(
    private readonly engine: SqlJsDatabase,
    private readonly sql: string,
    private readonly persist: () => void,
  ) {}

  get(...params: unknown[]): Record<string, unknown> | undefined {
    const stmt = this.engine.prepare(this.sql);
    if (params.length > 0) {
      stmt.bind(params as (string | number | null | Uint8Array)[]);
    }
    const row = stmt.step() ? (stmt.getAsObject() as Record<string, unknown>) : undefined;
    stmt.free();
    return row;
  }

  all(...params: unknown[]): Record<string, unknown>[] {
    const stmt = this.engine.prepare(this.sql);
    if (params.length > 0) {
      stmt.bind(params as (string | number | null | Uint8Array)[]);
    }
    const rows: Record<string, unknown>[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as Record<string, unknown>);
    }
    stmt.free();
    return rows;
  }

  run(...params: unknown[]): RunResult {
    const stmt = this.engine.prepare(this.sql);
    if (params.length > 0) {
      stmt.bind(params as (string | number | null | Uint8Array)[]);
    }
    stmt.step();
    stmt.free();
    const changes = this.engine.getRowsModified();
    const idRows = this.engine.exec('SELECT last_insert_rowid() AS id');
    const lastInsertRowid = Number(idRows[0]?.values[0]?.[0] ?? 0);
    this.persist();
    return { changes, lastInsertRowid };
  }
}

export class AppDatabase {
  private inTransaction = false;

  constructor(
    private readonly engine: SqlJsDatabase,
    private readonly filePath: string,
  ) {}

  exec(sql: string): void {
    this.engine.exec(sql);
    this.persist();
  }

  prepare(sql: string): Statement {
    return new Statement(this.engine, sql, () => this.persist());
  }

  transaction<T, R>(fn: (items: T) => R): (items: T) => R {
    return (items: T) => {
      this.inTransaction = true;
      try {
        this.engine.run('BEGIN');
        const result = fn(items);
        this.engine.run('COMMIT');
        this.inTransaction = false;
        this.persist();
        return result;
      } catch (error) {
        try {
          this.engine.run('ROLLBACK');
        } catch {
          /* SQLite already aborted the transaction */
        }
        this.inTransaction = false;
        throw error;
      }
    };
  }

  persist(): void {
    if (this.inTransaction) {
      return;
    }
    const data = this.engine.export();
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, Buffer.from(data));
  }

  close(): void {
    this.inTransaction = false;
    this.persist();
    this.engine.close();
  }
}

let db: AppDatabase | null = null;

export function getDb(): AppDatabase {
  if (!db) {
    throw new Error('Database is not initialized.');
  }

  return db;
}

export async function initializeDatabase(filePath: string): Promise<AppDatabase> {
  const wasmPath = path.join(path.dirname(require.resolve('sql.js')), 'sql-wasm.wasm');
  const wasmBytes = fs.readFileSync(wasmPath);
  const SQL = await initSqlJs({
    wasmBinary: wasmBytes.buffer.slice(
      wasmBytes.byteOffset,
      wasmBytes.byteOffset + wasmBytes.byteLength,
    ),
  });

  const fileBuffer = fs.existsSync(filePath)
    ? new Uint8Array(fs.readFileSync(filePath))
    : undefined;
  const engine = new SQL.Database(fileBuffer);
  db = new AppDatabase(engine, filePath);
  db.persist();
  return db;
}

export function closeDatabase(): void {
  db?.close();
  db = null;
}
