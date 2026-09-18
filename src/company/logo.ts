import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { getDb } from '../db/client';

export type LogoKind = 'png' | 'jpg';

export type CompanyLogoBytes = {
  kind: LogoKind;
  bytes: Uint8Array;
};

const MAX_BYTES = 2 * 1024 * 1024;

function mimeFor(kind: LogoKind): string {
  return kind === 'png' ? 'image/png' : 'image/jpeg';
}

function detectKind(bytes: Uint8Array): LogoKind | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpg';
  }
  return null;
}

function storedName(kind: LogoKind): string {
  return kind === 'png' ? 'company-logo.png' : 'company-logo.jpg';
}

function logoDir(): string {
  return app.getPath('userData');
}

function logoDiskPath(fileName: string): string {
  return path.join(logoDir(), fileName);
}

function logoFileName(): string {
  const row = getDb()
    .prepare('SELECT logo_file FROM company_profile WHERE id = 1')
    .get() as { logo_file?: string } | undefined;
  return String(row?.logo_file ?? '').trim();
}

function setLogoFileName(fileName: string): void {
  const now = new Date().toISOString();
  getDb()
    .prepare('UPDATE company_profile SET logo_file = ?, updated_at = ? WHERE id = 1')
    .run(fileName, now);
}

function removeStoredFiles(keep?: string): void {
  for (const name of ['company-logo.png', 'company-logo.jpg']) {
    if (keep && name === keep) {
      continue;
    }
    const target = logoDiskPath(name);
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
    }
  }
}

export function getCompanyLogoBytes(): CompanyLogoBytes | null {
  const fileName = logoFileName();
  if (!fileName) {
    return null;
  }
  const full = logoDiskPath(fileName);
  if (!fs.existsSync(full)) {
    return null;
  }
  const bytes = new Uint8Array(fs.readFileSync(full));
  const kind = detectKind(bytes);
  if (!kind) {
    return null;
  }
  return { kind, bytes };
}

export function getCompanyLogoDataUrl(): string | null {
  const logo = getCompanyLogoBytes();
  if (!logo) {
    return null;
  }
  return `data:${mimeFor(logo.kind)};base64,${Buffer.from(logo.bytes).toString('base64')}`;
}

export function saveCompanyLogoFromPath(sourcePath: string): { ok: true } | { error: string } {
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
    return { error: 'Could not read that image.' };
  }
  const size = fs.statSync(sourcePath).size;
  if (size <= 0 || size > MAX_BYTES) {
    return { error: 'Logo must be a PNG or JPEG under 2 MB.' };
  }
  const bytes = new Uint8Array(fs.readFileSync(sourcePath));
  const kind = detectKind(bytes);
  if (!kind) {
    return { error: 'Use a PNG or JPEG logo.' };
  }
  const fileName = storedName(kind);
  const dest = logoDiskPath(fileName);
  fs.mkdirSync(logoDir(), { recursive: true });
  removeStoredFiles(fileName);
  fs.writeFileSync(dest, Buffer.from(bytes));
  setLogoFileName(fileName);
  return { ok: true };
}

export function clearCompanyLogo(): void {
  removeStoredFiles();
  setLogoFileName('');
}
