import type { ReportDomainSection } from './report-types';

export type ControlStatus = 'mapped' | 'gap' | 'not_assessed';
export type ScriptRunner = 'winrm' | 'nmap';
export type ScriptResult = 'pass' | 'fail';
export type FindingStatus = 'open' | 'acknowledged' | 'closed';
export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low';

export type AdhicsScript = {
  id: number;
  controlId: number;
  controlCode: string;
  name: string;
  runner: ScriptRunner;
  enabled: boolean;
  timeoutSec: number;
  body: string;
  lastResult: ScriptResult | null;
};

export type AdhicsControl = {
  id: number;
  familyId: number;
  code: string;
  title: string;
  tags: string;
  description: string;
  status: ControlStatus;
  scriptCount: number;
  findingCount: number;
  scripts: AdhicsScript[];
};

export type AdhicsFamily = {
  id: number;
  domainId: number;
  code: string;
  title: string;
  controls: AdhicsControl[];
};

export type AdhicsDomain = {
  id: number;
  code: string;
  name: string;
  families: AdhicsFamily[];
};

export type AdhicsFinding = {
  id: number;
  scriptId: number;
  controlId: number;
  controlCode: string;
  domainLabel: string;
  title: string;
  severity: FindingSeverity;
  status: FindingStatus;
  assetId: number | null;
  hostname: string | null;
  ipv4: string | null;
  description: string;
};

export type OkError = { ok: true } | { ok: false; error: string };

export type AdhicsTreeResult =
  | { ok: true; domains: AdhicsDomain[] }
  | { ok: false; error: string };

export type AdhicsScriptListResult =
  | { ok: true; scripts: AdhicsScript[] }
  | { ok: false; error: string };

export type AdhicsFindingListResult =
  | { ok: true; findings: AdhicsFinding[] }
  | { ok: false; error: string };

export type AdhicsReportResult =
  | { ok: true; domains: ReportDomainSection[] }
  | { ok: false; error: string };

export type LeafControlOption = {
  id: number;
  code: string;
  title: string;
  domainLabel: string;
};
