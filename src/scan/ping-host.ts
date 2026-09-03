import { spawn } from 'node:child_process';

export type PingResult = {
  live: boolean;
  ipv4: string | null;
  hostname: string | null;
};

function runPing(target: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('ping', ['-n', '1', '-w', '800', '-a', target], {
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', () => {
      resolve(`${stdout}\n${stderr}`);
    });
  });
}

export async function pingHost(target: string): Promise<PingResult> {
  const output = await runPing(target);
  const unreachable = /Destination host unreachable/i.test(output);
  const live = /Reply from /i.test(output) && !unreachable;

  const named = output.match(
    /Pinging\s+(.+?)\s+\[(\d{1,3}(?:\.\d{1,3}){3})\]/i,
  );
  if (named) {
    const label = named[1].trim();
    const ipv4 = named[2];
    return {
      live,
      ipv4,
      hostname: label === ipv4 ? null : label,
    };
  }

  const ipOnly = output.match(/Pinging\s+(\d{1,3}(?:\.\d{1,3}){3})\b/i);
  if (ipOnly) {
    return { live, ipv4: ipOnly[1], hostname: null };
  }

  const fallbackIp = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(target) ? target : null;
  return { live, ipv4: fallbackIp, hostname: live ? target : null };
}
