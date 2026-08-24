import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseRangeList } from './authorize';

const EXAMPLE = {
  ranges: ['192.168.1.0/24'],
};

export async function loadAuthorizedRanges(configPath: string): Promise<string[]> {
  await mkdir(path.dirname(configPath), { recursive: true });

  try {
    await access(configPath);
  } catch {
    await writeFile(configPath, `${JSON.stringify(EXAMPLE, null, 2)}\n`, 'utf8');
  }

  const raw = await readFile(configPath, 'utf8');
  const parsed = parseRangeList(JSON.parse(raw) as unknown);

  if (!parsed) {
    throw new Error('Authorized network configuration is invalid.');
  }

  return parsed;
}
