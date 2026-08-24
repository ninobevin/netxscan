export const REPORT_KINDS = [
  'assets',
  'findings',
  'assessments',
  'scans',
  'remediation',
  'audit',
] as const;

export type ReportKind = (typeof REPORT_KINDS)[number];

export type ReportError =
  | 'unauthorized'
  | 'invalid_input'
  | 'cancelled'
  | 'database_unavailable'
  | 'export_failed';

export type ReportPreviewResult =
  | { ok: true; kind: ReportKind; title: string; html: string }
  | { ok: false; error: ReportError };

export type ReportExportResult =
  | { ok: true; path: string }
  | { ok: false; error: ReportError };
