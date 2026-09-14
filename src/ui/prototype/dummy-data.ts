export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type FindingStatus = 'open' | 'acknowledged' | 'closed';
export type ControlStatus = 'mapped' | 'gap' | 'not_assessed';

export type DummyPort = {
  port: number;
  protocol: string;
  service: string;
  product: string;
};

export type DummyAsset = {
  id: number;
  ipv4: string;
  hostname: string;
  macAddress: string;
  osVersion: string;
  device: string;
  location: string;
  winrmOk: boolean;
  ports: DummyPort[];
};

export type DummyFinding = {
  id: number;
  title: string;
  severity: Severity;
  status: FindingStatus;
  assetId: number;
  controlId: string;
  description: string;
  evidence: string[];
};

export type DummyControl = {
  id: string;
  domain: string;
  description: string;
  status: ControlStatus;
};

export type ScriptRunner = 'winrm' | 'nmap';

export type DummyScript = {
  id: number;
  controlId: string;
  name: string;
  runner: ScriptRunner;
  enabled: boolean;
  timeoutSec: number;
  body: string;
};

export const CLINIC = {
  name: 'Al Noor Dental Clinic',
  address: 'Khalifa City, Abu Dhabi',
  contact: 'it@alnoordental.local',
  reportDate: '11 Sep 2026',
};

export const DUMMY_CONTROLS: DummyControl[] = [
  {
    id: 'GOV-01',
    domain: 'Governance',
    description: 'Information security roles and accountability',
    status: 'mapped',
  },
  {
    id: 'AC-01',
    domain: 'Access control',
    description: 'Unique user accounts and local admin review',
    status: 'gap',
  },
  {
    id: 'AM-01',
    domain: 'Asset management',
    description: 'Authorized hardware inventory',
    status: 'mapped',
  },
  {
    id: 'OP-01',
    domain: 'Operations',
    description: 'Patch and firmware currency',
    status: 'gap',
  },
  {
    id: 'IM-01',
    domain: 'Incident management',
    description: 'Audit logging on workstations',
    status: 'not_assessed',
  },
];

function jsonStub(controlId: string, result: string, summary: string): string {
  const safe = summary.replace(/'/g, "''");
  return [
    'Invoke-Command -ComputerName {{ComputerName}} -ScriptBlock {',
    '  $out = [ordered]@{',
    `    controlId = '${controlId}'`,
    `    result    = '${result}'`,
    `    summary   = '${safe}'`,
    "    evidence  = @('hostname=' + $env:COMPUTERNAME)",
    '  }',
    '  $out | ConvertTo-Json -Compress',
    '}',
  ].join('\n');
}

function nmapStub(controlId: string, result: string, summary: string): string {
  const safe = summary.replace(/'/g, "''");
  return [
    '# Nmap runner — {{ComputerName}} is replaced with the target IP/hostname',
    `# nmap -sn {{ComputerName}}`,
    '$out = [ordered]@{',
    `  controlId = '${controlId}'`,
    `  result    = '${result}'`,
    `  summary   = '${safe}'`,
    "  evidence  = @('target={{ComputerName}}')",
    '}',
    '$out | ConvertTo-Json -Compress',
  ].join('\n');
}

export function applyComputerName(body: string, hostname: string): string {
  const safe = hostname.replace(/'/g, "''");
  return body.split('{{ComputerName}}').join(safe);
}

export function defaultWinrmBody(controlId: string): string {
  return jsonStub(controlId, 'pass', 'Replace this stub.');
}

export function defaultNmapBody(controlId: string): string {
  return nmapStub(controlId, 'pass', 'Replace this stub.');
}

export const DUMMY_SCRIPTS: DummyScript[] = [
  {
    id: 1,
    controlId: 'GOV-01',
    name: 'Confirm workstation is domain-joined',
    runner: 'winrm',
    enabled: true,
    timeoutSec: 30,
    body: jsonStub('GOV-01', 'pass', 'Host reports a domain member.'),
  },
  {
    id: 2,
    controlId: 'AC-01',
    name: 'Local administrators group membership',
    runner: 'winrm',
    enabled: true,
    timeoutSec: 45,
    body: jsonStub('AC-01', 'fail', 'Unexpected local administrators present.'),
  },
  {
    id: 3,
    controlId: 'AC-01',
    name: 'Guest account disabled',
    runner: 'winrm',
    enabled: true,
    timeoutSec: 20,
    body: jsonStub('AC-01', 'pass', 'Guest account is disabled.'),
  },
  {
    id: 4,
    controlId: 'AM-01',
    name: 'Hostname and serial present',
    runner: 'nmap',
    enabled: true,
    timeoutSec: 20,
    body: nmapStub('AM-01', 'pass', 'Hostname and BIOS serial returned.'),
  },
  {
    id: 5,
    controlId: 'OP-01',
    name: 'OS build within supported range',
    runner: 'winrm',
    enabled: true,
    timeoutSec: 30,
    body: jsonStub('OP-01', 'fail', 'OS build is older than clinic baseline.'),
  },
  {
    id: 6,
    controlId: 'OP-01',
    name: 'Windows Update service running',
    runner: 'winrm',
    enabled: true,
    timeoutSec: 20,
    body: jsonStub('OP-01', 'pass', 'wuauserv is running.'),
  },
  {
    id: 7,
    controlId: 'IM-01',
    name: 'Windows event log service running',
    runner: 'winrm',
    enabled: false,
    timeoutSec: 20,
    body: jsonStub('IM-01', 'error', 'Script disabled in prototype library.'),
  },
];

export const DUMMY_ASSETS: DummyAsset[] = [
  {
    id: 1,
    ipv4: '192.168.10.21',
    hostname: 'RCPT-PC-01',
    macAddress: '3C:7C:3F:11:22:01',
    osVersion: 'Windows 11 23H2',
    device: 'Workstation (PC)',
    location: 'Reception',
    winrmOk: true,
    ports: [
      { port: 135, protocol: 'tcp', service: 'epmap', product: 'Microsoft RPC' },
      { port: 445, protocol: 'tcp', service: 'microsoft-ds', product: 'SMB' },
      { port: 3389, protocol: 'tcp', service: 'rdp', product: 'Remote Desktop' },
    ],
  },
  {
    id: 2,
    ipv4: '192.168.10.22',
    hostname: 'DR-LAP-02',
    macAddress: '3C:7C:3F:11:22:02',
    osVersion: 'Windows 10 21H2',
    device: 'Workstation (Laptop)',
    location: 'Clinic 2',
    winrmOk: true,
    ports: [
      { port: 445, protocol: 'tcp', service: 'microsoft-ds', product: 'SMB' },
      { port: 5985, protocol: 'tcp', service: 'wsman', product: 'WinRM' },
    ],
  },
  {
    id: 3,
    ipv4: '192.168.10.40',
    hostname: 'CAM-ENT-03',
    macAddress: '00:12:16:AA:BB:03',
    osVersion: '—',
    device: 'CCTV Camera',
    location: 'Entrance',
    winrmOk: false,
    ports: [
      { port: 80, protocol: 'tcp', service: 'http', product: 'Vendor web UI' },
      { port: 554, protocol: 'tcp', service: 'rtsp', product: 'RTSP' },
    ],
  },
  {
    id: 4,
    ipv4: '192.168.10.41',
    hostname: 'NVR-MAIN',
    macAddress: '00:12:16:AA:BB:04',
    osVersion: 'Linux (vendor)',
    device: 'NVR',
    location: 'IT closet',
    winrmOk: false,
    ports: [
      { port: 443, protocol: 'tcp', service: 'https', product: 'OpenSSL 1.0.2' },
      { port: 8000, protocol: 'tcp', service: 'http-alt', product: 'NVR API' },
    ],
  },
  {
    id: 5,
    ipv4: '192.168.10.2',
    hostname: 'SW-CLINIC-01',
    macAddress: 'F4:8C:50:00:10:02',
    osVersion: '—',
    device: 'Managed Switch',
    location: 'IT closet',
    winrmOk: false,
    ports: [{ port: 22, protocol: 'tcp', service: 'ssh', product: 'Dropbear' }],
  },
  {
    id: 6,
    ipv4: '192.168.10.1',
    hostname: 'FW-EDGE',
    macAddress: 'F4:8C:50:00:10:01',
    osVersion: '—',
    device: 'Firewall',
    location: 'IT closet',
    winrmOk: false,
    ports: [{ port: 443, protocol: 'tcp', service: 'https', product: 'Management UI' }],
  },
  {
    id: 7,
    ipv4: '192.168.10.30',
    hostname: 'STER-PC-01',
    macAddress: '3C:7C:3F:11:22:07',
    osVersion: 'Windows 11 24H2',
    device: 'Workstation (PC)',
    location: 'Sterilization',
    winrmOk: true,
    ports: [{ port: 5985, protocol: 'tcp', service: 'wsman', product: 'WinRM' }],
  },
  {
    id: 8,
    ipv4: '192.168.10.55',
    hostname: '192.168.10.55',
    macAddress: '—',
    osVersion: '—',
    device: 'CCTV Camera',
    location: 'Car park',
    winrmOk: false,
    ports: [{ port: 80, protocol: 'tcp', service: 'http', product: 'Unknown' }],
  },
];

export const DUMMY_FINDINGS: DummyFinding[] = [
  {
    id: 1,
    title: 'SMBv1 still enabled on reception PC',
    severity: 'critical',
    status: 'open',
    assetId: 1,
    controlId: 'OP-01',
    description: 'OP-01: workstation image is below clinic patch baseline (SMBv1 present).',
    evidence: ['Feature SMBv1 = Enabled'],
  },
  {
    id: 2,
    title: 'Print Spooler running on a desk PC',
    severity: 'high',
    status: 'open',
    assetId: 1,
    controlId: 'OP-01',
    description: 'OP-01: Print Spooler is not required on reception workstations.',
    evidence: ['Service Spooler = Running'],
  },
  {
    id: 3,
    title: 'Unexpected local administrators',
    severity: 'high',
    status: 'open',
    assetId: 2,
    controlId: 'AC-01',
    description: 'AC-01 script reported extra members in Administrators.',
    evidence: ['Administrators includes clinic-temp'],
  },
  {
    id: 4,
    title: 'NVR management TLS below clinic standard',
    severity: 'high',
    status: 'acknowledged',
    assetId: 4,
    controlId: 'OP-01',
    description: 'OP-01: vendor HTTPS stack is outdated; firmware update pending.',
    evidence: ['HTTPS on 443', 'OpenSSL 1.0.2 banner'],
  },
  {
    id: 5,
    title: 'Camera web UI without MFA',
    severity: 'critical',
    status: 'open',
    assetId: 3,
    controlId: 'AC-01',
    description: 'AC-01: entrance camera still answers HTTP on port 80.',
    evidence: ['HTTP 80 open'],
  },
  {
    id: 6,
    title: 'Switch SSH not recorded in authorized inventory',
    severity: 'medium',
    status: 'open',
    assetId: 5,
    controlId: 'AM-01',
    description: 'AM-01: management SSH is exposed; confirm inventory and hardening.',
    evidence: ['tcp/22 Dropbear'],
  },
  {
    id: 7,
    title: 'Firewall management restricted after review',
    severity: 'medium',
    status: 'closed',
    assetId: 6,
    controlId: 'GOV-01',
    description: 'GOV-01: management UI limited to IT VLAN after last review.',
    evidence: ['HTTPS management from IT VLAN only'],
  },
  {
    id: 8,
    title: 'RDP listening on reception PC',
    severity: 'high',
    status: 'open',
    assetId: 1,
    controlId: 'AC-01',
    description: 'AC-01: clinic policy is no RDP on front-desk PCs.',
    evidence: ['tcp/3389 listening'],
  },
  {
    id: 9,
    title: 'Unidentified camera on car-park VLAN',
    severity: 'low',
    status: 'open',
    assetId: 8,
    controlId: 'AM-01',
    description: 'AM-01: host has no hostname or MAC in inventory.',
    evidence: ['hostname empty', 'MAC empty'],
  },
  {
    id: 10,
    title: 'Laptop OS build below clinic baseline',
    severity: 'medium',
    status: 'acknowledged',
    assetId: 2,
    controlId: 'OP-01',
    description: 'OP-01: Windows 10 21H2 is below the agreed workstation image.',
    evidence: ['Caption Windows 10', 'Version 21H2'],
  },
];

export function assetById(id: number): DummyAsset | undefined {
  return DUMMY_ASSETS.find((asset) => asset.id === id);
}

export function findingsForAsset(
  assetId: number,
  findings = DUMMY_FINDINGS,
): DummyFinding[] {
  return findings.filter((finding) => finding.assetId === assetId);
}

export function openFindingCount(assetId: number, findings = DUMMY_FINDINGS): number {
  return findings.filter(
    (finding) => finding.assetId === assetId && finding.status === 'open',
  ).length;
}

export function compliancePercent(findings = DUMMY_FINDINGS): number {
  const open = findings.filter((finding) => finding.status === 'open').length;
  return Math.round((1 - open / Math.max(findings.length, 1)) * 100);
}

export function complianceByDomain(
  findings = DUMMY_FINDINGS,
  controls = DUMMY_CONTROLS,
): Array<{ domain: string; controlId: string; percent: number; open: number }> {
  return controls.map((control) => {
    const rows = findings.filter((finding) => finding.controlId === control.id);
    const open = rows.filter((finding) => finding.status === 'open').length;
    const percent = rows.length === 0 ? 100 : Math.round((1 - open / rows.length) * 100);
    return { domain: control.domain, controlId: control.id, percent, open };
  });
}

export function unitsWithFindingsByDomain(
  findings = DUMMY_FINDINGS,
  controls = DUMMY_CONTROLS,
): Array<{
  domain: string;
  units: Array<{
    hostname: string;
    ipv4: string;
    device: string;
    location: string;
    findings: string;
  }>;
}> {
  const active = findings.filter((finding) => finding.status !== 'closed');
  const grouped = new Map<
    string,
    Map<
      number,
      {
        hostname: string;
        ipv4: string;
        device: string;
        location: string;
        titles: string[];
      }
    >
  >();

  for (const finding of active) {
    const control = controls.find((item) => item.id === finding.controlId);
    const domain = control?.domain?.trim() || 'Unmapped';
    const asset = assetById(finding.assetId);
    if (!asset) {
      continue;
    }
    if (!grouped.has(domain)) {
      grouped.set(domain, new Map());
    }
    const units = grouped.get(domain);
    if (!units) {
      continue;
    }
    const existing = units.get(asset.id);
    if (existing) {
      if (!existing.titles.includes(finding.title)) {
        existing.titles.push(finding.title);
      }
    } else {
      units.set(asset.id, {
        hostname: asset.hostname || asset.ipv4,
        ipv4: asset.ipv4,
        device: asset.device,
        location: asset.location,
        titles: [finding.title],
      });
    }
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([domain, units]) => ({
      domain,
      units: [...units.values()].map((unit) => ({
        hostname: unit.hostname,
        ipv4: unit.ipv4,
        device: unit.device,
        location: unit.location,
        findings: unit.titles.join('; '),
      })),
    }))
    .filter((section) => section.units.length > 0);
}

export function scriptsForControl(
  controlId: string,
  scripts = DUMMY_SCRIPTS,
): DummyScript[] {
  return scripts.filter((script) => script.controlId === controlId);
}

export function assetComplianceTag(assetId: number, findings = DUMMY_FINDINGS): string {
  const open = openFindingCount(assetId, findings);
  const critical = findings.some(
    (finding) =>
      finding.assetId === assetId &&
      finding.status === 'open' &&
      finding.severity === 'critical',
  );
  if (critical) {
    return 'At risk';
  }
  if (open > 0) {
    return 'Review';
  }
  return 'OK';
}
