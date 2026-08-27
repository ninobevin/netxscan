export type NmapPortRow = {
  port: number;
  protocol: string;
  state: string;
  service: string | null;
  product: string | null;
  version: string | null;
  scripts: Array<{ id: string; output: string }>;
};

export type NmapSslRow = {
  port: number;
  cert: string | null;
  ciphers: string | null;
};

export type NmapProtocolPayload = {
  ipAddress: string;
  hostname: string;
  ranAt: string;
  ports: NmapPortRow[];
  ssl: NmapSslRow[];
  smbShares: string | null;
  smbSecurityMode: string | null;
  notes: string[];
};

export type NmapProtocolResult =
  | { ok: true; result: NmapProtocolPayload | null }
  | {
      ok: false;
      error:
        | 'unauthorized'
        | 'forbidden'
        | 'invalid_input'
        | 'not_found'
        | 'not_authorized_range'
        | 'nmap_missing'
        | 'scan_in_progress'
        | 'scan_failed'
        | 'unavailable';
    };
