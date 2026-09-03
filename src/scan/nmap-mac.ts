import { spawn } from 'node:child_process';

function runNmap(ipv4: string): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn('nmap', ['-sn', '-n', ipv4], { windowsHide: true });
    let stdout = '';
    const timer = setTimeout(() => {
      child.kill();
    }, 15000);
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
      resolve(stdout);
    });
  });
}

export async function lookupMacWithNmap(ipv4: string): Promise<string | null> {
  const output = await runNmap(ipv4);
  const match = output.match(/MAC Address:\s*([0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){5})/i);
  return match ? match[1].toUpperCase() : null;
}
