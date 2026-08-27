export type AssessmentKind = 'assess' | 'remediate' | 'reverse';

export type AssessmentModule = {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  assessScript: string;
  remediationScript: string | null;
  reverseScript: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AssessmentResultRow = {
  assetId: string;
  moduleId: string;
  positive: boolean;
  summary: string | null;
  payloadJson: string | null;
  ranAt: string;
};

export type AssessmentHistoryRow = {
  id: string;
  assetId: string;
  moduleId: string;
  moduleName: string;
  kind: AssessmentKind;
  paramsJson: string | null;
  positive: boolean;
  summary: string | null;
  payloadJson: string | null;
  createdAt: string;
};

export type AssessmentError =
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_input'
  | 'not_found'
  | 'unavailable'
  | 'not_manageable'
  | 'not_authorized_range'
  | 'in_progress'
  | 'database_unavailable';

export type ModuleListResult =
  | { ok: true; modules: AssessmentModule[] }
  | { ok: false; error: AssessmentError };

export type ModuleItemResult =
  | { ok: true; module: AssessmentModule }
  | { ok: false; error: AssessmentError };

export type AssessRunResult =
  | {
      ok: true;
      positive: boolean;
      summary: string;
      payloadJson: string | null;
      historyId: string;
    }
  | { ok: false; error: AssessmentError };

export type HistoryListResult =
  | { ok: true; rows: AssessmentHistoryRow[] }
  | { ok: false; error: AssessmentError };

export type ResultGetResult =
  | { ok: true; result: AssessmentResultRow | null }
  | { ok: false; error: AssessmentError };
