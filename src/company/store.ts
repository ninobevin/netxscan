import { access, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import type { CompanyProfile } from '../shared/company-types';

const DEFAULT_NAME = 'Your organization';
const MAX_NAME = 80;
const MAX_LOGO_BYTES = 1024 * 1024;

type StoredProfile = {
  companyName: string;
  logoFile: string | null;
};

function userDataDir(): string {
  return app.getPath('userData');
}

export function companyConfigPath(): string {
  return path.join(userDataDir(), 'company.json');
}

export function logoDir(): string {
  return path.join(userDataDir(), 'logo');
}

function parseName(value: unknown): string {
  if (typeof value !== 'string') {
    return DEFAULT_NAME;
  }

  const name = value.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME);
  return name.length > 0 ? name : DEFAULT_NAME;
}

function parseLogoFile(value: unknown): string | null {
  return value === 'logo.png' || value === 'logo.jpg' || value === 'logo.webp'
    ? value
    : null;
}

async function readStored(): Promise<StoredProfile> {
  await mkdir(logoDir(), { recursive: true });

  try {
    await access(companyConfigPath());
  } catch {
    const initial: StoredProfile = {
      companyName: 'Dental clinic',
      logoFile: null,
    };
    await writeFile(
      companyConfigPath(),
      `${JSON.stringify(initial, null, 2)}\n`,
      'utf8',
    );
    return initial;
  }

  try {
    const raw = JSON.parse(await readFile(companyConfigPath(), 'utf8')) as unknown;
    if (!raw || typeof raw !== 'object') {
      return { companyName: DEFAULT_NAME, logoFile: null };
    }

    const record = raw as Record<string, unknown>;
    return {
      companyName: parseName(record.companyName),
      logoFile: parseLogoFile(record.logoFile),
    };
  } catch {
    return { companyName: DEFAULT_NAME, logoFile: null };
  }
}

async function writeStored(profile: StoredProfile): Promise<void> {
  await mkdir(logoDir(), { recursive: true });
  await writeFile(
    companyConfigPath(),
    `${JSON.stringify(profile, null, 2)}\n`,
    'utf8',
  );
}

function mimeFromBytes(
  bytes: Buffer,
): { mime: string; file: 'logo.png' | 'logo.jpg' | 'logo.webp' } | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { mime: 'image/png', file: 'logo.png' };
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: 'image/jpeg', file: 'logo.jpg' };
  }

  if (
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { mime: 'image/webp', file: 'logo.webp' };
  }

  return null;
}

async function logoDataUrl(logoFile: string | null): Promise<string | null> {
  if (!logoFile) {
    return null;
  }

  try {
    const bytes = await readFile(path.join(logoDir(), logoFile));
    const kind = mimeFromBytes(bytes);
    if (!kind) {
      return null;
    }

    return `data:${kind.mime};base64,${bytes.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function getCompanyProfile(): Promise<CompanyProfile> {
  const stored = await readStored();
  const logoDataUrlValue = await logoDataUrl(stored.logoFile);
  return {
    companyName: stored.companyName,
    hasLogo: Boolean(logoDataUrlValue),
    logoDataUrl: logoDataUrlValue,
  };
}

export function parseCompanyName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const name = value.trim().replace(/\s+/g, ' ');
  if (name.length === 0 || name.length > MAX_NAME) {
    return null;
  }

  return name;
}

export async function saveCompanyName(companyName: string): Promise<CompanyProfile> {
  const stored = await readStored();
  stored.companyName = companyName;
  await writeStored(stored);
  return getCompanyProfile();
}

export async function saveCompanyLogo(bytes: Buffer): Promise<CompanyProfile> {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_LOGO_BYTES) {
    throw new Error('invalid_input');
  }

  const kind = mimeFromBytes(bytes);
  if (!kind) {
    throw new Error('invalid_input');
  }

  await mkdir(logoDir(), { recursive: true });
  const stored = await readStored();

  for (const name of ['logo.png', 'logo.jpg', 'logo.webp']) {
    try {
      await unlink(path.join(logoDir(), name));
    } catch {
      // ignore missing previous logo
    }
  }

  await writeFile(path.join(logoDir(), kind.file), bytes);
  stored.logoFile = kind.file;
  await writeStored(stored);
  return getCompanyProfile();
}

export async function removeCompanyLogo(): Promise<CompanyProfile> {
  const stored = await readStored();
  if (stored.logoFile) {
    try {
      await unlink(path.join(logoDir(), stored.logoFile));
    } catch {
      // ignore
    }
  }

  stored.logoFile = null;
  await writeStored(stored);
  return getCompanyProfile();
}
