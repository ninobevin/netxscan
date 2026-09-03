import { spawn } from 'node:child_process';

function runPowerShell(command: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', command],
      { windowsHide: true },
    );
    let stdout = '';
    const timer = setTimeout(() => {
      child.kill();
    }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
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

export async function probeWinrm(
  host: string,
  ipv4: string,
): Promise<{
  ok: boolean;
  osVersion: string | null;
  macAddress: string | null;
}> {
  const name = computerArg(host);
  const ip = computerArg(ipv4);
  const test = await runPowerShell(
    `try { Test-WSMan -ComputerName '${name}' -ErrorAction Stop | Out-Null; 'OK' } catch { 'FAIL' }`,
    8000,
  );
  if (test !== 'OK') {
    return { ok: false, osVersion: null, macAddress: null };
  }

  const os = await runPowerShell(
    `try { Invoke-Command -ComputerName '${name}' -ScriptBlock { $o = Get-CimInstance Win32_OperatingSystem; ($o.Caption + ' ' + $o.Version).Trim() } -ErrorAction Stop } catch { '' }`,
    12000,
  );

  const mac = await runPowerShell(
    `try { Invoke-Command -ComputerName '${name}' -ArgumentList '${ip}' -ScriptBlock { param($want) $cfgs = @(Get-CimInstance Win32_NetworkAdapterConfiguration | Where-Object { $_.MACAddress }); $m = $cfgs | Where-Object { $_.IPAddress -contains $want } | Select-Object -First 1; if ($m) { $m.MACAddress } elseif ($cfgs.Count -gt 0) { $cfgs[0].MACAddress } else { '' } } -ErrorAction Stop } catch { '' }`,
    15000,
  );

  return {
    ok: true,
    osVersion: os || null,
    macAddress: mac ? mac.toUpperCase() : null,
  };
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

export async function checkAccessibility(
  host: string,
  ipv4: string,
  startIfNeeded: boolean,
): Promise<{ ok: boolean; osVersion: string | null; macAddress: string | null }> {
  let result = await probeWinrm(host, ipv4);
  if (result.ok || !startIfNeeded) {
    return result;
  }

  await tryStartWinrm(host);
  result = await probeWinrm(host, ipv4);
  return result;
}
