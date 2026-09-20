import { spawn } from 'node:child_process';

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

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

function parseNameMap(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  const arrayStart = raw.indexOf('[');
  const objectStart = raw.indexOf('{');
  let payload = '';
  if (arrayStart >= 0 && (objectStart < 0 || arrayStart < objectStart)) {
    const end = raw.lastIndexOf(']');
    if (end > arrayStart) {
      payload = raw.slice(arrayStart, end + 1);
    }
  } else if (objectStart >= 0) {
    const end = raw.lastIndexOf('}');
    if (end > objectStart) {
      payload = raw.slice(objectStart, end + 1);
    }
  }
  if (!payload) {
    return map;
  }
  try {
    const rows = JSON.parse(payload) as unknown;
    const list = Array.isArray(rows) ? rows : [rows];
    for (const row of list) {
      if (!row || typeof row !== 'object') {
        continue;
      }
      const ipv4 = String((row as { IPv4?: unknown }).IPv4 ?? '').trim();
      const name = String((row as { Name?: unknown }).Name ?? '').trim();
      if (IPV4.test(ipv4) && name && !IPV4.test(name) && !map.has(ipv4)) {
        map.set(ipv4, name);
      }
    }
  } catch {
    /* ignore */
  }
  return map;
}

export async function lookupAdComputerNames(ipv4s: string[]): Promise<Map<string, string>> {
  const wanted = [...new Set(ipv4s.map((ip) => ip.trim()).filter((ip) => IPV4.test(ip)))];
  if (wanted.length === 0) {
    return new Map();
  }
  const list = wanted.map((ip) => `'${ip}'`).join(',');
  const command = [
    'try { Import-Module ActiveDirectory -ErrorAction Stop } catch { "[]"; return }',
    `$want = @(${list})`,
    '$hits = @()',
    'Get-ADComputer -Filter * -Properties DNSHostName | ForEach-Object {',
    '  if ($_.DNSHostName) {',
    '    try {',
    '      $ips = [System.Net.Dns]::GetHostAddresses($_.DNSHostName)',
    '      foreach ($w in $want) {',
    '        if ($ips.IPAddressToString -contains $w) {',
    '          $hits += [pscustomobject]@{ Name = $_.Name; IPv4 = $w }',
    '        }',
    '      }',
    '    } catch {}',
    '  }',
    '}',
    'if ($hits.Count -eq 0) { "[]" } else { $hits | ConvertTo-Json -Compress }',
  ].join('\n');
  const raw = await runPowerShell(command, 120000);
  return parseNameMap(raw);
}
