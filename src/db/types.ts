export type QueryParams = Record<string, unknown>;

export type QueryHeader = {
  affectedRows?: number;
};

export type DbClient = {
  engine: 'mysql' | 'sqlite';
  query: (
    sql: string,
    params?: QueryParams,
  ) => Promise<[unknown, QueryHeader?]>;
};
