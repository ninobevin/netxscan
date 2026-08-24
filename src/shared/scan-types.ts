export type DiscoveredPort = {
  port: number;
  protocol: string;
  serviceName: string | null;
  product: string | null;
  version: string | null;
};

export type NmapHost = {
  ipAddress: string;
  status: 'up' | 'down' | 'unknown';
  hostname: string | null;
  macAddress: string | null;
  ports: DiscoveredPort[];
};

export type AuthorizedScanError =
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_input'
  | 'not_authorized_range'
  | 'nmap_missing'
  | 'scan_in_progress'
  | 'scan_failed'
  | 'timeout';

export type AuthorizedRangesResult =
  | { ok: true; ranges: string[] }
  | { ok: false; error: AuthorizedScanError };

export type AuthorizedScanResult =
  | {
      ok: true;
      target: string;
      hosts: NmapHost[];
      savedCount?: number;
    }
  | { ok: false; error: AuthorizedScanError };
