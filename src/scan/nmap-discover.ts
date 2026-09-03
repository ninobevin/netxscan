import { spawn } from 'node:child_process';

export type DiscoveredHost = {
  ipv4: string;
  hostname: string | null;
};

const NMAP_TIMEOUT_MS = 4 * 60 * 1000;

export function nmapTargetSpec(input: string): string {
  const raw = input.trim();
  const rangeMatch = raw.match(
    /^(\d{1,3}(?:\.\d{1,3}){3})\s*[-–]\s*(\d{1,3}(?:\.\d{1,3}){3})$/,
  );
  if (rangeMatch) {
    return `${rangeMatch[1]}-${rangeMatch[2]}`;
  }
  return raw;
}

export function parseNmapReportLine(line: string): DiscoveredHost | null {
  const named = line.match(
    /Nmap scan report for (.+?) \((\d{1,3}(?:\.\d{1,3}){3})\)/i,
  );
  if (named) {
    const label = named[1].trim();
    const ipv4 = named[2];
    return {
      ipv4,
      hostname: label === ipv4 ? null : label,
    };
  }

  const ipOnly = line.match(
    /Nmap scan report for (\d{1,3}(?:\.\d{1,3}){3})\b/i,
  );
  if (ipOnly) {
    return { ipv4: ipOnly[1], hostname: null };
  }

  return null;
}

export function discoverHostsWithNmap(
  targetSpec: string,
  onHost: (host: DiscoveredHost) => void,
): Promise<{ live: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'nmap',
      ['-sn', '-PR', '-PS80,443,445,3389', '--max-retries', '1', targetSpec],
      { windowsHide: true },
    );
    let buffer = '';
    let live = 0;
    const seen = new Set<string>();

    const timer = setTimeout(() => {
      child.kill();
    }, NMAP_TIMEOUT_MS);

    const consume = (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const host = parseNmapReportLine(line);
        if (!host || seen.has(host.ipv4)) {
          continue;
        }
        seen.add(host.ipv4);
        live += 1;
        onHost(host);
      }
    };

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', consume);
    child.stderr.on('data', consume);

    child.on('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (error.code === 'ENOENT') {
        reject(new Error('nmap was not found on PATH.'));
        return;
      }
      reject(error);
    });

    child.on('close', () => {
      clearTimeout(timer);
      if (buffer) {
        consume('\n');
      }
      resolve({ live });
    });
  });
}
