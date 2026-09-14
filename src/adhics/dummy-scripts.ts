export function winrmJsonStub(controlCode: string, result: string, summary: string): string {
  const safe = summary.replace(/'/g, "''");
  return [
    'Invoke-Command -ComputerName {{ComputerName}} -ScriptBlock {',
    '  $out = [ordered]@{',
    `    controlId = '${controlCode}'`,
    `    result    = '${result}'`,
    `    summary   = '${safe}'`,
    "    evidence  = @('hostname=' + $env:COMPUTERNAME)",
    '  }',
    '  $out | ConvertTo-Json -Compress',
    '}',
  ].join('\n');
}

export function tls10WinrmBody(controlCode: string): string {
  return `Invoke-Command -ComputerName {{ComputerName}} -ScriptBlock {
  $path = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\SecurityProviders\\SCHANNEL\\Protocols\\TLS 1.0\\Server'
  $enabled = $null
  $disabledByDefault = $null
  if (Test-Path $path) {
    $enabled = (Get-ItemProperty -Path $path -Name Enabled -ErrorAction SilentlyContinue).Enabled
    $disabledByDefault = (Get-ItemProperty -Path $path -Name DisabledByDefault -ErrorAction SilentlyContinue).DisabledByDefault
  }
  $tls10Off = ($enabled -eq 0) -or ($disabledByDefault -eq 1 -and ($enabled -eq 0 -or $null -eq $enabled))
  $out = [ordered]@{
    controlId = '${controlCode}'
    result    = $(if ($tls10Off) { 'pass' } else { 'fail' })
    summary   = $(if ($tls10Off) { 'TLS 1.0 server protocol is disabled.' } else { 'TLS 1.0 server protocol is enabled or not explicitly disabled.' })
    evidence  = @(
      'hostname=' + $env:COMPUTERNAME
      'TLS1.0.Server.Enabled=' + $(if ($null -eq $enabled) { 'missing' } else { $enabled })
      'TLS1.0.Server.DisabledByDefault=' + $(if ($null -eq $disabledByDefault) { 'missing' } else { $disabledByDefault })
    )
  }
  $out | ConvertTo-Json -Compress
}`;
}

export const DUMMY_ASSESSMENT_SCRIPTS: Array<{
  controlCode: string;
  name: string;
  result: 'pass' | 'fail';
  body: string;
}> = [
  {
    controlCode: 'CO 12.1',
    name: 'TLS 1.0 disabled (Schannel)',
    result: 'fail',
    body: tls10WinrmBody('CO 12.1'),
  },
  {
    controlCode: 'CO 12.3',
    name: 'Wireless encryption present',
    result: 'pass',
    body: winrmJsonStub('CO 12.3', 'pass', 'Wireless profile uses WPA2 or stronger.'),
  },
  {
    controlCode: 'CO 2.1',
    name: 'OS build vs clinic baseline',
    result: 'fail',
    body: winrmJsonStub('CO 2.1', 'fail', 'OS build is older than clinic baseline.'),
  },
  {
    controlCode: 'CO 4.1',
    name: 'Antivirus real-time protection',
    result: 'fail',
    body: winrmJsonStub('CO 4.1', 'fail', 'Real-time anti-malware is not enabled.'),
  },
  {
    controlCode: 'AC 6.1',
    name: 'Secure log-on banner',
    result: 'pass',
    body: winrmJsonStub('AC 6.1', 'pass', 'Interactive logon banner is configured.'),
  },
  {
    controlCode: 'AM 2.1',
    name: 'Hostname recorded in inventory',
    result: 'fail',
    body: winrmJsonStub('AM 2.1', 'fail', 'Hostname is empty or does not match inventory.'),
  },
  {
    controlCode: 'HR 3.3',
    name: 'Security awareness training current',
    result: 'pass',
    body: winrmJsonStub('HR 3.3', 'pass', 'Awareness training completion is recorded.'),
  },
];

export const DUMMY_REPORT_UNITS = [
  {
    hostname: 'RCPT-PC-01',
    ipv4: '192.168.10.21',
    device: 'Workstation (PC)',
    location: 'Reception',
  },
  {
    hostname: 'CLINIC-LT-02',
    ipv4: '192.168.10.34',
    device: 'Workstation (Laptop)',
    location: 'Consult',
  },
  {
    hostname: 'NVR-01',
    ipv4: '192.168.20.10',
    device: 'NVR',
    location: 'IT closet',
  },
];
