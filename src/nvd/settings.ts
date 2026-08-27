import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';

type StoredNvd = {
  apiKey: string | null;
};

function configPath(): string {
  return path.join(app.getPath('userData'), 'nvd.json');
}

function parseKey(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const key = value.trim();
  if (key.length < 8 || key.length > 128) {
    return null;
  }
  if (!/^[A-Za-z0-9-]+$/.test(key)) {
    return null;
  }
  return key;
}

async function readStored(): Promise<StoredNvd> {
  try {
    await access(configPath());
  } catch {
    return { apiKey: null };
  }
  try {
    const raw = JSON.parse(await readFile(configPath(), 'utf8')) as unknown;
    if (!raw || typeof raw !== 'object') {
      return { apiKey: null };
    }
    return { apiKey: parseKey((raw as { apiKey?: unknown }).apiKey) };
  } catch {
    return { apiKey: null };
  }
}

export async function getNvdApiKey(): Promise<string | null> {
  return (await readStored()).apiKey;
}

export async function saveNvdApiKey(value: string | null): Promise<string | null> {
  await mkdir(app.getPath('userData'), { recursive: true });
  const apiKey = value === null || value.trim() === '' ? null : parseKey(value);
  if (value && value.trim() !== '' && !apiKey) {
    return null;
  }
  const stored: StoredNvd = { apiKey };
  await writeFile(configPath(), `${JSON.stringify(stored, null, 2)}\n`, 'utf8');
  return apiKey;
}

export function keyTail(apiKey: string | null): string | null {
  if (!apiKey || apiKey.length < 4) {
    return null;
  }
  return apiKey.slice(-4);
}
