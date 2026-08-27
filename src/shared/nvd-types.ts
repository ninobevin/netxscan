export type NvdCpeRange = {
  criteria: string;
  vulnerable: boolean;
  versionStartIncluding?: string;
  versionStartExcluding?: string;
  versionEndIncluding?: string;
  versionEndExcluding?: string;
};

export type SoftwareCveHit = {
  productName: string;
  productVersion: string;
  cveId: string;
  cvss: number | null;
  severity: string;
  cpe23: string;
  detail: string;
};

export type NvdStatus = {
  hasApiKey: boolean;
  apiKeyTail: string | null;
  lastSyncAt: string | null;
  lastSyncSummary: string | null;
  cpeCount: number;
  cveCount: number;
};

export type NvdStatusResult =
  | { ok: true; status: NvdStatus }
  | { ok: false; error: 'unauthorized' | 'forbidden' };

export type NvdSaveKeyResult =
  | { ok: true; status: NvdStatus }
  | { ok: false; error: 'unauthorized' | 'forbidden' | 'invalid_input' };

export type NvdSyncResult =
  | {
      ok: true;
      status: NvdStatus;
      products: number;
      cpes: number;
      cves: number;
    }
  | {
      ok: false;
      error:
        | 'unauthorized'
        | 'forbidden'
        | 'sync_in_progress'
        | 'nvd_unavailable'
        | 'no_software';
    };

export type SoftwareCveHitsResult =
  | { ok: true; hits: SoftwareCveHit[] }
  | { ok: false; error: 'unauthorized' | 'forbidden' | 'invalid_input' };
