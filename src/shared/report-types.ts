export type ReportKind = 'assets' | 'findings' | 'compliance';

export type AssetListColumn = 'hostname' | 'macAddress' | 'device' | 'ipv4' | 'location';

export const ASSET_LIST_COLUMNS: Array<{ id: AssetListColumn; label: string }> = [
  { id: 'hostname', label: 'Hostname' },
  { id: 'macAddress', label: 'MAC address' },
  { id: 'device', label: 'Device type' },
  { id: 'ipv4', label: 'IP address' },
  { id: 'location', label: 'Location' },
];

export type AssessmentBatch = {
  id: number;
  code: string;
  startedAt: string;
};

export type ReportTableColumn = {
  key: string;
  label: string;
};

export type ReportPreviewSection = {
  heading: string;
  columns: ReportTableColumn[];
  rows: Array<Record<string, string>>;
};

export type ReportPreview = {
  kind: ReportKind;
  title: string;
  subtitle: string;
  showSignature: boolean;
  preparedBy: {
    fullName: string;
    position: string;
  };
  sections: ReportPreviewSection[];
};

export type ReportQuery = {
  kind: ReportKind;
  locationId?: number | null;
  categoryId?: number | null;
  columns?: AssetListColumn[];
  batchId?: number | null;
  outcome?: 'fail' | 'pass';
  status?: 'all' | 'open' | 'acknowledged' | 'closed';
};

export type ReportPreviewResult =
  | { ok: true; preview: ReportPreview }
  | { ok: false; error: string };

export type BatchListResult =
  | { ok: true; batches: AssessmentBatch[] }
  | { ok: false; error: string };

export type ReportSaveResult =
  | { ok: true; path: string }
  | { ok: true; cancelled: true }
  | { ok: false; error: string };

export type ReportUnitRow = {
  hostname: string;
  ipv4: string;
  device: string;
  location: string;
  findings: string;
};

export type ReportControlSection = {
  controlId: string;
  title: string;
  units: ReportUnitRow[];
};

export type ReportDomainSection = {
  domain: string;
  controls: ReportControlSection[];
};
