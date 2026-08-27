export type FindingCell = {
  status: string | null;
  detail: string;
  cveIds: string[];
};

export type FindingsMatrix = {
  checks: Array<{ id: string; title: string }>;
  hosts: Array<{ id: string; hostname: string; ipAddress: string | null }>;
  cells: Record<string, Record<string, FindingCell>>;
};

export type FindingsMatrixResult =
  | { ok: true; matrix: FindingsMatrix }
  | {
      ok: false;
      error:
        | 'unauthorized'
        | 'forbidden'
        | 'database_unavailable';
    };
