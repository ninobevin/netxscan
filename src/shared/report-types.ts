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

export type ReportSaveResult =
  | { ok: true; path: string }
  | { ok: true; cancelled: true }
  | { ok: false; error: string };
