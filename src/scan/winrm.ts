import { spawn } from 'node:child_process';
import os from 'node:os';

function runPowerShell(
  command: string,
  timeoutMs: number,
  options: { nonInteractive?: boolean; stdin?: string } = {},
): Promise<string> {
  const nonInteractive = options.nonInteractive !== false;
  return new Promise((resolve) => {
    const args = ['-NoProfile'];
    if (nonInteractive) {
      args.push('-NonInteractive');
    }
    args.push('-Command', command);
    const child = spawn('powershell.exe', args, { windowsHide: true });
    let stdout = '';
    const timer = setTimeout(() => {
      child.kill();
    }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    if (options.stdin !== undefined && child.stdin) {
      child.stdin.on('error', () => {
        /* ignore broken pipe */
      });
      child.stdin.write(options.stdin);
      child.stdin.end();
    }
    child.on('error', () => {
      clearTimeout(timer);
      resolve('');
    });
    child.on('close', () => {
      clearTimeout(timer);
      resolve(stdout.trim());
    });
  });
}

function computerArg(host: string): string {
  return host.replace(/'/g, "''");
}

export function isIpv4Literal(value: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(value.trim());
}

export type WinrmCredential = {
  username: string;
  password: string;
};

export function windowsIdentity(): string {
  const user = os.userInfo().username.trim();
  const domain = process.env.USERDOMAIN?.trim();
  return domain ? `${domain}\\${user}` : user;
}

export type WinrmProbeResult = {
  ok: boolean;
  osVersion: string | null;
  macAddress: string | null;
  hostname: string | null;
};

function parseRemoteHostname(raw: string, ipv4: string): string | null {
  const line = raw
    .split(/\r?\n/)
    .map((part) => part.trim())
    .find(Boolean);
  if (!line) {
    return null;
  }
  if (line.toLowerCase() === ipv4.trim().toLowerCase()) {
    return null;
  }
  return line;
}

function parseRemoteInfo(
  raw: string,
  ipv4: string,
): { osVersion: string | null; macAddress: string | null; hostname: string | null } {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      const info = JSON.parse(raw.slice(start, end + 1)) as {
        os?: unknown;
        mac?: unknown;
        hostname?: unknown;
      };
      const os = typeof info.os === 'string' ? info.os.trim() : '';
      const mac = typeof info.mac === 'string' ? info.mac.trim() : '';
      const hostname = typeof info.hostname === 'string' ? info.hostname.trim() : '';
      return {
        osVersion: os || null,
        macAddress: mac ? mac.toUpperCase() : null,
        hostname: parseRemoteHostname(hostname, ipv4),
      };
    } catch {
      /* fall through */
    }
  }
  return {
    osVersion: null,
    macAddress: null,
    hostname: parseRemoteHostname(raw, ipv4),
  };
}

function invokeCommandWithCredential(
  computerName: string,
  username: string,
  scriptBlock: string,
  extra = '',
): string {
  const name = computerArg(computerName);
  const user = computerArg(username);
  return [
    "$pass = (($input | Out-String).TrimEnd())",
    '$sec = ConvertTo-SecureString $pass -AsPlainText -Force',
    `$cred = New-Object System.Management.Automation.PSCredential('${user}', $sec)`,
    `try { Invoke-Command -ComputerName '${name}' -Credential $cred ${extra}-ScriptBlock { ${scriptBlock} } -ErrorAction Stop } catch { '' }`,
  ].join('; ');
}

async function probeTestWsman(ipv4: string): Promise<boolean> {
  const ip = computerArg(ipv4);
  const test = await runPowerShell(
    `try { Test-WSMan -ComputerName '${ip}' -ErrorAction Stop | Out-Null; 'OK' } catch { 'FAIL' }`,
    8000,
  );
  return test === 'OK';
}

export async function tryStartWinrm(host: string): Promise<void> {
  const name = host.replace(/\\/g, '');
  await new Promise<void>((resolve) => {
    const child = spawn('sc.exe', [`\\\\${name}`, 'start', 'WinRM'], {
      windowsHide: true,
    });
    const timer = setTimeout(() => {
      child.kill();
      resolve();
    }, 8000);
    child.on('close', () => {
      clearTimeout(timer);
      resolve();
    });
    child.on('error', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

export async function testWinrm(ipv4: string, startIfNeeded: boolean): Promise<boolean> {
  const ok = await probeTestWsman(ipv4);
  if (ok || !startIfNeeded) {
    return ok;
  }
  await tryStartWinrm(ipv4);
  return probeTestWsman(ipv4);
}

export async function invokeWinrmDetails(
  computerName: string,
  ipv4: string,
  credential: WinrmCredential,
): Promise<{ osVersion: string | null; macAddress: string | null; hostname: string | null }> {
  const name = computerName.trim();
  if (!name || isIpv4Literal(name)) {
    return { osVersion: null, macAddress: null, hostname: null };
  }
  const ip = computerArg(ipv4);
  const remote = await runPowerShell(
    invokeCommandWithCredential(
      name,
      credential.username,
      [
        'param($want)',
        "$o = Get-CimInstance Win32_OperatingSystem",
        "$os = ($o.Caption + ' ' + $o.Version).Trim()",
        '$cfgs = @(Get-CimInstance Win32_NetworkAdapterConfiguration | Where-Object { $_.MACAddress })',
        '$m = $cfgs | Where-Object { $_.IPAddress -contains $want } | Select-Object -First 1',
        "$mac = if ($m) { $m.MACAddress } elseif ($cfgs.Count -gt 0) { $cfgs[0].MACAddress } else { '' }",
        '$hn = (hostname | Out-String).Trim()',
        'if (-not $hn) { $hn = [string]$env:COMPUTERNAME }',
        '[ordered]@{ os = $os; mac = $mac; hostname = $hn } | ConvertTo-Json -Compress',
      ].join('; '),
      `-ArgumentList '${ip}' `,
    ),
    20000,
    { stdin: credential.password },
  );
  const info = parseRemoteInfo(remote, ipv4);
  let hostname = info.hostname;
  if (!hostname) {
    const hostnameRaw = await runPowerShell(
      invokeCommandWithCredential(name, credential.username, 'hostname'),
      12000,
      { stdin: credential.password },
    );
    hostname = parseRemoteHostname(hostnameRaw, ipv4);
  }
  return {
    osVersion: info.osVersion,
    macAddress: info.macAddress,
    hostname: hostname || name,
  };
}
