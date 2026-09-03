import { existsSync } from 'node:fs';

const WINDOWS_NMAP = [
  'C:\\Program Files (x86)\\Nmap\\nmap.exe',
  'C:\\Program Files\\Nmap\\nmap.exe',
];

export function nmapExecutable(): string {
  for (const candidate of WINDOWS_NMAP) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return 'nmap';
}
