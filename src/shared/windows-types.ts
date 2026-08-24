export type WindowsDisk = {
  device: string;
  sizeGb: number | null;
  freeGb: number | null;
};

export type WindowsSoftware = {
  name: string;
  version: string | null;
  key: string | null;
  canUninstall: boolean;
};

export type WindowsUpdate = {
  id: string;
  installedOn: string | null;
};

export type WindowsFirewall = {
  name: string;
  enabled: boolean | null;
};

export type WindowsFacts = {
  hostname: string | null;
  ipAddresses: string[];
  operatingSystem: string | null;
  osVersion: string | null;
  domain: string | null;
  cpu: string | null;
  ramGb: number | null;
  disks: WindowsDisk[];
  software: WindowsSoftware[];
  updates: WindowsUpdate[];
  firewall: WindowsFirewall[];
  defenderEnabled: boolean | null;
  defenderRealtime: boolean | null;
  bitlocker: Array<{ mountPoint: string; protection: string | null }>;
};

export type WindowsAssessment = {
  id: string;
  assetId: string;
  facts: WindowsFacts;
  notes: string;
  createdAt: string;
};

export type WindowsAssessmentError =
  | 'unauthorized'
  | 'forbidden'
  | 'not_authorized_range'
  | 'powershell_failed'
  | 'winrm_failed'
  | 'timeout'
  | 'scan_in_progress'
  | 'database_unavailable'
  | 'invalid_input'
  | 'not_found'
  | 'uninstall_failed'
  | 'uninstall_unsupported'
  | 'credential_missing';

export type WindowsAssessmentResult =
  | { ok: true; assessment: WindowsAssessment }
  | { ok: false; error: WindowsAssessmentError; detail?: string };
