export type ScanHost = {
  ipAddress: string;
  status: 'up' | 'down';
  hostname: string | null;
};

export type AuthorizedScanError =
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_input'
  | 'not_authorized_range'
  | 'scan_in_progress'
  | 'scan_failed';

export type AuthorizedRangesResult =
  | { ok: true; ranges: string[] }
  | { ok: false; error: AuthorizedScanError };

export type AuthorizedScanResult =
  | {
      ok: true;
      target: string;
      hosts: ScanHost[];
      savedCount?: number;
    }
  | { ok: false; error: AuthorizedScanError };
