export type TlsFacts = {
  portOpen: boolean;
  tlsVersions: string[];
  ciphers: string[];
  certificateSubject: string | null;
  certificateIssuer: string | null;
  certificateExpires: string | null;
};

export type SmbFacts = {
  portOpen: boolean;
  dialects: string[];
  smbv1Advertised: boolean | null;
  signingRequired?: boolean | null;
};

export type AssessmentIssue = {
  id: string;
  title: string;
  description: string;
  evidence: string;
  recommendation: string;
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
};

export type ServiceAssessment = {
  id: string;
  assetId: string;
  tls: TlsFacts;
  smb: SmbFacts;
  openPorts: number[];
  issues: AssessmentIssue[];
  notes: string;
  createdAt: string;
};

export type AssessmentError =
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_input'
  | 'not_found'
  | 'not_authorized_range'
  | 'nmap_missing'
  | 'scan_in_progress'
  | 'scan_failed'
  | 'timeout'
  | 'database_unavailable';

export type AssessmentResult =
  | { ok: true; assessment: ServiceAssessment }
  | { ok: false; error: AssessmentError };
